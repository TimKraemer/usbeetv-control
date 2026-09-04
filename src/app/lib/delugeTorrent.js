import { authenticateDeluge, invalidateDelugeSession } from '@/app/lib/authenticateDeluge'

const DELUGE_RPC_TIMEOUT_MS = 30000
const DELUGE_NOT_AUTHENTICATED = 1

let rpcId = 100

export function isTorrentComplete(progress, state) {
    if (state !== 'Seeding' && state !== 'Paused') return false
    const value = Number(progress)
    if (Number.isNaN(value)) return false
    // Deluge reports progress as 0–100 or 0–1 depending on the method
    const ratio = value > 1 ? value / 100 : value
    return ratio >= 0.999
}

export function torrentProgressRatio(progress) {
    const value = Number(progress)
    if (Number.isNaN(value)) return 0
    return value > 1 ? value / 100 : value
}

export function findTorrentStatus(torrents, hash) {
    if (!hash) return null
    if (torrents[hash]) return torrents[hash]
    const upper = hash.toUpperCase()
    if (torrents[upper]) return torrents[upper]
    const lower = String(hash).toLowerCase()
    if (torrents[lower]) return torrents[lower]
    for (const [key, status] of Object.entries(torrents)) {
        if (key.toLowerCase() === lower) return status
    }
    return null
}

function normalizeHashes(hashes) {
    return [...new Set((hashes || []).map(hash => String(hash).toLowerCase()).filter(Boolean))]
}

async function rawRpc(sessionId, method, params, timeoutMs) {
    const response = await fetch(`http://${process.env.DELUGE_HOST}:${process.env.DELUGE_PORT}/json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: sessionId },
        body: JSON.stringify({ method, params, id: rpcId++ }),
        signal: AbortSignal.timeout(timeoutMs),
    })
    if (!response.ok) throw new Error(`${method} failed: HTTP ${response.status}`)
    return response.json()
}

/**
 * Deluge JSON-RPC call. Pass `sessionId` null to use the cached session;
 * an expired session ("Not authenticated") is refreshed once transparently.
 */
export async function delugeRpc(sessionId, method, params = [], { timeoutMs = DELUGE_RPC_TIMEOUT_MS } = {}) {
    let session = sessionId || await authenticateDeluge()
    let result = await rawRpc(session, method, params, timeoutMs)

    if (result.error?.code === DELUGE_NOT_AUTHENTICATED) {
        invalidateDelugeSession()
        session = await authenticateDeluge({ force: true })
        result = await rawRpc(session, method, params, timeoutMs)
    }

    if (result.error) {
        const message = typeof result.error === 'string' ? result.error : (result.error.message || JSON.stringify(result.error))
        throw new Error(`${method} error: ${message}`)
    }
    return result.result
}

export async function getTorrentsStatus(sessionId, keys = ['progress', 'state', 'name']) {
    const result = await delugeRpc(sessionId, 'web.update_ui', [keys, {}])
    return result?.torrents || {}
}

/** Status of a single torrent, or null when Deluge doesn't know the hash. */
export async function getTorrentStatus(sessionId, hash, keys = ['progress', 'eta', 'state']) {
    const result = await delugeRpc(sessionId, 'web.get_torrent_status', [hash, keys])
    if (!result || Object.keys(result).length === 0) return null
    return result
}

export async function getTorrentInfo(sessionId, torrentPath) {
    return delugeRpc(sessionId, 'web.get_torrent_info', [torrentPath])
}

export async function removeTorrent(sessionId, hash, removeData = true) {
    return delugeRpc(sessionId, 'core.remove_torrent', [hash, removeData])
}

export async function forceRecheck(sessionId, hashes) {
    const ids = normalizeHashes(hashes)
    if (ids.length === 0) return
    await delugeRpc(sessionId, 'core.force_recheck', [ids])
}

export async function pauseTorrents(sessionId, hashes) {
    const ids = normalizeHashes(hashes)
    if (ids.length === 0) return
    await delugeRpc(sessionId, 'core.pause_torrent', [ids])
}

export async function resumeTorrents(sessionId, hashes) {
    const ids = normalizeHashes(hashes)
    if (ids.length === 0) return
    await delugeRpc(sessionId, 'core.resume_torrent', [ids])
}

export async function queueTop(sessionId, hashes) {
    const ids = normalizeHashes(hashes)
    if (ids.length === 0) return
    await delugeRpc(sessionId, 'core.queue_top', [ids])
}

export async function setAutoManaged(sessionId, hash, enabled) {
    if (!hash) return
    await delugeRpc(sessionId, 'core.set_auto_managed', [String(hash).toLowerCase(), enabled])
}
