import { authenticateDeluge } from '@/app/lib/authenticateDeluge'
import { NextResponse } from 'next/server'

async function removeTorrent(sessionId, torrentId) {
    const response = await fetch(`http://${process.env.DELUGE_HOST}:${process.env.DELUGE_PORT}/json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': sessionId },
        body: JSON.stringify({
            method: 'core.remove_torrent',
            params: [torrentId, true], // true = remove data
            id: 5
        })
    })
    if (!response.ok) throw new Error(`Failed to remove torrent: HTTP ${response.status}`)
    const result = await response.json()
    if (result.error) throw new Error(`Error removing torrent: ${result.error}`)
    return result.result
}

export async function POST(request) {
    try {
        const body = await request.json()
        const { torrentId } = body

        if (!torrentId) {
            return NextResponse.json({ error: 'Torrent ID is required' }, { status: 400 })
        }

        const sessionId = await authenticateDeluge()
        await removeTorrent(sessionId, torrentId)

        return NextResponse.json({ success: true, message: 'Download cancelled successfully' })
    } catch (error) {
        console.error('Error cancelling download:', error)
        return NextResponse.json({ error: `Error cancelling download: ${error.message}` }, { status: 500 })
    }
} 