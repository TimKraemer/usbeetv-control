import { checkAllSubscriptions, checkSubscription } from '@/app/lib/subscriptionChecker'
import { getSubscription } from '@/app/lib/subscriptionStore'
import { NextResponse } from 'next/server'

export async function POST(request) {
    try {
        let tmdbId = null
        try {
            const body = await request.json()
            tmdbId = body?.tmdbId ?? null
        } catch {
            // empty body is fine — check all
        }

        if (tmdbId) {
            const subscription = await getSubscription(tmdbId)
            if (!subscription) {
                return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })
            }
            const result = await checkSubscription(subscription)
            return NextResponse.json({ skipped: false, results: [result] })
        }

        const result = await checkAllSubscriptions()
        return NextResponse.json(result)
    } catch (error) {
        return NextResponse.json({ error: `Error checking subscriptions: ${error.message}` }, { status: 500 })
    }
}
