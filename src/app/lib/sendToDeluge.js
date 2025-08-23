import { addTorrent } from "@/app/lib/addTorrent"
import { authenticateDeluge } from "@/app/lib/authenticateDeluge"
import { connectToWebUI } from "@/app/lib/connectToWebUI"
import { downloadTorrent } from "@/app/lib/downloadTorrent"
import { triggerLibraryScan } from "@/app/lib/jellyfinApi"

// Global cooldown to avoid spamming Jellyfin when multiple downloads start at once
let lastStartScanAt = 0
const START_SCAN_COOLDOWN_MS = 5 * 60 * 1000 // 5 minutes

export async function sendToDeluge(torrentUrl, type) {
    try {
        const sessionId = await authenticateDeluge()

        await connectToWebUI(sessionId)

        const torrentPath = await downloadTorrent(sessionId, torrentUrl)
        const addedTorrents = await addTorrent(sessionId, torrentPath, type)
        // Trigger a Jellyfin scan once at download start, with a global cooldown
        const now = Date.now()
        if (now - lastStartScanAt > START_SCAN_COOLDOWN_MS) {
            lastStartScanAt = now
            try {
                await triggerLibraryScan()
                console.info('[INFO] Jellyfin scan triggered at download start')
            } catch (scanErr) {
                console.error('[ERROR] Failed to trigger Jellyfin scan at start:', scanErr.message)
            }
        }
        return { hash: addedTorrents.result[0][1] }
    } catch (error) {
        throw new Error(`Error Deluge: ${error.message}`)
    }
}
