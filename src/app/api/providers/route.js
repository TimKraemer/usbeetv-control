import { NextResponse } from 'next/server'

export async function GET(request) {
    const { searchParams } = new URL(request.url)
    const movieId = searchParams.get('movie_id')

    if (!movieId) {
        return NextResponse.json({ error: 'Movie ID is required' }, { status: 400 })
    }

    try {
        const response = await fetch(`https://api.themoviedb.org/3/movie/${movieId}/watch/providers?api_key=${process.env.TMDB_API_KEY}`)

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
        }

        const data = await response.json()
        const providers = data.results?.DE

        if (!providers) {
            return NextResponse.json({ error: 'No providers found for this movie in Germany' }, { status: 404 })
        }

        return NextResponse.json({ providers })
    } catch (error) {
        return NextResponse.json({ error: `Error fetching data: ${error.message}` }, { status: 500 })
    }
}

