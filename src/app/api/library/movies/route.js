import { findMovieByTmdbId } from '@/app/lib/jellyfinApi'
import { NextResponse } from 'next/server'

export async function GET(req) {
    const { searchParams } = new URL(req.url)
    const tmdbId = searchParams.get('tmdbId')

    if (!tmdbId) {
        return NextResponse.json({ error: 'TMDB ID is required' }, { status: 400 })
    }

    try {
        const movie = await findMovieByTmdbId(tmdbId)
        return NextResponse.json({ exists: Boolean(movie) })
    } catch (error) {
        console.error('[ERROR] Failed to check movie in Jellyfin:', error.message)
        return NextResponse.json({
            error: `Failed to check movie: ${error.message}`,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }, { status: 500 })
    }
}
