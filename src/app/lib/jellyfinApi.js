import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { Agent, fetch as undiciFetch } from 'undici'

const JELLYFIN_TIMEOUT_MS = 5000
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 1000
const LIBRARY_CACHE_TTL_MS = 60000

// Jellyfin runs with a self-signed certificate on the LAN. Only this agent
// skips verification; every other outbound request keeps TLS checks.
const jellyfinAgent = new Agent({
    connect: { rejectUnauthorized: false },
})

function getBaseUrl() {
    if (!process.env.JELLYFIN_HOST) {
        throw new Error('JELLYFIN_HOST environment variable is not set')
    }
    if (!process.env.JELLYFIN_PORT) {
        throw new Error('JELLYFIN_PORT environment variable is not set')
    }
    if (!process.env.JELLYFIN_API_KEY) {
        throw new Error('JELLYFIN_API_KEY environment variable is not set')
    }
    return `https://${process.env.JELLYFIN_HOST}:${process.env.JELLYFIN_PORT}`
}

/**
 * Call the Jellyfin REST API with timeout and retries.
 * Returns parsed JSON, or { success: true } for empty 204 responses.
 */
export async function fetchFromJellyfin(endpoint, queryParams = '', method = 'GET', body = null, timeoutMs = JELLYFIN_TIMEOUT_MS) {
    const url = `${getBaseUrl()}${endpoint}${queryParams}`
    let lastError

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const options = {
                method,
                headers: {
                    'X-Emby-Token': process.env.JELLYFIN_API_KEY,
                    'Content-Type': 'application/json',
                },
                signal: AbortSignal.timeout(timeoutMs),
                dispatcher: jellyfinAgent,
            }
            if (body && method !== 'GET') {
                options.body = JSON.stringify(body)
            }

            const response = await undiciFetch(url, options)
            if (!response.ok) {
                throw new Error(`Jellyfin API returned ${response.status}: ${response.statusText}`)
            }
            if (response.status === 204) {
                return { success: true }
            }
            return await response.json()
        } catch (error) {
            lastError = error
            const isTimeout = error.name === 'TimeoutError' || error.name === 'AbortError'
            console.warn(`[Jellyfin] Attempt ${attempt}/${MAX_RETRIES} failed: ${error.message}`)

            if (attempt < MAX_RETRIES) {
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS))
                continue
            }
            if (isTimeout) {
                throw new Error(`Request to Jellyfin timed out after ${timeoutMs}ms (${MAX_RETRIES} attempts)`)
            }
            if (error.code === 'ECONNREFUSED' || error.cause?.code === 'ECONNREFUSED') {
                throw new Error(`Cannot connect to Jellyfin at ${process.env.JELLYFIN_HOST}:${process.env.JELLYFIN_PORT}. Please check if Jellyfin is running and the host/port are correct.`)
            }
            throw error
        }
    }

    throw lastError
}

// ---------------------------------------------------------------------------
// Library item cache: the full movie/series lists are requested on every
// search keystroke (batch library check), so share them across requests for
// a short window and dedupe concurrent fetches.
// ---------------------------------------------------------------------------

const ITEM_QUERIES = {
    Movie: '?Recursive=true&IncludeItemTypes=Movie&Fields=ProviderIds&Filters=IsNotFolder',
    Series: '?Recursive=true&IncludeItemTypes=Series&Fields=ProviderIds',
}

const libraryCache = new Map() // type -> { items, expiresAt, inflight }

export function invalidateLibraryCache() {
    libraryCache.clear()
}

/** All library items of a type (Movie | Series), cached for a short TTL. */
export async function getLibraryItems(type, timeoutMs = JELLYFIN_TIMEOUT_MS) {
    const query = ITEM_QUERIES[type]
    if (!query) throw new Error(`Unsupported library item type: ${type}`)

    const cached = libraryCache.get(type)
    const now = Date.now()
    if (cached?.items && cached.expiresAt > now) return cached.items
    if (cached?.inflight) return cached.inflight

    const inflight = fetchFromJellyfin('/Items', query, 'GET', null, timeoutMs)
        .then(data => {
            const items = data.Items || []
            libraryCache.set(type, { items, expiresAt: Date.now() + LIBRARY_CACHE_TTL_MS, inflight: null })
            return items
        })
        .catch(error => {
            libraryCache.delete(type)
            throw error
        })

    libraryCache.set(type, { items: cached?.items || null, expiresAt: 0, inflight })
    return inflight
}

/** Map of TMDB id (string) -> item for a library type. */
export async function getLibraryItemsByTmdbId(type) {
    const items = await getLibraryItems(type)
    const map = new Map()
    for (const item of items) {
        const tmdbId = item.ProviderIds?.Tmdb
        if (tmdbId) map.set(String(tmdbId), item)
    }
    return map
}

export async function findMovieByTmdbId(tmdbId) {
    const map = await getLibraryItemsByTmdbId('Movie')
    return map.get(String(tmdbId)) || null
}

export async function findSeriesByTmdbId(tmdbId) {
    const map = await getLibraryItemsByTmdbId('Series')
    return map.get(String(tmdbId)) || null
}

/** Season numbers that exist under a series (as Jellyfin knows them). */
export async function getSeriesSeasonNumbers(seriesId) {
    const data = await fetchFromJellyfin('/Items', `?ParentId=${seriesId}&IncludeItemTypes=Season`)
    return (data.Items || [])
        .map(season => season.IndexNumber)
        .filter(number => Number.isInteger(number))
}

/**
 * Episodes (as "S:E" strings) that physically exist for a series.
 * Virtual items (missing/unaired placeholders) are excluded.
 */
export async function getSeriesEpisodeKeys(seriesId) {
    const data = await fetchFromJellyfin(
        '/Items',
        `?ParentId=${seriesId}&Recursive=true&IncludeItemTypes=Episode&Fields=LocationType,ParentIndexNumber,IndexNumber`
    )
    const present = new Set()
    for (const episode of data.Items || []) {
        if (episode.LocationType === 'Virtual') continue
        if (episode.ParentIndexNumber == null || episode.IndexNumber == null) continue
        present.add(`${episode.ParentIndexNumber}:${episode.IndexNumber}`)
    }
    return present
}

// ---------------------------------------------------------------------------
// Library scan
// ---------------------------------------------------------------------------

function getScanCooldownMs() {
    const seconds = Number.parseInt(process.env.LIBRARY_SCAN_COOLDOWN_SECONDS || '300', 10)
    return Math.max(1, seconds || 300) * 1000
}

export function getLibraryScanCooldown() {
    const lastAt = globalThis.__jellyfinScanCooldown?.lastAt || 0
    const cooldownMs = getScanCooldownMs()
    const remainingMs = Math.max(0, lastAt + cooldownMs - Date.now())
    return { lastAt, remainingMs, cooldownMs }
}

export async function triggerLibraryScan() {
    try {
        const cooldown = getLibraryScanCooldown()
        if (cooldown.remainingMs > 0) {
            return { success: true, skipped: true, ...cooldown }
        }

        // Trigger a scan of all libraries using the official Library/Refresh endpoint
        // Note: Jellyfin's API doesn't support scanning specific libraries only
        const result = await fetchFromJellyfin('/Library/Refresh', '', 'POST')
        globalThis.__jellyfinScanCooldown = { lastAt: Date.now() }
        invalidateLibraryCache()
        console.info('[INFO] Jellyfin library scan triggered successfully')
        return { ...result, success: true, skipped: false, ...getLibraryScanCooldown() }
    } catch (error) {
        console.error('[ERROR] Failed to trigger Jellyfin library scan:', error.message)
        throw error
    }
}

export async function getLibraryFolders() {
    try {
        const result = await fetchFromJellyfin('/Library/VirtualFolders')
        console.info('[INFO] Retrieved library folders from Jellyfin')
        return result
    } catch (error) {
        console.error('[ERROR] Failed to get library folders from Jellyfin:', error.message)
        throw error
    }
}

// ---------------------------------------------------------------------------
// Watch ranking: Jellyfin only stores play data per user, so the ranking is
// built by reading every user's played items and adding them up.
// ---------------------------------------------------------------------------

const WATCH_RANKING_CACHE_TTL_MS = 10 * 60 * 1000
const WATCH_RANKING_TIMEOUT_MS = 20000
const WATCH_RANKING_CONCURRENCY = 6
const DAY_MS = 24 * 60 * 60 * 1000

/** Run an async mapper over items with a limited number of parallel calls. */
async function mapWithConcurrency(items, limit, mapper) {
    const results = new Array(items.length)
    let next = 0
    const worker = async () => {
        while (next < items.length) {
            const index = next++
            results[index] = await mapper(items[index])
        }
    }
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
    return results
}

// "all" comes from Jellyfin's own user data (lifetime, includes titles marked
// as played by hand). The time windows come from the Playback Reporting
// plugin's play history. Without the plugin they fall back to the last play
// date, the only date Jellyfin itself keeps per user and item.
const WATCH_RANKING_PERIODS = { all: null, year: 365, month: 30, week: 7 }

const PLAYED_ITEMS_QUERY =
    '?Recursive=true&IncludeItemTypes=Movie,Episode&Filters=IsPlayed&EnableUserData=true&EnableImages=false&Fields=SeriesId'

// Play history of the Playback Reporting plugin. Its SQL endpoint rejects API
// keys, so the history is read per user and day. Finished days never change
// and are kept on disk, a day is only fetched again when its play count moved.
const PLAYBACK_HISTORY_DAYS = 366
const PLAYBACK_ACTIVITY_DAYS = 400
const MIN_PLAY_SECONDS = { Movie: 600, Episode: 300 }

function normalizeId(id) {
    return String(id || '').replaceAll('-', '').toLowerCase()
}

function localDay(timestamp) {
    const date = new Date(timestamp)
    const pad = number => String(number).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function getPlaybackHistoryPath() {
    return path.join(process.env.DATA_DIR || path.join(process.cwd(), 'data'), 'playback-history.json')
}

async function readPlaybackHistoryCache() {
    try {
        const parsed = JSON.parse(await readFile(getPlaybackHistoryPath(), 'utf8'))
        return parsed && typeof parsed.days === 'object' ? parsed.days : {}
    } catch (error) {
        if (error.code !== 'ENOENT') console.warn(`[Jellyfin] Ignoring unreadable playback history cache: ${error.message}`)
        return {}
    }
}

async function writePlaybackHistoryCache(days) {
    const cachePath = getPlaybackHistoryPath()
    await mkdir(path.dirname(cachePath), { recursive: true })
    const tmpPath = `${cachePath}.tmp`
    await writeFile(tmpPath, JSON.stringify({ days }), 'utf8')
    await rename(tmpPath, cachePath)
}

/**
 * Play history of the last year as rows of { itemId, itemType, userId, day,
 * playedAt, duration }, one per item, user and day. Returns null when the
 * plugin is not available.
 */
async function getPlaybackHistory(now) {
    let activity
    try {
        activity = await fetchFromJellyfin(
            '/user_usage_stats/PlayActivity',
            `?days=${PLAYBACK_ACTIVITY_DAYS}&endDate=${localDay(now)}&filter=Movie,Episode&dataType=count`,
            'GET',
            null,
            WATCH_RANKING_TIMEOUT_MS
        )
        if (!Array.isArray(activity)) throw new Error('unexpected response')
    } catch (error) {
        console.warn(`[Jellyfin] Playback Reporting not available, using last play dates: ${error.message}`)
        return null
    }

    const firstDay = localDay(now - PLAYBACK_HISTORY_DAYS * DAY_MS)
    const cached = await readPlaybackHistoryCache()
    const days = {} // "userId:day" -> { count, items }
    const missing = []
    let since = null

    for (const user of activity) {
        for (const [day, count] of Object.entries(user.user_usage || {})) {
            if (!(count > 0)) continue
            if (!since || day < since) since = day
            if (day < firstDay) continue

            const key = `${user.user_id}:${day}`
            if (cached[key]?.count === count) {
                days[key] = cached[key]
            } else {
                missing.push({ key, userId: user.user_id, day, count })
            }
        }
    }

    await mapWithConcurrency(missing, WATCH_RANKING_CONCURRENCY, async job => {
        const items = await fetchFromJellyfin(`/user_usage_stats/${job.userId}/${job.day}/GetItems`, '?filter=Movie,Episode', 'GET', null, WATCH_RANKING_TIMEOUT_MS)
        days[job.key] = {
            count: job.count,
            items: (Array.isArray(items) ? items : []).map(item => ({
                id: normalizeId(item.Id),
                type: item.Type,
                duration: Number(item.Duration) || 0,
            })),
        }
    })

    if (missing.length > 0) {
        console.info(`[INFO] Fetched playback history for ${missing.length} user days`)
        await writePlaybackHistoryCache(days).catch(error => {
            console.warn(`[Jellyfin] Could not store playback history cache: ${error.message}`)
        })
    }

    // Several entries of one day (pause/resume) add up to one play
    const rows = new Map()
    for (const [key, entry] of Object.entries(days)) {
        const [userId, day] = key.split(':')
        for (const item of entry.items) {
            const rowKey = `${key}:${item.id}`
            const row = rows.get(rowKey) || {
                itemId: item.id,
                itemType: item.type,
                userId: normalizeId(userId),
                day,
                playedAt: new Date(`${day}T12:00:00`).getTime(),
                duration: 0,
            }
            row.duration += item.duration
            rows.set(rowKey, row)
        }
    }

    return { rows: [...rows.values()], since }
}

function emptyStats() {
    const stats = {}
    for (const period of Object.keys(WATCH_RANKING_PERIODS)) stats[period] = { viewers: 0, plays: 0 }
    return stats
}

/** Periods a play date falls into; items without a date only count for "all". */
function matchingPeriods(lastPlayedDate, now) {
    const playedAt = lastPlayedDate ? new Date(lastPlayedDate).getTime() : Number.NaN
    return Object.entries(WATCH_RANKING_PERIODS)
        .filter(([, days]) => days === null || (Number.isFinite(playedAt) && playedAt >= now - days * DAY_MS))
        .map(([period]) => period)
}

/**
 * Fill the time windows from the plugin's play history. Movies count one play
 * per user and day, series count each episode once per user. Very short plays
 * are ignored.
 */
async function applyPlaybackHistory(rows, movies, series, now) {
    const episodes = await fetchFromJellyfin(
        '/Items',
        '?Recursive=true&IncludeItemTypes=Episode&EnableImages=false&EnableUserData=false&Fields=SeriesId',
        'GET',
        null,
        WATCH_RANKING_TIMEOUT_MS
    )
    const seriesIdByEpisode = new Map()
    for (const episode of episodes.Items || []) {
        if (episode.SeriesId) seriesIdByEpisode.set(normalizeId(episode.Id), episode.SeriesId)
    }
    const movieById = new Map([...movies.values()].map(entry => [normalizeId(entry.id), entry]))

    const windows = Object.entries(WATCH_RANKING_PERIODS).filter(([, days]) => days !== null)
    const counted = new Set() // dedupe keys for viewers and episodes

    for (const row of rows) {
        if (row.duration < (MIN_PLAY_SECONDS[row.itemType] || 0)) continue

        const entry = row.itemType === 'Movie'
            ? movieById.get(row.itemId)
            : series.get(seriesIdByEpisode.get(row.itemId))
        if (!entry) continue // item no longer in the library

        for (const [period, days] of windows) {
            if (row.playedAt < now - days * DAY_MS) continue

            const viewerKey = `${period}:${entry.id}:${row.userId}`
            if (!counted.has(viewerKey)) {
                counted.add(viewerKey)
                entry.stats[period].viewers += 1
            }

            if (row.itemType === 'Movie') {
                entry.stats[period].plays += 1
            } else {
                const episodeKey = `${viewerKey}:${row.itemId}`
                if (!counted.has(episodeKey)) {
                    counted.add(episodeKey)
                    entry.stats[period].plays += 1
                }
            }
        }
    }
}

async function buildWatchRanking() {
    const now = Date.now()
    const [users, libraryMovies, librarySeries, history] = await Promise.all([
        fetchFromJellyfin('/Users', '', 'GET', null, WATCH_RANKING_TIMEOUT_MS),
        getLibraryItems('Movie', WATCH_RANKING_TIMEOUT_MS),
        getLibraryItems('Series', WATCH_RANKING_TIMEOUT_MS),
        getPlaybackHistory(now),
    ])

    // Start with the whole library so never-watched titles can be looked up too
    const movies = new Map()
    for (const item of libraryMovies) {
        movies.set(item.Id, { id: item.Id, title: item.Name, year: item.ProductionYear || null, stats: emptyStats() })
    }
    const series = new Map()
    for (const item of librarySeries) {
        series.set(item.Id, { id: item.Id, title: item.Name, year: item.ProductionYear || null, stats: emptyStats() })
    }

    const playedByUser = await mapWithConcurrency(users, WATCH_RANKING_CONCURRENCY, user =>
        fetchFromJellyfin(`/Users/${user.Id}/Items`, PLAYED_ITEMS_QUERY, 'GET', null, WATCH_RANKING_TIMEOUT_MS))

    for (const data of playedByUser) {
        const seriesSeenByUser = new Set() // "seriesId:period"

        for (const item of data.Items || []) {
            const periods = history ? ['all'] : matchingPeriods(item.UserData?.LastPlayedDate, now)

            if (item.Type === 'Movie') {
                if (!movies.has(item.Id)) {
                    movies.set(item.Id, { id: item.Id, title: item.Name, year: item.ProductionYear || null, stats: emptyStats() })
                }
                const entry = movies.get(item.Id)
                for (const period of periods) {
                    entry.stats[period].viewers += 1
                    // Play counts are lifetime totals, inside a window only the last play is known
                    entry.stats[period].plays += period === 'all' ? Math.max(1, item.UserData?.PlayCount || 0) : 1
                }
            } else if (item.Type === 'Episode' && item.SeriesId) {
                if (!series.has(item.SeriesId)) {
                    series.set(item.SeriesId, { id: item.SeriesId, title: item.SeriesName || item.Name, year: null, stats: emptyStats() })
                }
                const entry = series.get(item.SeriesId)
                for (const period of periods) {
                    const seenKey = `${item.SeriesId}:${period}`
                    if (!seriesSeenByUser.has(seenKey)) {
                        seriesSeenByUser.add(seenKey)
                        entry.stats[period].viewers += 1
                    }
                    entry.stats[period].plays += 1
                }
            }
        }
    }

    if (history) {
        await applyPlaybackHistory(history.rows, movies, series, now)
    }

    return {
        movies: [...movies.values()],
        series: [...series.values()],
        userCount: users.length,
        periodSource: history ? 'playback-reporting' : 'last-played',
        historySince: history?.since || null,
        generatedAt: new Date().toISOString(),
    }
}

/**
 * Watch stats for every movie and series across all Jellyfin users, per
 * period (all, year, month, week). viewers = users who played the title,
 * plays = play count (for series: played episodes, once per user).
 */
export async function getWatchRanking() {
    const cached = globalThis.__jellyfinWatchRanking
    if (cached?.data && cached.expiresAt > Date.now()) return cached.data
    // Building takes several seconds: hand out the previous ranking right away
    // and let the refresh finish in the background
    if (cached?.inflight) return cached.data || cached.inflight

    const inflight = buildWatchRanking()
        .then(data => {
            globalThis.__jellyfinWatchRanking = { data, expiresAt: Date.now() + WATCH_RANKING_CACHE_TTL_MS, inflight: null }
            return data
        })
        .catch(error => {
            globalThis.__jellyfinWatchRanking = { data: cached?.data || null, expiresAt: 0, inflight: null }
            // An older ranking beats an error while Jellyfin is slow or down
            if (cached?.data) {
                console.warn(`[Jellyfin] Watch ranking refresh failed, serving previous result: ${error.message}`)
                return cached.data
            }
            throw error
        })

    globalThis.__jellyfinWatchRanking = { data: cached?.data || null, expiresAt: 0, inflight }
    return cached?.data || inflight
}
