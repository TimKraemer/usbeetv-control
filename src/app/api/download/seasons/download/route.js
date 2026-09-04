import { sendToDeluge } from '@/app/lib/sendToDeluge'
import { getOriginalLanguage } from '@/app/lib/tmdbApi'
import {
    fetchTorrentsByTmdbId,
    getDownloadUrl,
    isDolbyVision,
    isSeasonPack,
    parseSeasonEpisode,
    pickBestByKey,
    sortTorrents,
    validateLanguage,
} from '@/app/lib/tsApi'
import { NextResponse } from 'next/server'

export async function POST(request) {
    try {
        const body = await request.json()
        const { tmdbId, selectedSeasons, language = 'de-DE', force = false } = body

        if (!tmdbId || !Array.isArray(selectedSeasons) || selectedSeasons.length === 0) {
            return NextResponse.json({ error: 'TMDB ID and selected seasons are required' }, { status: 400 })
        }

        const [rows, originalLanguage] = await Promise.all([
            fetchTorrentsByTmdbId(tmdbId, 'series'),
            getOriginalLanguage('tv', tmdbId),
        ])

        if (rows.length === 0) {
            return NextResponse.json({ error: 'No results found' }, { status: 404 })
        }

        // Best full-season pack per season (single episode releases are not
        // considered here; incomplete seasons are handled via subscriptions).
        // sortTorrents already orders by language, quality (Dolby Vision last) and age.
        const sortedRows = sortTorrents(rows, { userLanguage: language, originalLanguage })
        const seasonMap = pickBestByKey(sortedRows, row => {
            if (!isSeasonPack(row)) return null
            return parseSeasonEpisode(row.name).season
        })

        const results = []

        for (const seasonNumber of selectedSeasons) {
            const bestRow = seasonMap.get(Number(seasonNumber))

            if (!bestRow) {
                results.push({
                    seasonNumber,
                    error: `No torrent found for Season ${seasonNumber}`
                })
                continue
            }

            if (!force) {
                const languageValidation = validateLanguage(bestRow, language, originalLanguage, 'tv')
                if (!languageValidation.valid) {
                    return NextResponse.json({
                        languageWarning: languageValidation.warning,
                        seasonNumber
                    })
                }
            }

            try {
                const result = await sendToDeluge(getDownloadUrl(bestRow.id), 'tv')
                console.log(`[Seasons] Season ${seasonNumber}: ${bestRow.name}${isDolbyVision(bestRow) ? ' (Dolby Vision, no alternative)' : ''}`)
                results.push({
                    seasonNumber,
                    success: true,
                    torrentName: bestRow.name,
                    dolbyVision: isDolbyVision(bestRow),
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
