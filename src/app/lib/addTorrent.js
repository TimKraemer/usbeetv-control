export async function addTorrent(sessionId, torrentPath, type) {
    const response = await fetch(`http://${process.env.DELUGE_HOST}:${process.env.DELUGE_PORT}/json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': sessionId },
        body: JSON.stringify({
            method: 'web.add_torrents',
            params: [[{
                path: torrentPath,
                options: {
                    move_completed: false,
                    // move_completed_path: type === 'movie' ? process.env.MOVIE_DOWNLOAD_PATH : process.env.TV_DOWNLOAD_PATH,
                    download_location: type === 'movie' ? process.env.MOVIE_DOWNLOAD_PATH : process.env.TV_DOWNLOAD_PATH,
                    pre_allocate_storage: true,
                    prioritize_first_last_pieces: true,
                    sequential_download: true,
                },
            }]],
            id: 3
        })
    })
    if (!response.ok) throw new Error(`Failed to add torrent: HTTP ${response.status} - ${await response.text()}`)
    const result = await response.json()
    if (result.error) throw new Error(`Error adding torrent: ${JSON.stringify(result.error)}`)
    return result
}
