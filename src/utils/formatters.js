export const formatBytes = (bytes, decimals = 2) => {
    if (bytes === 0) return '0 Bytes'

    const k = 1024
    const dm = decimals < 0 ? 0 : decimals
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']

    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return `${Number.parseFloat((bytes / (k ** i)).toFixed(dm))} ${sizes[i]}`
}

export const formatCurrency = (amount, currency = 'EUR', locale = 'de-DE') => {
    return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currency
    }).format(amount)
}

export const formatDate = (date, options = {}) => {
    const defaultOptions = {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        ...options
    }

    return new Date(date).toLocaleString('de-DE', defaultOptions)
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

export const formatPercentage = (value, maxValue = 100, decimals = 1) => {
    const percentage = (value / maxValue) * 100
    return `${percentage.toFixed(decimals)}%`
}

export const sanitizeSearchString = (str) => {
    return str.trim().replace(/[^a-zA-Z0-9äöüÄÖÜß ]/g, '')
} 