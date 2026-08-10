// Temporarily disable SSL certificate verification for development
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const JELLYFIN_TIMEOUT_MS = 5000
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 1000

async function fetchFromJellyfin(endpoint, queryParams = '', method = 'GET', body = null) {
    // Validate environment variables
    if (!process.env.JELLYFIN_HOST) {
        throw new Error('JELLYFIN_HOST environment variable is not set')
    }
    if (!process.env.JELLYFIN_PORT) {
        throw new Error('JELLYFIN_PORT environment variable is not set')
    }
    if (!process.env.JELLYFIN_API_KEY) {
        throw new Error('JELLYFIN_API_KEY environment variable is not set')
    }

    const url = `https://${process.env.JELLYFIN_HOST}:${process.env.JELLYFIN_PORT}${endpoint}${queryParams}`
    let lastError

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const options = {
                method,
                headers: {
                    'X-Emby-Token': process.env.JELLYFIN_API_KEY,
                    'Content-Type': 'application/json',
                },
                signal: AbortSignal.timeout(JELLYFIN_TIMEOUT_MS),
            }

            if (body && method !== 'GET') {
                options.body = JSON.stringify(body)
            }

            const response = await fetch(url, options)

            if (!response.ok) {
                throw new Error(`Jellyfin API returned ${response.status}: ${response.statusText}`)
            }

            // For POST requests that don't return JSON, return success status
            if (method === 'POST' && response.status === 204) {
                return { success: true }
            }

            return response.json()
        } catch (error) {
            lastError = error
            const isTimeout = error.name === 'TimeoutError' || error.name === 'AbortError'
            console.warn(`[Jellyfin] Attempt ${attempt}/${MAX_RETRIES} failed: ${error.message}`)

            if (attempt < MAX_RETRIES) {
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS))
                continue
            }

            if (isTimeout) {
                throw new Error(`Request to Jellyfin timed out after ${JELLYFIN_TIMEOUT_MS}ms (${MAX_RETRIES} attempts)`)
            }
            if (error.code === 'ECONNREFUSED') {
                throw new Error(`Cannot connect to Jellyfin at ${process.env.JELLYFIN_HOST}:${process.env.JELLYFIN_PORT}. Please check if Jellyfin is running and the host/port are correct.`)
            }
            throw error
        }
    }

    throw lastError
}

export async function triggerLibraryScan() {
    try {
        // Global dedupe to avoid rapid repeated triggers
        if (!globalThis.__jellyfinScanCooldown) {
            globalThis.__jellyfinScanCooldown = { lastAt: 0 }
        }
        const now = Date.now()
        const COOLDOWN_MS = 60 * 1000 // 1 minute
        if (now - globalThis.__jellyfinScanCooldown.lastAt < COOLDOWN_MS) {
            return { success: true, skipped: true }
        }
        globalThis.__jellyfinScanCooldown.lastAt = now

        // Trigger a scan of all libraries using the official Library/Refresh endpoint
        // Note: Jellyfin's API doesn't support scanning specific libraries only
        const result = await fetchFromJellyfin('/Library/Refresh', '', 'POST')
        console.info('[INFO] Jellyfin library scan triggered successfully')
        return result
    } catch (error) {
        console.error('[ERROR] Failed to trigger Jellyfin library scan:', error.message)
        throw error
    }
}

export async function getLibraryFolders() {
    try {
        // Get all library folders from Jellyfin
        const result = await fetchFromJellyfin('/Library/VirtualFolders')
        console.info('[INFO] Retrieved library folders from Jellyfin')
        return result
    } catch (error) {
        console.error('[ERROR] Failed to get library folders from Jellyfin:', error.message)
        throw error
    }
}