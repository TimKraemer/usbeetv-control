import { NextResponse } from 'next/server'

// Temporarily disable SSL certificate verification for development
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

async function fetchFromJellyfin(endpoint, queryParams = '') {
    // Validate environment variables
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
            // Add timeout to prevent hanging requests
            signal: AbortSignal.timeout(10000) // 10 second timeout
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
            throw new Error(`Cannot connect to Jellyfin at ${process.env.JELLYFIN_HOST}:${process.env.JELLYFIN_PORT}. Please check if Jellyfin is running and the host/port are correct.`)
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
            signal: AbortSignal.timeout(5000) // 5 second timeout
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

export async function GET(req) {
    const { searchParams } = new URL(req.url)
    const tmdbId = searchParams.get('tmdbId')
    if (!tmdbId) {
        return NextResponse.json({ error: 'TMDB ID is required' }, { status: 400 })
    }
    try {
        const seriesData = await fetchFromJellyfin('/Items', '?Recursive=true&IncludeItemTypes=Series&Fields=ProviderIds')
        const series = seriesData.Items || []
        const matchedSeries = await getMatchedSeries(series, tmdbId)
        if (!matchedSeries) {
            return NextResponse.json({ exists: false })
        }
        const exists = true
        const tvShowDetails = await fetchTVShowDetailsFromTMDB(tmdbId)
        const isEnded = tvShowDetails.status === 'Ended'
        const totalSeasons = tvShowDetails.number_of_seasons
        const allSeasons = tvShowDetails.seasons || []
        const currentSeason = isEnded ? null : allSeasons.find(season => season.season_number === tvShowDetails.next_episode_to_air?.season_number) || null
        const lastAiredSeasonNumber = tvShowDetails.last_episode_to_air?.season_number
        const completelyAiredSeasons = []
        for (let i = 1; i < lastAiredSeasonNumber; i++) {
            completelyAiredSeasons.push(i)
        }
        if (isEnded || currentSeason === null || tvShowDetails.last_episode_to_air?.episode_number === currentSeason?.episode_count) {
            completelyAiredSeasons.push(lastAiredSeasonNumber)
        }
        const incompleteSeason = tvShowDetails.next_episode_to_air?.season_number || null
        const airedEpisodesOfIncompleteSeason = []
        if (incompleteSeason) {
            for (let i = 1; i < tvShowDetails.next_episode_to_air.episode_number; i++) {
                airedEpisodesOfIncompleteSeason.push(i)
            }
        }
        const seasonsData = await fetchFromJellyfin('/Items', `?ParentId=${matchedSeries.Id}&IncludeItemTypes=Season`)
        const dbSeasons = seasonsData.Items || []
        const seasonStatus = await getSeasonStatus(dbSeasons)
        const missingSeasons = allSeasons.filter(season => season.season_number > 0 && season.episode_count > 0 && !seasonStatus.some(s => s.season === season.season_number)) || []
        return NextResponse.json({
            isEnded,
            totalSeasons,
            completelyAiredSeasons,
            airedEpisodesOfIncompleteSeason,
            missingSeasons,
            exists
        })
    } catch (error) {
        console.error('[ERROR] Failed to check TV series:', error.message)
        return NextResponse.json({
            error: `Failed to check TV series: ${error.message}`,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }, { status: 500 })
    }
}
