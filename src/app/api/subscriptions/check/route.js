import { checkAllSubscriptions } from '@/app/lib/subscriptionChecker'
import { NextResponse } from 'next/server'

export async function POST() {
    try {
        const result = await checkAllSubscriptions()
        return NextResponse.json(result)
    } catch (error) {
        return NextResponse.json({ error: `Error checking subscriptions: ${error.message}` }, { status: 500 })
    }
}
