import { NextResponse } from 'next/server'

const tagScores = {
    'DL': 1, 'ML': 1,
    'HEVC': 1,
    'HDR10': 1, 'HDR10+': 1,
    'DTS': 1, 'DTSHD': 1, 'DTSHR': 1,
    'Dolby Vision': 1,
}

const blacklist = ['.TS.', 'telesync', ".CAM"]

function rankRow(row) {
    let score = 0
    for (const tag of row.tags) {
        score += tagScores[tag] || 0
    }
    if (row.name.includes('BluRay') || row.name.includes('BDRiP')) {
        score += 1
    }
    return score
}

async function fetchTVShowDetailsFromTMDB(tmdbId) {
    if (!process.env.TMDB_API_KEY) {
        throw new Error('TMDB_API_KEY environment variable is not set')
    }
    const url = `https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${process.env.TMDB_API_KEY}`
    try {
        const response = await fetch(url, {
            headers: {
                'Content-Type': 'application/json',
            },
            signal: AbortSignal.timeout(5000)
        })
        if (!response.ok) {
            throw new Error(`TMDB API returned ${response.status}: ${response.statusText}`)
        }
        const data = await response.json()
        return data
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error('Request to TMDB timed out after 5 seconds')
        }
        throw error
    }
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
        const response = await fetch(url, {
            headers: {
                'X-Emby-Token': process.env.JELLYFIN_API_KEY,
            },
            signal: AbortSignal.timeout(10000)
        })

        if (!response.ok) {
            throw new Error(`Jellyfin API returned ${response.status}: ${response.statusText}`)
        }

        return response.json()
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error('Request to Jellyfin timed out after 10 seconds')
        }
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

        // Get available torrents for each season
        const categories = '55,57'
        let response = await fetch(`${process.env.TS_API_URL}/browse.php?tmdbId=${tmdbId}&apikey=${process.env.TS_API_KEY}&cats=${categories}&release_type=Scene,P2P`)
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)

        let data = await response.json()
        if (data.count === 0) {
            // Retry without release_type filter
            response = await fetch(`${process.env.TS_API_URL}/browse.php?tmdbId=${tmdbId}&apikey=${process.env.TS_API_KEY}&cats=${categories}`)
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
            data = await response.json()
        }

        const filteredRows = data.rows.filter(row =>
            row.trumped === 0 &&
            row.seeders !== 0 &&
            !blacklist.some(term => row.name.toLowerCase().includes(term.toLowerCase()))
        )
        filteredRows.sort((a, b) => rankRow(b) - rankRow(a) || a.added - b.added)

        // Group torrents by season
        const seasonMap = new Map()
        for (const row of filteredRows) {
            const seasonMatch = row.name.match(/S(\d{2})/)
            if (seasonMatch) {
                const seasonNumber = Number.parseInt(seasonMatch[1])
                if (!seasonMap.has(seasonNumber) || rankRow(row) > rankRow(seasonMap.get(seasonNumber))) {
                    seasonMap.set(seasonNumber, row)
                }
            }
        }

        // Build season availability data
        const availableSeasons = []
        for (const season of allSeasons) {
            if (season.season_number > 0 && season.episode_count > 0) {
                const seasonNumber = season.season_number
                const torrentRow = seasonMap.get(seasonNumber)
                const existsInLibrary = existingSeasons.includes(seasonNumber)
                const isMissing = missingSeasons.includes(seasonNumber)

                availableSeasons.push({
                    seasonNumber,
                    name: season.name,
                    episodeCount: season.episode_count,
                    airDate: season.air_date,
                    existsInLibrary,
                    isMissing,
                    hasTorrent: !!torrentRow,
                    torrentInfo: torrentRow ? {
                        id: torrentRow.id,
                        name: torrentRow.name,
                        size: torrentRow.size,
                        seeders: torrentRow.seeders,
                        leechers: torrentRow.leechers,
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
                exists: !!matchedSeries
            },
            seasons: availableSeasons
        })

    } catch (error) {
        return NextResponse.json({ error: `Error fetching season data: ${error.message}` }, { status: 500 })
    }
} 