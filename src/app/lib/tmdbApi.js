const TMDB_BASE_URL = 'https://api.themoviedb.org/3'
const TMDB_TIMEOUT_MS = 8000
const DETAILS_CACHE_TTL_MS = 5 * 60 * 1000

const detailsCache = new Map() // key -> { value, expiresAt }

function getApiKey() {
    if (!process.env.TMDB_API_KEY) {
        throw new Error('TMDB_API_KEY environment variable is not set')
    }
    return process.env.TMDB_API_KEY
}

/** GET a TMDB endpoint with proper query encoding and a timeout. */
export async function fetchTmdb(path, params = {}, { timeoutMs = TMDB_TIMEOUT_MS } = {}) {
    const url = new URL(`${TMDB_BASE_URL}${path}`)
    url.searchParams.set('api_key', getApiKey())
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value)
    }

    const response = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(timeoutMs),
    })
    if (!response.ok) {
        const error = new Error(`TMDB returned ${response.status}: ${response.statusText}`)
        error.status = response.status
        throw error
    }
    return response.json()
}

async function cachedDetails(key, loader) {
    const cached = detailsCache.get(key)
    if (cached && cached.expiresAt > Date.now()) return cached.value
    const value = await loader()
    detailsCache.set(key, { value, expiresAt: Date.now() + DETAILS_CACHE_TTL_MS })
    return value
}

/** Full TV show details (seasons, status, last/next episode, original language). */
export function getTvShowDetails(tmdbId) {
    return cachedDetails(`tv:${tmdbId}`, () => fetchTmdb(`/tv/${tmdbId}`))
}

export function getMovieDetails(tmdbId) {
    return cachedDetails(`movie:${tmdbId}`, () => fetchTmdb(`/movie/${tmdbId}`))
}

/** Original language of a title, or null if TMDB is unavailable. */
export async function getOriginalLanguage(type, tmdbId) {
    if (!process.env.TMDB_API_KEY) return null
    try {
        const details = type === 'tv' ? await getTvShowDetails(tmdbId) : await getMovieDetails(tmdbId)
        return details.original_language || null
    } catch (error) {
        console.warn(`[TMDB] Could not load original language for ${type} ${tmdbId}: ${error.message}`)
        return null
    }
}

export function searchTmdb(type, query, language) {
    return fetchTmdb(`/search/${type}`, { query, language })
}

export function getWatchProviders(type, tmdbId) {
    return fetchTmdb(`/${type}/${tmdbId}/watch/providers`)
}
