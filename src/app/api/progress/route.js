import { authenticateDeluge } from '@/app/lib/authenticateDeluge'
import { triggerLibraryScan } from '@/app/lib/jellyfinApi'
import { NextResponse } from 'next/server'

// In-memory guard to avoid triggering Jellyfin scans repeatedly for the same torrent
// Entries expire after a cooldown period to prevent unbounded growth
const triggeredScanForTorrent = new Set()
const SCAN_COOLDOWN_MS = 60 * 60 * 1000 // 1 hour

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
        const { progress, eta, state } = await getTorrentProgress(sessionId, torrentId)

        // Check if download is complete (progress = 1.0 and state indicates completion)
        const isComplete = progress >= 1.0 && (state === 'Seeding' || state === 'Paused')

        // If download just completed, trigger library scan
        if (isComplete) {
            try {
                // Ensure we only trigger once per torrent within the cooldown window
                if (!triggeredScanForTorrent.has(torrentId)) {
                    triggeredScanForTorrent.add(torrentId)
                    setTimeout(() => triggeredScanForTorrent.delete(torrentId), SCAN_COOLDOWN_MS)

                    await triggerLibraryScan()
                    console.info(`[INFO] Library scan triggered for completed torrent: ${torrentId}`)
                } else {
                    // Prevent spamming logs
                    // console.log(`[DEBUG] Skipping duplicate library scan trigger for torrent: ${torrentId}`)
                }
            } catch (scanError) {
                console.error(`[ERROR] Failed to trigger library scan for completed torrent ${torrentId}:`, scanError.message)
                // Don't fail the progress request if scan fails
            }
        }

        return NextResponse.json({ progress, eta, state, isComplete })
    } catch (error) {
        return NextResponse.json({ error: `Error fetching progress: ${error.message}` }, { status: 500 })
    }
} 