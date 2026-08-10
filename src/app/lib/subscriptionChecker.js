import { sendToDeluge } from '@/app/lib/sendToDeluge'
import {
    getSubscriptions,
    markEpisodeDownloaded,
    markSubscriptionChecked,
    setSubscriptionActive,
} from '@/app/lib/subscriptionStore'
import {
    fetchTorrentsByTmdbId,
    getDownloadUrl,
    isEpisodeRelease,
    matchesLanguage,
    parseSeasonEpisode,
    rankTorrent,
} from '@/app/lib/tsApi'

const TMDB_TIMEOUT_MS = 10000
const JELLYFIN_TIMEOUT_MS = 10000

async function fetchJson(url, options = {}, { timeoutMs, label }) {
    const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(timeoutMs),
    })
    if (!response.ok) {
        throw new Error(`${label} returned ${response.status}: ${response.statusText}`)
    }
    return response.json()
}

async function fetchTVShowDetailsFromTMDB(tmdbId) {
    if (!process.env.TMDB_API_KEY) {
        throw new Error('TMDB_API_KEY environment variable is not set')
    }
    return fetchJson(
        `https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${process.env.TMDB_API_KEY}`,
        {},
        { timeoutMs: TMDB_TIMEOUT_MS, label: 'TMDB' }
    )
}

async function fetchFromJellyfin(endpoint, queryParams = '') {
    if (!process.env.JELLYFIN_HOST || !process.env.JELLYFIN_PORT || !process.env.JELLYFIN_API_KEY) {
        throw new Error('Jellyfin environment variables are not set')
    }
    return fetchJson(
        `https://${process.env.JELLYFIN_HOST}:${process.env.JELLYFIN_PORT}${endpoint}${queryParams}`,
        { headers: { 'X-Emby-Token': process.env.JELLYFIN_API_KEY } },
        { timeoutMs: JELLYFIN_TIMEOUT_MS, label: 'Jellyfin' }
    )
}

/**
 * Episodes (as "S:E" strings) that physically exist in Jellyfin for a series.
 * Virtual items (missing/unaired placeholders) are excluded.
 */
async function getEpisodesInJellyfin(tmdbId) {
    const seriesData = await fetchFromJellyfin('/Items', '?Recursive=true&IncludeItemTypes=Series&Fields=ProviderIds')
    const matchedSeries = (seriesData.Items || []).find(item => String(item.ProviderIds?.Tmdb) === String(tmdbId))
    if (!matchedSeries) return new Set()

    const episodesData = await fetchFromJellyfin(
        '/Items',
        `?ParentId=${matchedSeries.Id}&Recursive=true&IncludeItemTypes=Episode&Fields=LocationType,ParentIndexNumber,IndexNumber`
    )

    const present = new Set()
    for (const episode of episodesData.Items || []) {
        if (episode.LocationType === 'Virtual') continue
        if (episode.ParentIndexNumber == null || episode.IndexNumber == null) continue
        present.add(`${episode.ParentIndexNumber}:${episode.IndexNumber}`)
    }
    return present
}

/**
 * Which episodes have aired in the season that is currently running (or, for
 * ended/fully-aired shows, the last aired season).
 * Returns { season, airedEpisodes } or null if nothing has aired yet.
 */
function getAiredEpisodes(tvShowDetails) {
    const nextEpisode = tvShowDetails.next_episode_to_air
    const lastEpisode = tvShowDetails.last_episode_to_air

    if (nextEpisode?.season_number) {
        const airedEpisodes = []
        // If the next episode opens a new season, the relevant season is the
        // previous (fully aired) one
        if (nextEpisode.episode_number === 1) {
            if (!lastEpisode) return null
            for (let i = 1; i <= lastEpisode.episode_number; i++) airedEpisodes.push(i)
            return { season: lastEpisode.season_number, airedEpisodes }
        }
        for (let i = 1; i < nextEpisode.episode_number; i++) airedEpisodes.push(i)
        return { season: nextEpisode.season_number, airedEpisodes }
    }

    if (lastEpisode?.season_number) {
        const airedEpisodes = []
        for (let i = 1; i <= lastEpisode.episode_number; i++) airedEpisodes.push(i)
        return { season: lastEpisode.season_number, airedEpisodes }
    }

    return null
}

/** Check a single subscription and trigger downloads for new episodes. */
export async function checkSubscription(subscription) {
    const { tmdbId, language } = subscription
    const label = `${subscription.title || tmdbId}`
    const downloads = []

    try {
        const tvShowDetails = await fetchTVShowDetailsFromTMDB(tmdbId)
        const originalLanguage = tvShowDetails.original_language || null
        const isEnded = tvShowDetails.status === 'Ended' || tvShowDetails.status === 'Canceled'

        const aired = getAiredEpisodes(tvShowDetails)
        if (!aired) {
            await markSubscriptionChecked(tmdbId)
            return { tmdbId, title: subscription.title, downloads, message: 'No aired episodes yet' }
        }

        const episodesInLibrary = await getEpisodesInJellyfin(tmdbId)
        const alreadyDownloaded = new Set(
            subscription.downloaded.map(entry => `${entry.season}:${entry.episode}`)
        )

        const wantedEpisodes = aired.airedEpisodes.filter(episode =>
            !alreadyDownloaded.has(`${aired.season}:${episode}`) &&
            !episodesInLibrary.has(`${aired.season}:${episode}`)
        )

        if (wantedEpisodes.length === 0) {
            if (isEnded) {
                console.log(`[Subscriptions] ${label}: series ended and complete, deactivating subscription`)
                await setSubscriptionActive(tmdbId, false)
            }
            await markSubscriptionChecked(tmdbId)
            return { tmdbId, title: subscription.title, downloads, message: 'Up to date' }
        }

        console.log(`[Subscriptions] ${label}: S${aired.season} missing episodes ${wantedEpisodes.join(', ')}`)

        // Best single-episode release per wanted episode
        const rows = await fetchTorrentsByTmdbId(tmdbId, 'series')
        const bestByEpisode = new Map()
        for (const row of rows) {
            if (!isEpisodeRelease(row)) continue
            const { season, episode } = parseSeasonEpisode(row.name)
            if (season !== aired.season || !wantedEpisodes.includes(episode)) continue
            // Only auto-download releases matching the subscribed language
            if (!matchesLanguage(row, language, originalLanguage)) continue

            const existing = bestByEpisode.get(episode)
            if (!existing || rankTorrent(row) > rankTorrent(existing)) {
                bestByEpisode.set(episode, row)
            }
        }

        for (const episode of wantedEpisodes) {
            const row = bestByEpisode.get(episode)
            if (!row) continue

            try {
                const result = await sendToDeluge(getDownloadUrl(row.id), 'tv')
                await markEpisodeDownloaded(tmdbId, {
                    season: aired.season,
                    episode,
                    torrentId: row.id,
                    torrentName: row.name,
                })
                downloads.push({ season: aired.season, episode, torrentName: row.name, hash: result.hash })
                console.log(`[Subscriptions] ${label}: sent S${String(aired.season).padStart(2, '0')}E${String(episode).padStart(2, '0')} to Deluge (${row.name})`)
            } catch (error) {
                console.error(`[Subscriptions] ${label}: failed to download episode ${episode}:`, error.message)
            }
        }

        await markSubscriptionChecked(tmdbId)
        return { tmdbId, title: subscription.title, downloads }
    } catch (error) {
        console.error(`[Subscriptions] ${label}: check failed:`, error.message)
        await markSubscriptionChecked(tmdbId, { error: error.message })
        return { tmdbId, title: subscription.title, downloads, error: error.message }
    }
}

let checkRunning = false

/** Check all active subscriptions sequentially. */
export async function checkAllSubscriptions() {
    if (checkRunning) {
        console.log('[Subscriptions] Check already running, skipping')
        return { skipped: true, results: [] }
    }

    checkRunning = true
    try {
        const subscriptions = await getSubscriptions()
        const active = subscriptions.filter(sub => sub.active)
        console.log(`[Subscriptions] Checking ${active.length} active subscription(s)...`)

        const results = []
        for (const subscription of active) {
            results.push(await checkSubscription(subscription))
        }
        return { skipped: false, results }
    } finally {
        checkRunning = false
    }
}
