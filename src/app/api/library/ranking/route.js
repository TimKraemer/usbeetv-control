import { getWatchRanking } from '@/app/lib/jellyfinApi'
import { NextResponse } from 'next/server'

export async function GET() {
    try {
        const ranking = await getWatchRanking()
        return NextResponse.json(ranking)
    } catch (error) {
        console.error('Error building watch ranking:', error.message)
        return NextResponse.json({ error: `Failed to build watch ranking: ${error.message}` }, { status: 500 })
    }
}
