import {
    fetchTorrentsByTmdbId,
    isSeasonPack,
    parseSeasonEpisode,
    rankTorrent,
    sortTorrents,
} from '@/app/lib/tsApi'
import { NextResponse } from 'next/server'

const JELLYFIN_TIMEOUT_MS = 5000
const TMDB_TIMEOUT_MS = 4000
const LIBRARY_MAX_RETRIES = 3
const LIBRARY_RETRY_DELAY_MS = 1000

async function fetchJsonWithRetry(url, options = {}, { timeoutMs, label } = {}) {
    let lastError

    for (let attempt = 1; attempt <= LIBRARY_MAX_RETRIES; attempt++) {
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
            console.warn(`[${label}] Attempt ${attempt}/${LIBRARY_MAX_RETRIES} failed: ${error.message}`)

            if (attempt < LIBRARY_MAX_RETRIES) {
                await new Promise(resolve => setTimeout(resolve, LIBRARY_RETRY_DELAY_MS))
                continue
            }

            if (isTimeout) {
                throw new Error(`Request to ${label} timed out after ${timeoutMs}ms (${LIBRARY_MAX_RETRIES} attempts)`)
            }
            throw error
        }
    }

    throw lastError
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
            throw new Error(`Cannot connect to Jellyfin at ${process.env.JELLYFIN_HOST}:${process.env.JELLYFIN_PORT}`)
        }
        throw error
    }
}

async function getMatchedSeries(series, tmdbId) {
    for (const item of series) {
        if (item.ProviderIds?.Tmdb === tmdbId) {
            return item
        }
    }
    return null
}

async function getSeasonStatus(seasons) {
    const seasonStatus = []
    for (const season of seasons) {
        try {
            const episodesData = await fetchFromJellyfin('/Items', `?ParentId=${season.Id}&IncludeItemTypes=Episode&Filters=IsMissing,IsUnaired`)
            const missingEpisodes = episodesData.Items || []
            seasonStatus.push({
                season: season.IndexNumber,
                status: missingEpisodes.length === 0 ? 'complete' : 'episodes missing',
                missingCount: missingEpisodes.length
            })
        } catch (error) {
            seasonStatus.push({
                season: season.IndexNumber,
                status: 'error',
                error: error.message
            })
        }
    }
    return seasonStatus
}

export async function GET(request) {
    const { searchParams } = new URL(request.url)
    const tmdbId = searchParams.get('tmdbId')
    const language = searchParams.get('language') || 'de-DE'

    if (!tmdbId) {
        return NextResponse.json({ error: 'TMDB ID is required' }, { status: 400 })
    }

    try {
        // Get TV show details from TMDB
        const tvShowDetails = await fetchTVShowDetailsFromTMDB(tmdbId)
        const isEnded = tvShowDetails.status === 'Ended'
        const totalSeasons = tvShowDetails.number_of_seasons
        const allSeasons = tvShowDetails.seasons || []
        const originalLanguage = tvShowDetails.original_language || null

        // Get library status
        const seriesData = await fetchFromJellyfin('/Items', '?Recursive=true&IncludeItemTypes=Series&Fields=ProviderIds')
        const series = seriesData.Items || []
        const matchedSeries = await getMatchedSeries(series, tmdbId)

        let existingSeasons = []
        let missingSeasons = []

        if (matchedSeries) {
            const seasonsData = await fetchFromJellyfin('/Items', `?ParentId=${matchedSeries.Id}&IncludeItemTypes=Season`)
            const dbSeasons = seasonsData.Items || []
            const seasonStatus = await getSeasonStatus(dbSeasons)

            existingSeasons = seasonStatus.map(s => s.season)
            missingSeasons = allSeasons
                .filter(season => season.season_number > 0 && season.episode_count > 0)
                .filter(season => !existingSeasons.includes(season.season_number))
                .map(season => season.season_number)
        } else {
            // Show doesn't exist in library, all seasons are missing
            missingSeasons = allSeasons
                .filter(season => season.season_number > 0 && season.episode_count > 0)
                .map(season => season.season_number)
        }

        // Get available torrents via TS APIv2
        const rows = await fetchTorrentsByTmdbId(tmdbId, 'series')
        const sortedRows = sortTorrents(rows, { userLanguage: language, originalLanguage })

        // Group torrents by season: full-season packs on one hand,
        // individual episode releases on the other
        const seasonPackMap = new Map()
        const episodeMap = new Map() // season -> Map(episode -> row)
        for (const row of sortedRows) {
            const parsed = parseSeasonEpisode(row.name)
            if (!parsed) continue

            if (parsed.episode === null) {
                if (!isSeasonPack(row)) continue
                const existing = seasonPackMap.get(parsed.season)
                if (!existing || rankTorrent(row) > rankTorrent(existing)) {
                    seasonPackMap.set(parsed.season, row)
                }
            } else {
                if (!episodeMap.has(parsed.season)) episodeMap.set(parsed.season, new Map())
                const episodes = episodeMap.get(parsed.season)
                const existing = episodes.get(parsed.episode)
                if (!existing || rankTorrent(row) > rankTorrent(existing)) {
                    episodes.set(parsed.episode, row)
                }
            }
        }

        // Build season availability data
        const availableSeasons = []
        for (const season of allSeasons) {
            if (season.season_number > 0 && season.episode_count > 0) {
                const seasonNumber = season.season_number
                const torrentRow = seasonPackMap.get(seasonNumber)
                const existsInLibrary = existingSeasons.includes(seasonNumber)
                const isMissing = missingSeasons.includes(seasonNumber)
                const availableEpisodes = [...(episodeMap.get(seasonNumber)?.keys() || [])].sort((a, b) => a - b)

                availableSeasons.push({
                    seasonNumber,
                    name: season.name,
                    episodeCount: season.episode_count,
                    airDate: season.air_date,
                    existsInLibrary,
                    isMissing,
                    hasTorrent: !!torrentRow,
                    availableEpisodes,
                    availableEpisodeCount: availableEpisodes.length,
                    torrentInfo: torrentRow ? {
                        id: torrentRow.id,
                        name: torrentRow.name,
                        size: torrentRow.size,
                        seeders: torrentRow.seeders,
                        added: torrentRow.added,
                        tags: torrentRow.tags
                    } : null
                })
            }
        }

        return NextResponse.json({
            showInfo: {
                name: tvShowDetails.name,
                isEnded,
                totalSeasons,
                exists: !!matchedSeries,
                originalLanguage
            },
            seasons: availableSeasons
        })

    } catch (error) {
        return NextResponse.json({ error: `Error fetching season data: ${error.message}` }, { status: 500 })
    }
}
