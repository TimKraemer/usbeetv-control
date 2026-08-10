import { NextResponse } from 'next/server'

// Temporarily disable SSL certificate verification for development
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const JELLYFIN_TIMEOUT_MS = 5000
const TMDB_TIMEOUT_MS = 4000
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 1000

async function fetchJsonWithRetry(url, options = {}, {
    timeoutMs,
    label,
} = {}) {
    let lastError

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const response = await fetch(url, {
                ...options,
                signal: AbortSignal.timeout(timeoutMs),
            })

            if (!response.ok) {
                throw new Error(`${label} returned ${response.status}: ${response.statusText}`)
            }

            return await response.json()
        } catch (error) {
            lastError = error
            const isTimeout = error.name === 'TimeoutError' || error.name === 'AbortError'
            console.warn(`[${label}] Attempt ${attempt}/${MAX_RETRIES} failed: ${error.message}`)

            if (attempt < MAX_RETRIES) {
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS))
                continue
            }

            if (isTimeout) {
                throw new Error(`Request to ${label} timed out after ${timeoutMs}ms (${MAX_RETRIES} attempts)`)
            }
        }
    }

    throw lastError
}

async function fetchFromJellyfin(endpoint, queryParams = '') {
    if (!process.env.JELLYFIN_HOST) {
        throw new Error('JELLYFIN_HOST environment variable is not set')
    }
    if (!process.env.JELLYFIN_PORT) {
        throw new Error('JELLYFIN_PORT environment variable is not set')
    }
    if (!process.env.JELLYFIN_API_KEY) {
        throw new Error('JELLYFIN_API_KEY environment variable is not set')
    }

    const url = `https://${process.env.JELLYFIN_HOST}:${process.env.JELLYFIN_PORT}${endpoint}${queryParams}`

    try {
        return await fetchJsonWithRetry(url, {
            headers: {
                'X-Emby-Token': process.env.JELLYFIN_API_KEY,
            },
        }, {
            timeoutMs: JELLYFIN_TIMEOUT_MS,
            label: 'Jellyfin',
        })
    } catch (error) {
        if (error.code === 'ECONNREFUSED') {
            throw new Error(`Cannot connect to Jellyfin at ${process.env.JELLYFIN_HOST}:${process.env.JELLYFIN_PORT}. Please check if Jellyfin is running and the host/port are correct.`)
        }
        throw error
    }
}

async function fetchTVShowDetailsFromTMDB(tmdbId) {
    if (!process.env.TMDB_API_KEY) {
        throw new Error('TMDB_API_KEY environment variable is not set')
    }

    const url = `https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${process.env.TMDB_API_KEY}`

    return fetchJsonWithRetry(url, {
        headers: {
            'Content-Type': 'application/json',
        },
    }, {
        timeoutMs: TMDB_TIMEOUT_MS,
        label: 'TMDB',
    })
}

export async function POST(request) {
    try {
        const body = await request.json()
        const { items } = body

        if (!Array.isArray(items) || items.length === 0) {
            return NextResponse.json({ error: 'Items array is required' }, { status: 400 })
        }

        // Fetch all movies and TV shows from Jellyfin in parallel
        const [moviesData, seriesData] = await Promise.all([
            fetchFromJellyfin('/Items', '?Recursive=true&IncludeItemTypes=Movie&Fields=ProviderIds&Filters=IsNotFolder'),
            fetchFromJellyfin('/Items', '?Recursive=true&IncludeItemTypes=Series&Fields=ProviderIds')
        ])

        const movies = moviesData.Items || []
        const series = seriesData.Items || []

        // Create maps for quick lookup (using string keys for consistency)
        const movieMap = new Map()
        for (const movie of movies) {
            if (movie.ProviderIds?.Tmdb) {
                movieMap.set(movie.ProviderIds.Tmdb.toString(), movie)
            }
        }

        const seriesMap = new Map()
        for (const s of series) {
            if (s.ProviderIds?.Tmdb) {
                seriesMap.set(s.ProviderIds.Tmdb.toString(), s)
            }
        }

        // Process all items in parallel
        const results = await Promise.all(
            items.map(async ({ tmdbId, type }) => {
                try {
                    if (type === 'movie') {
                        const exists = movieMap.has(tmdbId)
                        return {
                            tmdbId,
                            type,
                            exists,
                            isComplete: exists
                        }
                    }

                    if (type === 'tv') {
                        const matchedSeries = seriesMap.get(tmdbId)
                        if (!matchedSeries) {
                            return {
                                tmdbId,
                                type,
                                exists: false,
                                isComplete: false
                            }
                        }

                        // Compare season presence only — no per-season episode scans
                        const [tvShowDetails, seasonsData] = await Promise.all([
                            fetchTVShowDetailsFromTMDB(tmdbId),
                            fetchFromJellyfin('/Items', `?ParentId=${matchedSeries.Id}&IncludeItemTypes=Season`)
                        ])

                        const dbSeasonNumbers = new Set(
                            (seasonsData.Items || []).map(season => season.IndexNumber)
                        )
                        const allSeasons = tvShowDetails.seasons || []
                        const missingSeasons = allSeasons.filter(season =>
                            season.season_number > 0
                            && season.episode_count > 0
                            && !dbSeasonNumbers.has(season.season_number)
                        )

                        return {
                            tmdbId,
                            type,
                            exists: true,
                            isComplete: missingSeasons.length === 0
                        }
                    }

                    return {
                        tmdbId,
                        type,
                        exists: false,
                        isComplete: false
                    }
                } catch (error) {
                    console.error(`[ERROR] Failed to check ${type} ${tmdbId}:`, error.message)
                    return {
                        tmdbId,
                        type,
                        exists: false,
                        isComplete: false,
                        error: error.message
                    }
                }
            })
        )

        // Convert to map for easy lookup
        const resultMap = {}
        for (const result of results) {
            resultMap[result.tmdbId] = {
                exists: result.exists,
                isComplete: result.isComplete
            }
        }

        return NextResponse.json(resultMap)
    } catch (error) {
        console.error('[ERROR] Failed to batch check library:', error.message)
        return NextResponse.json({
            error: `Failed to batch check library: ${error.message}`,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }, { status: 500 })
    }
}
