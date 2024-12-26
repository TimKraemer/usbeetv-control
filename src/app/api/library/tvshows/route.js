import { NextResponse } from 'next/server'

export async function GET(req) {
    const { searchParams } = new URL(req.url)
    const tmdbId = searchParams.get('tmdbId')

    if (!tmdbId) {
        return NextResponse.json({ error: 'TMDB ID is required' }, { status: 400 })
    }

    try {
        // Fetch all series from Jellyfin
        const response = await fetch(
            `http://${process.env.JELLYFIN_HOST}:${process.env.JELLYFIN_PORT}/Items?Recursive=true&IncludeItemTypes=Series&Fields=ProviderIds`,
            {
                headers: {
                    'X-Emby-Token': process.env.JELLYFIN_API_KEY,
                },
            }
        )

        if (!response.ok) {
            throw new Error('Failed to fetch data from Jellyfin')
        }

        const data = await response.json()
        const series = data.Items || []


        // Find the series with the matching TMDB ID
        const matchedSeries = series.find(item => item.ProviderIds?.Tmdb === tmdbId)

        if (!matchedSeries) {
            return NextResponse.json({ status: 'not existing', seasons: [] })
        }

        // Fetch all seasons of the matched series
        const seasonsResponse = await fetch(
            `http://${process.env.JELLYFIN_HOST}:${process.env.JELLYFIN_PORT}/Items?ParentId=${matchedSeries.Id}&IncludeItemTypes=Season`,
            {
                headers: {
                    'X-Emby-Token': process.env.JELLYFIN_API_KEY,
                },
            }
        )

        if (!seasonsResponse.ok) {
            throw new Error('Failed to fetch seasons from Jellyfin')
        }

        const seasonsData = await seasonsResponse.json()
        const seasons = seasonsData.Items || []

        // Check if we have all the seasons
        const allSeasonsResponse = await fetch(
            `http://api.themoviedb.org/3/tv/${tmdbId}/seasons?api_key=${process.env.TMDB_API_KEY}`,
            {
                headers: {
                    'Content-Type': 'application/json',
                },
            }
        )

        if (!allSeasonsResponse.ok) {
            throw new Error('Failed to fetch all seasons from Jellyfin')
        }

        const allSeasonsData = await allSeasonsResponse.json()
        const allSeasons = allSeasonsData.Items || []

        if (allSeasons.length !== seasons.length) {
            const missingSeasons = allSeasons.filter(season => !seasons.some(s => s.Id === season.Id))
            return NextResponse.json({ status: 'not all seasons available', missingSeasons: missingSeasons.map(season => season.IndexNumber) })
        }

        // Check completeness of each season using isMissing and isUnaired
        const seasonStatus = await Promise.all(
            seasons.map(async (season) => {
                const episodesResponse = await fetch(
                    `http://${process.env.JELLYFIN_HOST}:${process.env.JELLYFIN_PORT}/Items?ParentId=${season.Id}&IncludeItemTypes=Episode&Filters=IsMissing,IsUnaired`,
                    {
                        headers: {
                            'X-Emby-Token': process.env.JELLYFIN_API_KEY,
                        },
                    }
                )

                if (!episodesResponse.ok) {
                    throw new Error(`Failed to fetch episodes for season ${season.Id}`)
                }

                const episodesData = await episodesResponse.json()
                const missingEpisodes = episodesData.Items || []

                if (missingEpisodes.length === 0) {
                    return { season: season.IndexNumber, status: 'complete' }
                }
                return { season: season.IndexNumber, status: 'episodes missing' }
            })
        )

        return NextResponse.json({ status: 'exists', seasons: seasonStatus, allSeasons })
    } catch (error) {
        console.error('Error checking TV series:', error)
        return NextResponse.json({ error: 'Failed to check TV series' }, { status: 500 })
    }
}
