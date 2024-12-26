import { NextResponse } from 'next/server'

export async function GET(request) {
    const { searchParams } = new URL(request.url)
    const searchstring = searchParams.get('searchstring')
    const searchType = searchParams.get('type') || 'movie' // 'movie' or 'tv'
    const language = searchParams.get('language') || 'de-DE'

    if (!searchstring) {
        return NextResponse.json({ error: 'Search string is required' }, { status: 400 })
    }

    try {
        const tmdbResponse = await fetch(`https://api.themoviedb.org/3/search/${searchType}?query=${searchstring}&language=${language}&api_key=${process.env.TMDB_API_KEY}`)

        if (!tmdbResponse.ok) {
            throw new Error(`HTTP error! status: ${tmdbResponse.status}`)
        }


        const response = NextResponse.json(tmdbResponse)
        response.headers.set('Cache-Control', 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400')

        return response
    } catch (error) {
        return NextResponse.json({ error: `Error fetching data: ${error}` }, { status: 500 })
    }
}

