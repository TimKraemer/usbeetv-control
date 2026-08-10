import { sendToDeluge } from '@/app/lib/sendToDeluge'
import {
    fetchTorrentsByTmdbId,
    getDownloadUrl,
    isSeasonPack,
    parseSeasonEpisode,
    rankTorrent,
    sortTorrents,
    validateLanguage,
} from '@/app/lib/tsApi'
import { NextResponse } from 'next/server'

async function fetchTVOriginalLanguage(tmdbId) {
    if (!process.env.TMDB_API_KEY) return null
    try {
        const response = await fetch(
            `https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${process.env.TMDB_API_KEY}`,
            { signal: AbortSignal.timeout(4000) }
        )
        if (!response.ok) return null
        const details = await response.json()
        return details.original_language || null
    } catch {
        return null
    }
}

export async function POST(request) {
    try {
        const body = await request.json()
        const { tmdbId, selectedSeasons, language = 'de-DE', force = false } = body

        if (!tmdbId || !selectedSeasons || selectedSeasons.length === 0) {
            return NextResponse.json({ error: 'TMDB ID and selected seasons are required' }, { status: 400 })
        }

        const [rows, originalLanguage] = await Promise.all([
            fetchTorrentsByTmdbId(tmdbId, 'series'),
            fetchTVOriginalLanguage(tmdbId),
        ])

        if (rows.length === 0) {
            return NextResponse.json({ error: 'No results found' }, { status: 404 })
        }

        const sortedRows = sortTorrents(rows, { userLanguage: language, originalLanguage })

        // Best full-season pack per season (single episode releases are not
        // considered here; incomplete seasons are handled via subscriptions)
        const seasonMap = new Map()
        for (const row of sortedRows) {
            if (!isSeasonPack(row)) continue
            const seasonNumber = parseSeasonEpisode(row.name).season
            const existing = seasonMap.get(seasonNumber)
            if (!existing || rankTorrent(row) > rankTorrent(existing)) {
                seasonMap.set(seasonNumber, row)
            }
        }

        // Find best torrents for selected seasons
        const results = []
        let hasLanguageWarning = false

        for (const seasonNumber of selectedSeasons) {
            const bestRow = seasonMap.get(seasonNumber)

            if (!bestRow) {
                results.push({
                    seasonNumber,
                    error: `No torrent found for Season ${seasonNumber}`
                })
                continue
            }

            if (!force) {
                const languageValidation = validateLanguage(bestRow, language, originalLanguage, 'tv')
                if (!languageValidation.valid && !hasLanguageWarning) {
                    hasLanguageWarning = true
                    return NextResponse.json({
                        languageWarning: languageValidation.warning,
                        seasonNumber
                    })
                }
            }

            try {
                const result = await sendToDeluge(getDownloadUrl(bestRow.id), 'tv')
                console.log('sendToDeluge result for season', seasonNumber, ':', result)
                results.push({
                    seasonNumber,
                    success: true,
                    ...result
                })
            } catch (error) {
                console.error('Error in sendToDeluge for season', seasonNumber, ':', error)
                results.push({
                    seasonNumber,
                    error: error.message
                })
            }
        }

        return NextResponse.json({ results })

    } catch (error) {
        return NextResponse.json({ error: `Error downloading seasons: ${error.message}` }, { status: 500 })
    }
}
