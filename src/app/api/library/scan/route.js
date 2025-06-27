import { getLibraryFolders, triggerLibraryScan } from '@/app/lib/jellyfinApi'
import { NextResponse } from 'next/server'

export async function POST(request) {
    try {

        // Scan all libraries
        await triggerLibraryScan()
        return NextResponse.json({
            success: true,
            message: 'All library scans triggered successfully'
        })
    } catch (error) {
        console.error('[ERROR] Failed to trigger library scan:', error.message)
        return NextResponse.json({
            error: `Failed to trigger library scan: ${error.message}`,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }, { status: 500 })
    }
}

export async function GET() {
    try {
        const libraries = await getLibraryFolders()
        return NextResponse.json({ libraries })
    } catch (error) {
        console.error('[ERROR] Failed to get library folders:', error.message)
        return NextResponse.json({
            error: `Failed to get library folders: ${error.message}`,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }, { status: 500 })
    }
} 