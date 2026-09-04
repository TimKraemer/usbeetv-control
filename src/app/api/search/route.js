import { searchTmdb } from '@/app/lib/tmdbApi'
import { NextResponse } from 'next/server'

const SEARCH_TYPES = new Set(['movie', 'tv'])

export async function GET(request) {
    const { searchParams } = new URL(request.url)
    const searchstring = searchParams.get('searchstring')?.trim()
    const searchType = searchParams.get('type') || 'movie'
    const language = searchParams.get('language') || 'de-DE'

    if (!searchstring) {
        return NextResponse.json({ error: 'Search string is required' }, { status: 400 })
    }
    if (!SEARCH_TYPES.has(searchType)) {
        return NextResponse.json({ error: 'Invalid search type' }, { status: 400 })
    }

    try {
        const tmdbResults = await searchTmdb(searchType, searchstring, language)
        const result = NextResponse.json({ tmdbResults })
        result.headers.set('Cache-Control', 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400')
        return result
    } catch (error) {
        return NextResponse.json({ error: `Error fetching data: ${error.message}` }, { status: 500 })
    }
}
