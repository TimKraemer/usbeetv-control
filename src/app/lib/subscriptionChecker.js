import { findSeriesByTmdbId, getSeriesEpisodeKeys } from '@/app/lib/jellyfinApi'
import { sendToDeluge } from '@/app/lib/sendToDeluge'
import {
    getSubscriptions,
    markEpisodeDownloaded,
    markSubscriptionChecked,
    setSubscriptionActive,
} from '@/app/lib/subscriptionStore'
import { getTvShowDetails } from '@/app/lib/tmdbApi'
import {
    fetchTorrentsByTmdbId,
    getDownloadUrl,
    isDolbyVision,
    isEpisodeRelease,
    matchesLanguage,
    parseSeasonEpisode,
    pickBestByKey,
    sortTorrents,
} from '@/app/lib/tsApi'

/**
 * Episodes (as "S:E" strings) that physically exist in Jellyfin for a series.
 * Virtual items (missing/unaired placeholders) are excluded.
 */
async function getEpisodesInJellyfin(tmdbId) {
    const matchedSeries = await findSeriesByTmdbId(tmdbId)
    if (!matchedSeries) return new Set()
    return getSeriesEpisodeKeys(matchedSeries.Id)
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
        const tvShowDetails = await getTvShowDetails(tmdbId)
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

        // Best single-episode release per wanted episode (any season).
        // Only releases matching the subscribed language are auto-downloaded;
        // sortTorrents puts Dolby Vision releases last so they are only used
        // when no other release of that episode exists.
        const rows = await fetchTorrentsByTmdbId(tmdbId, 'series')
        const candidates = rows.filter(row =>
            isEpisodeRelease(row) && matchesLanguage(row, language, originalLanguage)
        )
        const sortedRows = sortTorrents(candidates, { userLanguage: language, originalLanguage })
        const bestByEpisode = pickBestByKey(sortedRows, row => {
            const parsed = parseSeasonEpisode(row.name)
            if (!parsed?.episode) return null
            const key = `${parsed.season}:${parsed.episode}`
            return wantedKeys.has(key) ? key : null
        })

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
                const dvNote = isDolbyVision(row) ? ' [Dolby Vision, no alternative]' : ''
                console.log(`[Subscriptions] ${label}: sent S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')} to Deluge (${row.name})${dvNote}`)
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
