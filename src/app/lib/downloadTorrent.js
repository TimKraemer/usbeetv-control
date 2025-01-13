export async function downloadTorrent(sessionId, torrentUrl) {
    const response = await fetch(`http://${process.env.DELUGE_HOST}:${process.env.DELUGE_PORT}/json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': sessionId },
        body: JSON.stringify({ method: 'web.download_torrent_from_url', params: [torrentUrl], id: 2 })
    })
    if (!response.ok) throw new Error(`Torrent download failed: HTTP ${response.status}`)
    const result = await response.json()
    if (!result.result || result.error) throw new Error(`Error downloading torrent: ${result.error || 'Unknown error'}`)
    return result.result
}
