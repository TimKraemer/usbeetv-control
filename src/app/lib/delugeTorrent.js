export function isTorrentComplete(progress, state) {
    if (state !== 'Seeding' && state !== 'Paused') return false
    const value = Number(progress)
    if (Number.isNaN(value)) return false
    // Deluge reports progress as 0–100 or 0–1 depending on the method
    const ratio = value > 1 ? value / 100 : value
    return ratio >= 0.999
}

export async function getTorrentsStatus(sessionId, keys = ['progress', 'state', 'name']) {
    const response = await fetch(`http://${process.env.DELUGE_HOST}:${process.env.DELUGE_PORT}/json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: sessionId },
        body: JSON.stringify({
            method: 'web.update_ui',
            params: [keys, {}],
            id: 5
        })
    })
    if (!response.ok) throw new Error(`Failed to fetch torrents: HTTP ${response.status}`)
    const result = await response.json()
    if (result.error) throw new Error(`Error fetching torrents: ${JSON.stringify(result.error)}`)
    return result.result?.torrents || {}
}
