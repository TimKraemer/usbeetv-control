const DELUGE_DOWNLOAD_TIMEOUT = 60000 // 1 minute timeout for Deluge to download torrent from slow server
const MAX_RETRIES = 3

export async function downloadTorrent(sessionId, torrentUrl) {
    let lastError
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            console.log(`[Deluge downloadTorrent] Attempt ${attempt}/${MAX_RETRIES}...`)
            const response = await fetch(`http://${process.env.DELUGE_HOST}:${process.env.DELUGE_PORT}/json`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Cookie': sessionId },
                body: JSON.stringify({ method: 'web.download_torrent_from_url', params: [torrentUrl], id: 2 }),
                signal: AbortSignal.timeout(DELUGE_DOWNLOAD_TIMEOUT)
            })
            if (!response.ok) throw new Error(`Torrent download failed: HTTP ${response.status}`)
            const result = await response.json()
            if (!result.result || result.error) throw new Error(`Error downloading torrent: ${result.error || 'Unknown error'}`)
            console.log(`[Deluge downloadTorrent] Attempt ${attempt} SUCCESS`)
            return result.result
        } catch (error) {
            lastError = error
            console.log(`[Deluge downloadTorrent] Attempt ${attempt} failed: ${error.message}`)
            if (attempt < MAX_RETRIES) {
                console.log(`[Deluge downloadTorrent] Retrying in 2 seconds...`)
                await new Promise(resolve => setTimeout(resolve, 2000))
            }
        }
    }
    throw lastError
}
