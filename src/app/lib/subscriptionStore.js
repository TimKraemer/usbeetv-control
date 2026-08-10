import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'

function getDataDir() {
    return process.env.DATA_DIR || path.join(process.cwd(), 'data')
}

function getStorePath() {
    return path.join(getDataDir(), 'subscriptions.json')
}

// Serialize writes so concurrent updates (scheduler + API) don't clobber each other
let writeQueue = Promise.resolve()

async function readStore() {
    try {
        const raw = await readFile(getStorePath(), 'utf8')
        const parsed = JSON.parse(raw)
        return Array.isArray(parsed.subscriptions) ? parsed.subscriptions : []
    } catch (error) {
        if (error.code === 'ENOENT') return []
        console.error('[SubscriptionStore] Failed to read store, starting empty:', error.message)
        return []
    }
}

async function writeStore(subscriptions) {
    const storePath = getStorePath()
    await mkdir(path.dirname(storePath), { recursive: true })
    const tmpPath = `${storePath}.tmp`
    await writeFile(tmpPath, JSON.stringify({ subscriptions }, null, 2), 'utf8')
    await rename(tmpPath, storePath)
}

/** Run a read-modify-write transaction against the store, serialized. */
async function updateStore(mutator) {
    const task = writeQueue.then(async () => {
        const subscriptions = await readStore()
        const result = await mutator(subscriptions)
        await writeStore(subscriptions)
        return result
    })
    // Keep the queue alive even if this task fails
    writeQueue = task.catch(() => {})
    return task
}

export async function getSubscriptions() {
    return readStore()
}

export async function getSubscription(tmdbId) {
    const subscriptions = await readStore()
    return subscriptions.find(sub => sub.tmdbId === Number(tmdbId)) || null
}

export async function addSubscription({ tmdbId, title, language = 'de-DE' }) {
    return updateStore(subscriptions => {
        const id = Number(tmdbId)
        const existing = subscriptions.find(sub => sub.tmdbId === id)
        if (existing) {
            existing.active = true
            existing.title = title || existing.title
            existing.language = language
            return existing
        }
        const subscription = {
            tmdbId: id,
            title: title || '',
            language,
            active: true,
            createdAt: new Date().toISOString(),
            lastCheckedAt: null,
            downloaded: [],
        }
        subscriptions.push(subscription)
        return subscription
    })
}

export async function removeSubscription(tmdbId) {
    return updateStore(subscriptions => {
        const id = Number(tmdbId)
        const index = subscriptions.findIndex(sub => sub.tmdbId === id)
        if (index === -1) return false
        subscriptions.splice(index, 1)
        return true
    })
}

export async function setSubscriptionActive(tmdbId, active) {
    return updateStore(subscriptions => {
        const subscription = subscriptions.find(sub => sub.tmdbId === Number(tmdbId))
        if (!subscription) return null
        subscription.active = active
        return subscription
    })
}

export async function markEpisodeDownloaded(tmdbId, { season, episode, torrentId, torrentName }) {
    return updateStore(subscriptions => {
        const subscription = subscriptions.find(sub => sub.tmdbId === Number(tmdbId))
        if (!subscription) return null
        const alreadyMarked = subscription.downloaded.some(
            entry => entry.season === season && entry.episode === episode
        )
        if (!alreadyMarked) {
            subscription.downloaded.push({
                season,
                episode,
                torrentId,
                torrentName,
                at: new Date().toISOString(),
            })
        }
        return subscription
    })
}

export async function markSubscriptionChecked(tmdbId, { error = null } = {}) {
    return updateStore(subscriptions => {
        const subscription = subscriptions.find(sub => sub.tmdbId === Number(tmdbId))
        if (!subscription) return null
        subscription.lastCheckedAt = new Date().toISOString()
        subscription.lastError = error
        return subscription
    })
}
