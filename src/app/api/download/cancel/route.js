import { removeTorrent } from '@/app/lib/delugeTorrent'
import { removePendingDownloads } from '@/app/lib/pendingDownloads'
import { NextResponse } from 'next/server'

export async function POST(request) {
    try {
        const body = await request.json()
        const { torrentId } = body

        if (!torrentId) {
            return NextResponse.json({ error: 'Torrent ID is required' }, { status: 400 })
        }

        await removeTorrent(null, torrentId, true)
        await removePendingDownloads([torrentId]).catch(error => {
            console.warn('[PendingDownloads] Failed to drop cancelled torrent:', error.message)
        })

        return NextResponse.json({ success: true, message: 'Download cancelled successfully' })
    } catch (error) {
        console.error('Error cancelling download:', error)
        return NextResponse.json({ error: `Error cancelling download: ${error.message}` }, { status: 500 })
    }
}
