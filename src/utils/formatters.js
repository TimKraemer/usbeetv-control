export const formatBytes = (bytes, decimals = 2) => {
    if (!bytes || bytes <= 0) return '0 Bytes'

    const k = 1024
    const dm = decimals < 0 ? 0 : decimals
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']

    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1)

    return `${Number.parseFloat((bytes / (k ** i)).toFixed(dm))} ${sizes[i]}`
}

export const formatEta = (eta) => {
    if (!eta || eta <= 0) return 'N/A'

    const seconds = eta % 60
    const minutes = Math.floor(eta / 60) % 60
    const hours = Math.floor(eta / 3600)

    const parts = []
    if (hours > 0) parts.push(`${hours}h`)
    if (minutes > 0) parts.push(`${minutes}m`)
    if (seconds > 0) parts.push(`${seconds}s`)

    return parts.join(' ') || '0s'
}

// Keep letters/digits of every script (é, ñ, kanji, …) plus the punctuation
// common in titles; TMDB handles those fine and the query is URL-encoded later.
export const sanitizeSearchString = (str) => {
    return String(str || '')
        .replace(/[^\p{L}\p{N}\s'&:.!?-]/gu, '')
        .replace(/\s+/g, ' ')
        .trim()
} 