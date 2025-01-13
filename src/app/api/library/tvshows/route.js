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

async function fetchFromTMDB(tmdbId) {
    const url = `http://api.themoviedb.org/3/tv/${tmdbId}/seasons?api_key=${process.env.TMDB_API_KEY}`
    const response = await fetch(url, {
        headers: {
            'Content-Type': 'application/json',
        },
    })

    if (!response.ok) {
        throw new Error(`Failed to fetch data from TMDB: ${response.statusText}`)
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
            return NextResponse.json({ status: 'not existing', seasons: [] })
        }

        const seasonsData = await fetchFromJellyfin('/Items', `?ParentId=${matchedSeries.Id}&IncludeItemTypes=Season`)
        const seasons = seasonsData.Items || []

        const allSeasonsData = await fetchFromTMDB(tmdbId)
        const allSeasons = allSeasonsData.Items || []

        if (allSeasons.length !== seasons.length) {
            const missingSeasons = allSeasons.filter(season => !seasons.some(s => s.Id === season.Id))
            return NextResponse.json({ status: 'not all seasons available', missingSeasons: missingSeasons.map(season => season.IndexNumber) })
        }

        const seasonStatus = await getSeasonStatus(seasons)

        return NextResponse.json({ status: 'exists', seasons: seasonStatus, allSeasons })
    } catch (error) {
        console.error('Error checking TV series:', error)
        return NextResponse.json({ error: 'Failed to check TV series' }, { status: 500 })
    }
}
