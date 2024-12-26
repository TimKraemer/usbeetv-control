import { NextResponse } from 'next/server'

async function authenticateDeluge() {
    const response = await fetch(`http://${process.env.DELUGE_HOST}:${process.env.DELUGE_PORT}/json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: 'auth.login', params: [process.env.DELUGE_PASSWORD], id: 1 })
    })
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    return response.headers.get("set-cookie")
}

async function getTorrentProgress(sessionId, torrentId) {
    const response = await fetch(`http://${process.env.DELUGE_HOST}:${process.env.DELUGE_PORT}/json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': sessionId },
        body: JSON.stringify({
            method: 'web.get_torrents_status',
            params: [{}, ['progress']],
            id: 4
        })
    })
    if (!response.ok) throw new Error(`Failed to fetch torrent status: HTTP ${response.status}`)
    const result = await response.json()
    if (result.error) throw new Error(`Error fetching torrent status: ${result.error}`)

    const torrent = result.result[torrentId]
    if (!torrent) throw new Error('Torrent not found')

    return torrent.progress
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