import { getLibraryScanCooldown, triggerLibraryScan } from '@/app/lib/jellyfinApi'
import { NextResponse } from 'next/server'

export async function POST() {
    try {
        const result = await triggerLibraryScan()
        return NextResponse.json({
            success: true,
            skipped: Boolean(result.skipped),
            message: result.skipped
                ? 'Library scan recently triggered, cooldown active'
                : 'All library scans triggered successfully',
            cooldown: getLibraryScanCooldown()
        })
    } catch (error) {
        console.error('[ERROR] Failed to trigger library scan:', error.message)
        return NextResponse.json({
            error: `Failed to trigger library scan: ${error.message}`,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
            cooldown: getLibraryScanCooldown()
        }, { status: 500 })
    }
}

export async function GET() {
    return NextResponse.json({ cooldown: getLibraryScanCooldown() })
} 