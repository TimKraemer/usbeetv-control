import { NextResponse } from 'next/server'

async function fetchFromJellyfin(endpoint, queryParams = '') {
    const url = `http://${process.env.JELLYFIN_HOST}:${process.env.JELLYFIN_PORT}${endpoint}${queryParams}`
    const response = await fetch(url, {
        headers: {
            'X-Emby-Token': process.env.JELLYFIN_API_KEY,
        },
    })

    if (!response.ok) {
        throw new Error(`Failed to fetch data from Jellyfin: ${response.statusText}`)
    }

    return response.json()
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
        const episodesData = await fetchFromJellyfin('/Items', `?ParentId=${season.Id}&IncludeItemTypes=Episode&Filters=IsMissing,IsUnaired`)
        const missingEpisodes = episodesData.Items || []

        seasonStatus.push({
            season: season.IndexNumber,
            status: missingEpisodes.length === 0 ? 'complete' : 'episodes missing',
        })
    }
    return seasonStatus
}

async function fetchTVShowDetailsFromTMDB(tmdbId) {
    const url = `https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${process.env.TMDB_API_KEY}`
    const response = await fetch(url, {
        headers: {
            'Content-Type': 'application/json',
        },
    })

    if (!response.ok) {
        throw new Error(`Failed to fetch TV show details from TMDB: ${response.statusText}`)
    }

    return response.json()
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
        console.error('Error checking TV series:', error)
        return NextResponse.json({ error: `Failed to check TV series: ${error}` }, { status: 500 })
    }
}
