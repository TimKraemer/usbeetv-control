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
 * All aired episodes across every season, as { season, episode } pairs.
 * Uses last_episode_to_air as the watermark: every episode before/at that
 * point counts as aired (past seasons fully, current season up to last aired).
 */
function getAllAiredEpisodes(tvShowDetails) {
    const lastEpisode = tvShowDetails.last_episode_to_air
    if (!lastEpisode?.season_number || !lastEpisode?.episode_number) return []

    const aired = []
    for (const season of tvShowDetails.seasons || []) {
        const seasonNumber = season.season_number
        if (!seasonNumber || seasonNumber <= 0) continue

        if (seasonNumber < lastEpisode.season_number) {
            const count = season.episode_count || 0
            for (let episode = 1; episode <= count; episode++) {
                aired.push({ season: seasonNumber, episode })
            }
        } else if (seasonNumber === lastEpisode.season_number) {
            for (let episode = 1; episode <= lastEpisode.episode_number; episode++) {
                aired.push({ season: seasonNumber, episode })
            }
        }
    }
    return aired
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

        const airedEpisodes = getAllAiredEpisodes(tvShowDetails)
        if (airedEpisodes.length === 0) {
            await markSubscriptionChecked(tmdbId)
            return { tmdbId, title: subscription.title, downloads, message: 'No aired episodes yet' }
        }

        const episodesInLibrary = await getEpisodesInJellyfin(tmdbId)
        const alreadyDownloaded = new Set(
            subscription.downloaded.map(entry => `${entry.season}:${entry.episode}`)
        )

        const wantedEpisodes = airedEpisodes.filter(({ season, episode }) =>
            !alreadyDownloaded.has(`${season}:${episode}`) &&
            !episodesInLibrary.has(`${season}:${episode}`)
        )

        if (wantedEpisodes.length === 0) {
            if (isEnded) {
                console.log(`[Subscriptions] ${label}: series ended and complete, deactivating subscription`)
                await setSubscriptionActive(tmdbId, false)
            }
            await markSubscriptionChecked(tmdbId)
            return { tmdbId, title: subscription.title, downloads, message: 'Up to date' }
        }

        const wantedKeys = new Set(wantedEpisodes.map(({ season, episode }) => `${season}:${episode}`))
        console.log(`[Subscriptions] ${label}: missing ${wantedEpisodes.length} episode(s): ${[...wantedKeys].join(', ')}`)

        // Best single-episode release per wanted episode (any season)
        const rows = await fetchTorrentsByTmdbId(tmdbId, 'series')
        const bestByEpisode = new Map()
        for (const row of rows) {
            if (!isEpisodeRelease(row)) continue
            const parsed = parseSeasonEpisode(row.name)
            if (!parsed?.episode) continue
            const key = `${parsed.season}:${parsed.episode}`
            if (!wantedKeys.has(key)) continue
            // Only auto-download releases matching the subscribed language
            if (!matchesLanguage(row, language, originalLanguage)) continue

            const existing = bestByEpisode.get(key)
            if (!existing || rankTorrent(row) > rankTorrent(existing)) {
                bestByEpisode.set(key, row)
            }
        }

        for (const { season, episode } of wantedEpisodes) {
            const key = `${season}:${episode}`
            const row = bestByEpisode.get(key)
            if (!row) continue

            try {
                const result = await sendToDeluge(getDownloadUrl(row.id), 'tv')
                await markEpisodeDownloaded(tmdbId, {
                    season,
                    episode,
                    torrentId: row.id,
                    torrentName: row.name,
                })
                downloads.push({ season, episode, torrentName: row.name, hash: result.hash })
                console.log(`[Subscriptions] ${label}: sent S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')} to Deluge (${row.name})`)
            } catch (error) {
                console.error(`[Subscriptions] ${label}: failed to download S${season}E${episode}:`, error.message)
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
