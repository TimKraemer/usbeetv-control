import { delugeRpc } from '@/app/lib/delugeTorrent'

export async function addTorrent(sessionId, torrentPath, type) {
    const result = await delugeRpc(sessionId, 'web.add_torrents', [[{
        path: torrentPath,
        options: {
            move_completed: false,
            download_location: type === 'movie' ? process.env.MOVIE_DOWNLOAD_PATH : process.env.TV_DOWNLOAD_PATH,
            // Preallocation on network mounts hangs Deluge and drops resume data after restarts
            pre_allocate_storage: false,
            prioritize_first_last_pieces: true,
            sequential_download: true,
        },
    }]])
    // Keep the { result } shape callers expect: [[success, hashOrError], ...]
    return { result }
}
