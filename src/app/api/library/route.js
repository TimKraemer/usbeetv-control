import { NextResponse } from 'next/server'

export async function GET(req) {
    const { searchParams } = new URL(req.url)
    const tmdbId = searchParams.get('tmdbId')

    if (!tmdbId) {
        return NextResponse.json({ error: 'TMDB ID is required' }, { status: 400 })
    }

    try {
        const response = await fetch(
            `http://${process.env.JELLYFIN_HOST}:${process.env.JELLYFIN_PORT}/Items?Recursive=true&IncludeItemTypes=Movie&Fields=ProviderIds&Filters=IsNotFolder`,
            {
                headers: {
                    'X-Emby-Token': process.env.JELLYFIN_API_KEY,
                },
            }
        )

        if (!response.ok) {
            throw new Error('Failed to fetch data from Jellyfin')
        }

        const data = await response.json()
        const items = data.Items || []

        // Use for..of loop as preferred
        let exists = false
        for (const item of items) {
            if (item.ProviderIds?.Tmdb === tmdbId) {
                exists = true
                break
            }
        }

        return NextResponse.json({ exists })
    } catch (error) {
        console.error('Error checking media:', error)
        return NextResponse.json({ error: 'Failed to check media' }, { status: 500 })
    }
}