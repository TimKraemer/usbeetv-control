import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'

function getDataDir() {
    return process.env.DATA_DIR || path.join(process.cwd(), 'data')
}

function getStorePath() {
    return path.join(getDataDir(), 'pending-downloads.json')
}

let writeQueue = Promise.resolve()

function normalizeHash(hash) {
    return String(hash || '').trim().toLowerCase()
}

async function readStore() {
    try {
        const raw = await readFile(getStorePath(), 'utf8')
        const parsed = JSON.parse(raw)
        return Array.isArray(parsed.pending) ? parsed.pending : []
    } catch (error) {
        if (error.code === 'ENOENT') return []
        console.error('[PendingDownloads] Failed to read store, starting empty:', error.message)
        return []
    }
}

async function writeStore(pending) {
    const storePath = getStorePath()
    await mkdir(path.dirname(storePath), { recursive: true })
    const tmpPath = `${storePath}.tmp`
    await writeFile(tmpPath, JSON.stringify({ pending }, null, 2), 'utf8')
    await rename(tmpPath, storePath)
}

async function updateStore(mutator) {
    const task = writeQueue.then(async () => {
        const pending = await readStore()
        const result = await mutator(pending)
        await writeStore(pending)
        return result
    })
    writeQueue = task.catch(() => {})
    return task
}

export async function getPendingDownloads() {
    return readStore()
}

function upsertPending(pending, { hash, type = null }) {
    const normalized = normalizeHash(hash)
    if (!normalized) return null

    const existing = pending.find(item => item.hash === normalized)
    if (existing) {
        existing.type = type || existing.type
        return existing
    }
    const item = {
        hash: normalized,
        type,
        addedAt: new Date().toISOString(),
    }
    pending.push(item)
    return item
}

export async function addPendingDownload({ hash, type = null }) {
    return updateStore(pending => upsertPending(pending, { hash, type }))
}

export async function addPendingDownloads(items) {
    if (!items?.length) return 0

    return updateStore(pending => {
        let added = 0
        for (const item of items) {
            const before = pending.length
            upsertPending(pending, item)
            if (pending.length > before) added += 1
        }
        return added
    })
}

export async function removePendingDownloads(hashes) {
    const toRemove = new Set((hashes || []).map(normalizeHash).filter(Boolean))
    if (toRemove.size === 0) return 0

    return updateStore(pending => {
        let removed = 0
        for (let index = pending.length - 1; index >= 0; index--) {
            if (toRemove.has(pending[index].hash)) {
                pending.splice(index, 1)
                removed += 1
            }
        }
        return removed
    })
}
