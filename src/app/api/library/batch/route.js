import { getLibraryItemsByTmdbId, getSeriesSeasonNumbers } from '@/app/lib/jellyfinApi'
import { getTvShowDetails } from '@/app/lib/tmdbApi'
import { NextResponse } from 'next/server'

function missingSeasonCount(tvShowDetails, presentSeasons) {
    return (tvShowDetails.seasons || []).filter(season =>
        season.season_number > 0
        && season.episode_count > 0
        && !presentSeasons.has(season.season_number)
    ).length
}

export async function POST(request) {
    try {
        const body = await request.json()
        const { items } = body

        if (!Array.isArray(items) || items.length === 0) {
            return NextResponse.json({ error: 'Items array is required' }, { status: 400 })
        }

        const [movieMap, seriesMap] = await Promise.all([
            getLibraryItemsByTmdbId('Movie'),
            getLibraryItemsByTmdbId('Series'),
        ])

        const results = await Promise.all(
            items.map(async ({ tmdbId, type }) => {
                const key = String(tmdbId)
                try {
                    if (type === 'movie') {
                        const exists = movieMap.has(key)
                        return { tmdbId: key, exists, isComplete: exists }
                    }

                    if (type === 'tv') {
                        const matchedSeries = seriesMap.get(key)
                        if (!matchedSeries) {
                            return { tmdbId: key, exists: false, isComplete: false }
                        }

                        // Compare season presence only — no per-season episode scans
                        const [tvShowDetails, seasonNumbers] = await Promise.all([
                            getTvShowDetails(key),
                            getSeriesSeasonNumbers(matchedSeries.Id),
                        ])
                        const missing = missingSeasonCount(tvShowDetails, new Set(seasonNumbers))
                        return { tmdbId: key, exists: true, isComplete: missing === 0 }
                    }

                    return { tmdbId: key, exists: false, isComplete: false }
                } catch (error) {
                    console.error(`[ERROR] Failed to check ${type} ${key}:`, error.message)
                    return { tmdbId: key, exists: false, isComplete: false }
                }
            })
        )

        const resultMap = {}
        for (const result of results) {
            resultMap[result.tmdbId] = { exists: result.exists, isComplete: result.isComplete }
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
