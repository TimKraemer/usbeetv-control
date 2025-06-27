import SynologyAPI from '@/app/lib/synologyApi'
import { NextResponse } from 'next/server'

export async function GET() {
    try {
        // Check if Synology configuration is available
        if (!process.env.SYNOLOGY_HOST || !process.env.SYNOLOGY_USERNAME || !process.env.SYNOLOGY_PASSWORD) {
            return NextResponse.json({
                error: 'Synology NAS configuration is missing. Please check your environment variables.'
            }, { status: 500 })
        }

        const synologyApi = new SynologyAPI()
        const volumeName = process.env.SYNOLOGY_VOLUME || 'volume_3'

        const diskInfo = await synologyApi.getVolumeInfo(volumeName)

        return NextResponse.json(diskInfo)
    } catch (error) {
        console.error('Disk space API error:', error)
        return NextResponse.json({
            error: `Failed to get disk space: ${error.message}`
        }, { status: 500 })
    }
} 