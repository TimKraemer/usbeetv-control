import {
    addSubscription,
    getSubscriptions,
    removeSubscription,
} from '@/app/lib/subscriptionStore'
import { NextResponse } from 'next/server'

export async function GET() {
    try {
        const subscriptions = await getSubscriptions()
        return NextResponse.json({ subscriptions })
    } catch (error) {
        return NextResponse.json({ error: `Error reading subscriptions: ${error.message}` }, { status: 500 })
    }
}

export async function POST(request) {
    try {
        const body = await request.json()
        const { tmdbId, title, language = 'de-DE' } = body

        if (!tmdbId) {
            return NextResponse.json({ error: 'TMDB ID is required' }, { status: 400 })
        }

        const subscription = await addSubscription({ tmdbId, title, language })
        return NextResponse.json({ subscription })
    } catch (error) {
        return NextResponse.json({ error: `Error adding subscription: ${error.message}` }, { status: 500 })
    }
}

export async function DELETE(request) {
    try {
        const { searchParams } = new URL(request.url)
        const tmdbId = searchParams.get('tmdbId')

        if (!tmdbId) {
            return NextResponse.json({ error: 'TMDB ID is required' }, { status: 400 })
        }

        const removed = await removeSubscription(tmdbId)
        if (!removed) {
            return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })
        }
        return NextResponse.json({ success: true })
    } catch (error) {
        return NextResponse.json({ error: `Error removing subscription: ${error.message}` }, { status: 500 })
    }
}
