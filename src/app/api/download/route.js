import { sendToDeluge } from '@/app/lib/sendToDeluge'
import {
    fetchTorrentsByTmdbId,
    getDownloadUrl,
    sortTorrents,
    validateLanguage,
} from '@/app/lib/tsApi'
import { NextResponse } from 'next/server'

async function fetchMovieOriginalLanguage(tmdbId) {
    if (!process.env.TMDB_API_KEY) return null
    try {
        const response = await fetch(
            `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${process.env.TMDB_API_KEY}`,
            { signal: AbortSignal.timeout(4000) }
        )
        if (!response.ok) return null
        const details = await response.json()
        return details.original_language || null
    } catch {
        return null
    }
}

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
            fetchMovieOriginalLanguage(tmdbId),
        ])

        if (rows.length === 0) {
            return NextResponse.json({ error: 'No results found' }, { status: 404 })
        }

        const sortedRows = sortTorrents(rows, { userLanguage: language, originalLanguage })
        const bestRow = sortedRows[0]

        if (!force) {
            const languageValidation = validateLanguage(bestRow, language, originalLanguage, type)
            if (!languageValidation.valid) {
                return NextResponse.json({ languageWarning: languageValidation.warning })
            }
        }

        const result = await sendToDeluge(getDownloadUrl(bestRow.id), type)
        return NextResponse.json(result)
    } catch (error) {
        return NextResponse.json({ error: `Error fetching data: ${error}` }, { status: 500 })
    }
}
