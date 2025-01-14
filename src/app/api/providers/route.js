import { NextResponse } from 'next/server'

export async function GET(request) {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const type = searchParams.get('type') || 'movie' // default to 'movie' if not specified

    if (!id) {
        return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    }

    const endpoint = type === 'tv'
        ? `https://api.themoviedb.org/3/tv/${id}/watch/providers`
        : `https://api.themoviedb.org/3/movie/${id}/watch/providers`

    try {
        const response = await fetch(`${endpoint}?api_key=${process.env.TMDB_API_KEY}`)

        if (response.status === 404) {
            return NextResponse.json({ error: `${type.charAt(0).toUpperCase() + type.slice(1)} not found` }, { status: 404 })
        }

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
        }

        const data = await response.json()
        const providers = data.results?.DE

        if (!providers) {
            return NextResponse.json({ error: `No providers found for this ${type} in Germany` }, { status: 404 })
        }

        return NextResponse.json({ providers })
    } catch (error) {
        return NextResponse.json({ error: `Error fetching data: ${error.message}` }, { status: 500 })
    }
}

