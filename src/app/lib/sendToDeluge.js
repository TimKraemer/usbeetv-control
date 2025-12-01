import { addTorrent } from "@/app/lib/addTorrent"
import { authenticateDeluge } from "@/app/lib/authenticateDeluge"
import { connectToWebUI } from "@/app/lib/connectToWebUI"
import { downloadTorrent } from "@/app/lib/downloadTorrent"

export async function sendToDeluge(torrentUrl, type) {
    try {
        const sessionId = await authenticateDeluge()

        await connectToWebUI(sessionId)

        const torrentPath = await downloadTorrent(sessionId, torrentUrl)
        const addedTorrents = await addTorrent(sessionId, torrentPath, type)
        return { hash: addedTorrents.result[0][1] }
    } catch (error) {
        throw new Error(`Error Deluge: ${error.message}`)
    }
}
