import { delugeRpc } from '@/app/lib/delugeTorrent'

const DELUGE_DOWNLOAD_TIMEOUT = 60000 // 1 minute timeout for Deluge to download torrent from slow server
const MAX_RETRIES = 3

export async function downloadTorrent(sessionId, torrentUrl) {
    let lastError
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            console.log(`[Deluge downloadTorrent] Attempt ${attempt}/${MAX_RETRIES}...`)
            const torrentPath = await delugeRpc(sessionId, 'web.download_torrent_from_url', [torrentUrl], {
                timeoutMs: DELUGE_DOWNLOAD_TIMEOUT,
            })
            if (!torrentPath) throw new Error('Error downloading torrent: empty result')
            console.log(`[Deluge downloadTorrent] Attempt ${attempt} SUCCESS`)
            return torrentPath
        } catch (error) {
            lastError = error
            console.log(`[Deluge downloadTorrent] Attempt ${attempt} failed: ${error.message}`)
            if (attempt < MAX_RETRIES) {
                console.log('[Deluge downloadTorrent] Retrying in 2 seconds...')
                await new Promise(resolve => setTimeout(resolve, 2000))
            }
        }
    }
    throw lastError
}
