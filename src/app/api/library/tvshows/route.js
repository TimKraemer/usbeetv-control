import { findSeriesByTmdbId, getSeriesSeasonNumbers } from '@/app/lib/jellyfinApi'
import { getTvShowDetails } from '@/app/lib/tmdbApi'
import { NextResponse } from 'next/server'

export async function GET(req) {
    const { searchParams } = new URL(req.url)
    const tmdbId = searchParams.get('tmdbId')
    if (!tmdbId) {
        return NextResponse.json({ error: 'TMDB ID is required' }, { status: 400 })
    }
    try {
        const matchedSeries = await findSeriesByTmdbId(tmdbId)
        if (!matchedSeries) {
            return NextResponse.json({ exists: false })
        }

        const [tvShowDetails, seasonNumbers] = await Promise.all([
            getTvShowDetails(tmdbId),
            getSeriesSeasonNumbers(matchedSeries.Id),
        ])

        const isEnded = tvShowDetails.status === 'Ended'
        const totalSeasons = tvShowDetails.number_of_seasons
        const allSeasons = tvShowDetails.seasons || []
        const currentSeason = isEnded ? null : allSeasons.find(season => season.season_number === tvShowDetails.next_episode_to_air?.season_number) || null
        const lastAiredSeasonNumber = tvShowDetails.last_episode_to_air?.season_number
        const completelyAiredSeasons = []
        for (let i = 1; i < lastAiredSeasonNumber; i++) {
            completelyAiredSeasons.push(i)
        }
        if (lastAiredSeasonNumber && (isEnded || currentSeason === null || tvShowDetails.last_episode_to_air?.episode_number === currentSeason?.episode_count)) {
            completelyAiredSeasons.push(lastAiredSeasonNumber)
        }
        const incompleteSeason = tvShowDetails.next_episode_to_air?.season_number || null
        const airedEpisodesOfIncompleteSeason = []
        if (incompleteSeason) {
            for (let i = 1; i < tvShowDetails.next_episode_to_air.episode_number; i++) {
                airedEpisodesOfIncompleteSeason.push(i)
            }
        }

        const presentSeasons = new Set(seasonNumbers)
        const missingSeasons = allSeasons.filter(season =>
            season.season_number > 0 && season.episode_count > 0 && !presentSeasons.has(season.season_number)
        )

        return NextResponse.json({
            isEnded,
            totalSeasons,
            completelyAiredSeasons,
            airedEpisodesOfIncompleteSeason,
            missingSeasons,
            exists: true
        })
    } catch (error) {
        console.error('[ERROR] Failed to check TV series:', error.message)
        return NextResponse.json({
            error: `Failed to check TV series: ${error.message}`,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }, { status: 500 })
    }
}
