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
export async function getLibraryItems(type) {
    const query = ITEM_QUERIES[type]
    if (!query) throw new Error(`Unsupported library item type: ${type}`)

    const cached = libraryCache.get(type)
    const now = Date.now()
    if (cached?.items && cached.expiresAt > now) return cached.items
    if (cached?.inflight) return cached.inflight

    const inflight = fetchFromJellyfin('/Items', query)
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
const DAY_MS = 24 * 60 * 60 * 1000

// Jellyfin keeps only the last play date per user and item, so the time
// windows count users/episodes whose last play falls into the window.
const WATCH_RANKING_PERIODS = { all: null, year: 365, month: 30, week: 7 }

const PLAYED_ITEMS_QUERY =
    '?Recursive=true&IncludeItemTypes=Movie,Episode&Filters=IsPlayed&EnableUserData=true&EnableImages=false&Fields=SeriesId'

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

async function buildWatchRanking() {
    const [users, libraryMovies, librarySeries] = await Promise.all([
        fetchFromJellyfin('/Users'),
        getLibraryItems('Movie'),
        getLibraryItems('Series'),
    ])
    const now = Date.now()

    // Start with the whole library so never-watched titles can be looked up too
    const movies = new Map()
    for (const item of libraryMovies) {
        movies.set(item.Id, { id: item.Id, title: item.Name, year: item.ProductionYear || null, stats: emptyStats() })
    }
    const series = new Map()
    for (const item of librarySeries) {
        series.set(item.Id, { id: item.Id, title: item.Name, year: item.ProductionYear || null, stats: emptyStats() })
    }

    for (const user of users) {
        const data = await fetchFromJellyfin(`/Users/${user.Id}/Items`, PLAYED_ITEMS_QUERY, 'GET', null, WATCH_RANKING_TIMEOUT_MS)
        const seriesSeenByUser = new Set() // "seriesId:period"

        for (const item of data.Items || []) {
            const periods = matchingPeriods(item.UserData?.LastPlayedDate, now)

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

    return {
        movies: [...movies.values()],
        series: [...series.values()],
        userCount: users.length,
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
    if (cached?.inflight) return cached.inflight

    const inflight = buildWatchRanking()
        .then(data => {
            globalThis.__jellyfinWatchRanking = { data, expiresAt: Date.now() + WATCH_RANKING_CACHE_TTL_MS, inflight: null }
            return data
        })
        .catch(error => {
            globalThis.__jellyfinWatchRanking = { data: cached?.data || null, expiresAt: 0, inflight: null }
            throw error
        })

    globalThis.__jellyfinWatchRanking = { data: cached?.data || null, expiresAt: 0, inflight }
    return inflight
}
