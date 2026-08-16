import { authenticateDeluge } from '@/app/lib/authenticateDeluge'
import { isTorrentComplete } from '@/app/lib/delugeTorrent'
import { NextResponse } from 'next/server'

async function getTorrentProgress(sessionId, torrentId) {
    const response = await fetch(`http://${process.env.DELUGE_HOST}:${process.env.DELUGE_PORT}/json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': sessionId },
        body: JSON.stringify({
            method: 'web.get_torrent_status',
            params: [torrentId, ['progress', 'eta', 'state']],
            id: 4
        })
    })
    if (!response.ok) throw new Error(`Failed to fetch torrent status: HTTP ${response.status}`)
    const result = await response.json()
    if (result.error) throw new Error(`Error fetching torrent status: ${result.error}`)

    // Check if torrent exists - Deluge returns empty object for non-existent torrents
    if (!result.result || Object.keys(result.result).length === 0) {
        return { notFound: true }
    }

    return {
        progress: result.result.progress,
        eta: result.result.eta,
        state: result.result.state
    }
}

export async function GET(request) {
    const { searchParams } = new URL(request.url)
    const torrentId = searchParams.get('torrentId')

    if (!torrentId) {
        return NextResponse.json({ error: 'Torrent ID is required' }, { status: 400 })
    }

    try {
        const sessionId = await authenticateDeluge()
        const result = await getTorrentProgress(sessionId, torrentId)

        // If torrent was not found (cancelled/removed), return 404
        if (result.notFound) {
            return NextResponse.json({ notFound: true }, { status: 404 })
        }

        const { progress, eta, state } = result

        const isComplete = isTorrentComplete(progress, state)

        return NextResponse.json({ progress, eta, state, isComplete })
    } catch (error) {
        return NextResponse.json({ error: `Error fetching progress: ${error.message}` }, { status: 500 })
    }
} 