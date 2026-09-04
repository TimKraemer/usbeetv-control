import { authenticateDeluge } from '@/app/lib/authenticateDeluge'
import { connectToWebUI } from '@/app/lib/connectToWebUI'
import {
    findTorrentStatus,
    forceRecheck,
    getTorrentsStatus,
    isTorrentComplete,
    torrentProgressRatio,
} from '@/app/lib/delugeTorrent'
import { triggerLibraryScan } from '@/app/lib/jellyfinApi'
import { addPendingDownloads, getPendingDownloads, removePendingDownloads } from '@/app/lib/pendingDownloads'

let watchRunning = false
const recheckedHashes = new Set()

async function adoptIncompleteTorrents(torrents, pending) {
    const known = new Set(pending.map(item => item.hash))
    const toAdopt = []

    for (const [hash, status] of Object.entries(torrents)) {
        const normalized = String(hash).toLowerCase()
        if (known.has(normalized)) continue
        if (isTorrentComplete(status.progress, status.state)) continue
        toAdopt.push({ hash: normalized })
    }

    if (toAdopt.length === 0) return 0
    return addPendingDownloads(toAdopt)
}

/** After a Deluge crash, resume data is often 0% even when files exist on the NAS. */
async function recheckForgottenTorrents(sessionId, torrents) {
    const toRecheck = []

    for (const [hash, status] of Object.entries(torrents)) {
        const normalized = String(hash).toLowerCase()
        if (recheckedHashes.has(normalized)) continue
        if (status.state === 'Checking') continue
        if (isTorrentComplete(status.progress, status.state)) continue
        if (torrentProgressRatio(status.progress) > 0.01) continue
        toRecheck.push(normalized)
    }

    if (toRecheck.length === 0) return 0

    await forceRecheck(sessionId, toRecheck)
    for (const hash of toRecheck) {
        recheckedHashes.add(hash)
    }
    console.log(`[DownloadWatch] Rechecking ${toRecheck.length} torrent(s) at 0% (files may already exist)`)
    return toRecheck.length
}

/** Poll Deluge for unfinished torrents and scan Jellyfin when they finish. */
export async function watchPendingDownloads() {
    if (watchRunning) {
        console.log('[DownloadWatch] Check already running, skipping')
        return { skipped: true }
    }

    watchRunning = true
    try {
        const sessionId = await authenticateDeluge()
        await connectToWebUI(sessionId)
        const torrents = await getTorrentsStatus(sessionId)

        const rechecked = await recheckForgottenTorrents(sessionId, torrents)

        const pending = await getPendingDownloads()
        const adopted = await adoptIncompleteTorrents(torrents, pending)
        const watched = adopted > 0 ? await getPendingDownloads() : pending

        if (adopted > 0) {
            console.log(`[DownloadWatch] Adopted ${adopted} in-progress torrent(s)`)
        }

        if (watched.length === 0) {
            return { skipped: false, checked: 0, completed: 0, rechecked }
        }

        const completed = []
        const gone = []

        for (const item of watched) {
            const status = findTorrentStatus(torrents, item.hash)
            if (!status) {
                gone.push(item.hash)
                continue
            }
            if (isTorrentComplete(status.progress, status.state)) {
                completed.push(item.hash)
            }
        }

        if (gone.length > 0) {
            await removePendingDownloads(gone)
            console.log(`[DownloadWatch] Dropped ${gone.length} missing torrent(s)`)
        }

        if (completed.length === 0) {
            return { skipped: false, checked: watched.length, completed: 0, rechecked }
        }

        console.log(`[DownloadWatch] ${completed.length} torrent(s) complete, triggering library scan`)
        const scan = await triggerLibraryScan()
        if (scan?.skipped) {
            console.log('[DownloadWatch] Library scan skipped (cooldown), will retry')
            return {
                skipped: false,
                checked: watched.length,
                completed: completed.length,
                scanned: false,
                rechecked,
            }
        }

        await removePendingDownloads(completed)

        return {
            skipped: false,
            checked: watched.length,
            completed: completed.length,
            scanned: true,
            rechecked,
        }
    } finally {
        watchRunning = false
    }
}
