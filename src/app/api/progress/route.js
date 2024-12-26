import { authenticateDeluge } from '@/app/lib/authenticateDeluge'
import { NextResponse } from 'next/server'

async function getTorrentProgress(sessionId, torrentId) {
    const response = await fetch(`http://${process.env.DELUGE_HOST}:${process.env.DELUGE_PORT}/json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': sessionId },
        body: JSON.stringify({
            method: 'web.get_torrent_status',
            params: [torrentId, ['progress']],
            id: 4
        })
    })
    if (!response.ok) throw new Error(`Failed to fetch torrent status: HTTP ${response.status}`)
    const result = await response.json()
    if (result.error) throw new Error(`Error fetching torrent status: ${result.error}`)

    return result.result.progress
}

export async function GET(request) {
    const { searchParams } = new URL(request.url)
    const torrentId = searchParams.get('torrentId')

    if (!torrentId) {
        return NextResponse.json({ error: 'Torrent ID is required' }, { status: 400 })
    }

    try {
        const sessionId = await authenticateDeluge()
        const progress = await getTorrentProgress(sessionId, torrentId)
        return NextResponse.json({ progress })
    } catch (error) {
        return NextResponse.json({ error: `Error fetching progress: ${error.message}` }, { status: 500 })
    }
} 