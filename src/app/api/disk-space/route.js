import { getSynologyApi } from '@/app/lib/synologyApi'
import { NextResponse } from 'next/server'

export async function GET() {
    try {
        if (!process.env.SYNOLOGY_HOST || !process.env.SYNOLOGY_PORT || !process.env.SYNOLOGY_USERNAME || !process.env.SYNOLOGY_PASSWORD) {
            return NextResponse.json({
                error: 'Synology configuration is incomplete (SYNOLOGY_HOST, SYNOLOGY_PORT, SYNOLOGY_USERNAME, SYNOLOGY_PASSWORD required)'
            }, { status: 500 })
        }

        const volumeName = process.env.SYNOLOGY_VOLUME || 'volume_3'
        const diskInfo = await getSynologyApi().getVolumeInfo(volumeName)
        return NextResponse.json(diskInfo)
    } catch (error) {
        console.error('Error getting disk space:', error.message)
        return NextResponse.json({
            error: `Failed to get disk space: ${error.message}`
        }, { status: 500 })
    }
}
