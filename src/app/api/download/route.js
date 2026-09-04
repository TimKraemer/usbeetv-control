import { sendToDeluge } from '@/app/lib/sendToDeluge'
import { getOriginalLanguage } from '@/app/lib/tmdbApi'
import {
    fetchTorrentsByTmdbId,
    getDownloadUrl,
    isDolbyVision,
    sortTorrents,
    validateLanguage,
} from '@/app/lib/tsApi'
import { NextResponse } from 'next/server'

export async function GET(request) {
    const { searchParams } = new URL(request.url)
    const tmdbId = searchParams.get('tmdbId')
    const type = searchParams.get('type')
    const language = searchParams.get('language') || 'de-DE'
    const force = searchParams.get('force') === 'true'

    if (!tmdbId) {
        return NextResponse.json({ error: 'TMDB ID is required' }, { status: 400 })
    }

    if (type === 'tv') {
        return NextResponse.json({
            error: 'TV shows now use season selection. Please use the season selection dialog to choose which seasons to download.',
            useSeasonSelection: true
        }, { status: 400 })
    }

    try {
        const [rows, originalLanguage] = await Promise.all([
            fetchTorrentsByTmdbId(tmdbId, 'movie'),
            getOriginalLanguage('movie', tmdbId),
        ])

        if (rows.length === 0) {
            return NextResponse.json({ error: 'No results found' }, { status: 404 })
        }

        // Language match first, then quality (Dolby Vision releases last), then age
        const sortedRows = sortTorrents(rows, { userLanguage: language, originalLanguage })
        const bestRow = sortedRows[0]

        if (!force) {
            const languageValidation = validateLanguage(bestRow, language, originalLanguage, type)
            if (!languageValidation.valid) {
                return NextResponse.json({ languageWarning: languageValidation.warning })
            }
        }

        const dolbyVision = isDolbyVision(bestRow)
        console.log(`[Download] Movie ${tmdbId}: ${bestRow.name}${dolbyVision ? ' (Dolby Vision, no alternative)' : ''}`)
        const result = await sendToDeluge(getDownloadUrl(bestRow.id), type)
        return NextResponse.json({ ...result, torrentName: bestRow.name, dolbyVision })
    } catch (error) {
        return NextResponse.json({ error: `Error fetching data: ${error.message}` }, { status: 500 })
    }
}
