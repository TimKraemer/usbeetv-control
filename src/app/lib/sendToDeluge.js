import { addTorrent } from "@/app/lib/addTorrent"
import { authenticateDeluge } from "@/app/lib/authenticateDeluge"
import { connectToWebUI } from "@/app/lib/connectToWebUI"
import {
    findTorrentStatus,
    forceRecheck,
    getTorrentInfo,
    getTorrentsStatus,
    isTorrentComplete,
    queueTop,
} from "@/app/lib/delugeTorrent"
import { downloadTorrent } from "@/app/lib/downloadTorrent"
import { addPendingDownload } from "@/app/lib/pendingDownloads"

function torrentHashFromAddResult(addedTorrents) {
    const entry = addedTorrents?.result?.[0]
    if (!Array.isArray(entry)) return null
    const [success, value] = entry
    if (success && typeof value === 'string') return value.toLowerCase()
    return null
}

async function rememberPending(hash, type) {
    if (!hash) return
    try {
        await addPendingDownload({ hash, type })
    } catch (error) {
        console.error('[PendingDownloads] Failed to persist torrent:', error.message)
    }
}

export async function sendToDeluge(torrentUrl, type) {
    try {
        const sessionId = await authenticateDeluge()

        await connectToWebUI(sessionId)

        const torrentPath = await downloadTorrent(sessionId, torrentUrl)
        const info = await getTorrentInfo(sessionId, torrentPath).catch(error => {
            console.warn('[Deluge] Could not read torrent info:', error.message)
            return null
        })
        const infoHash = String(info?.hash || info?.info_hash || '').toLowerCase()

        if (infoHash) {
            const existing = await getTorrentsStatus(sessionId, ['progress', 'state', 'name'])
            const status = findTorrentStatus(existing, infoHash)
            if (status) {
                console.log(`[Deluge] Torrent already in session (${status.name || infoHash}), skipping add`)
                if (!isTorrentComplete(status.progress, status.state) && status.state !== 'Checking') {
                    await forceRecheck(sessionId, [infoHash])
                }
                await rememberPending(infoHash, type)
                return { hash: infoHash, alreadyAdded: true }
            }
        }

        const addedTorrents = await addTorrent(sessionId, torrentPath, type)
        const hash = torrentHashFromAddResult(addedTorrents) || infoHash
        if (hash) {
            await queueTop(sessionId, [hash]).catch(error => {
                console.warn('[Deluge] queue_top failed:', error.message)
            })
        }
        await rememberPending(hash, type)

        return { hash }
    } catch (error) {
        throw new Error(`Error Deluge: ${error.message}`)
    }
}
