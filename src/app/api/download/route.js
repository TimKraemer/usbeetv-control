import axios from 'axios'
import { NextResponse } from 'next/server'

export async function GET(request) {
    const { searchParams } = new URL(request.url)
    const tmdbId = searchParams.get('tmdbId')

    if (!tmdbId) {
        return NextResponse.json({ error: 'TMDB ID is required' }, { status: 400 })
    }

    try {
        const response = await axios.get(`${process.env.TS_API_URL}/browse.php`, {
            params: {
                tmdbId,
                apikey: process.env.TS_API_KEY,
            },
        })
        return NextResponse.json(response.data)
    } catch (error) {
        return NextResponse.json({ error: `Error fetching data: ${error}` }, { status: 500 })
    }
}

