import { addTorrent } from "@/app/lib/addTorrent"
import { authenticateDeluge } from "@/app/lib/authenticateDeluge"
import { connectToWebUI } from "@/app/lib/connectToWebUI"
import { downloadTorrent } from "@/app/lib/downloadTorrent"
import { addPendingDownload } from "@/app/lib/pendingDownloads"

export async function sendToDeluge(torrentUrl, type) {
    try {
        const sessionId = await authenticateDeluge()

        await connectToWebUI(sessionId)

        const torrentPath = await downloadTorrent(sessionId, torrentUrl)
        const addedTorrents = await addTorrent(sessionId, torrentPath, type)
        const hash = addedTorrents.result?.[0]?.[1]

        if (hash) {
            try {
                await addPendingDownload({ hash, type })
            } catch (error) {
                console.error('[PendingDownloads] Failed to persist torrent:', error.message)
            }
        }

        return { hash }
    } catch (error) {
        throw new Error(`Error Deluge: ${error.message}`)
    }
}
