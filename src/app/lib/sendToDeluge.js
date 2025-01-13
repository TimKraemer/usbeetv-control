import { addTorrent } from "@/app/lib/addTorrent"
import { authenticateDeluge } from "@/app/lib/authenticateDeluge"
import { connectToWebUI } from "@/app/lib/connectToWebUI"
import { downloadTorrent } from "@/app/lib/downloadTorrent"
import { NextResponse } from "next/server"

export async function sendToDeluge(torrentUrl, type) {
    try {
        const sessionId = await authenticateDeluge()

        await connectToWebUI(sessionId)

        const torrentPath = await downloadTorrent(sessionId, torrentUrl)
        const addedTorrents = await addTorrent(sessionId, torrentPath, type)
        return NextResponse.json({ hash: addedTorrents.result[0][1] })
    } catch (error) {
        return NextResponse.json({ message: `Error Deluge: ${error.message}` })
    }
}
