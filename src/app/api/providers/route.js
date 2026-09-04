import { getWatchProviders } from '@/app/lib/tmdbApi'
import { NextResponse } from 'next/server'

export async function GET(request) {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const type = searchParams.get('type') === 'tv' ? 'tv' : 'movie'

    if (!id) {
        return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    }

    try {
        const data = await getWatchProviders(type, id)
        const providers = data.results?.DE

        if (!providers) {
            return NextResponse.json({ error: `No providers found for this ${type} in Germany` }, { status: 404 })
        }

        return NextResponse.json({ providers })
    } catch (error) {
        if (error.status === 404) {
            return NextResponse.json({ error: `${type.charAt(0).toUpperCase() + type.slice(1)} not found` }, { status: 404 })
        }
        return NextResponse.json({ error: `Error fetching data: ${error.message}` }, { status: 500 })
    }
}
