import { createListStore } from '@/app/lib/jsonStore'

const { read: readStore, update: updateStore } = createListStore('subscriptions.json', 'subscriptions')

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
