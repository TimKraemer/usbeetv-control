import { getTorrentStatus, isTorrentComplete } from '@/app/lib/delugeTorrent'
import { NextResponse } from 'next/server'

export async function GET(request) {
    const { searchParams } = new URL(request.url)
    const torrentId = searchParams.get('torrentId')

    if (!torrentId) {
        return NextResponse.json({ error: 'Torrent ID is required' }, { status: 400 })
    }

    try {
        const status = await getTorrentStatus(null, torrentId)

        // Deluge returns an empty object for unknown (cancelled/removed) torrents
        if (!status) {
            return NextResponse.json({ notFound: true }, { status: 404 })
        }

        const { progress, eta, state } = status
        return NextResponse.json({ progress, eta, state, isComplete: isTorrentComplete(progress, state) })
    } catch (error) {
        return NextResponse.json({ error: `Error fetching progress: ${error.message}` }, { status: 500 })
    }
}
