// Temporarily disable SSL certificate verification for development
if (process.env.NODE_ENV === 'development') {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
}

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

    try {
        const options = {
            method,
            headers: {
                'X-Emby-Token': process.env.JELLYFIN_API_KEY,
                'Content-Type': 'application/json',
            },
            // Add timeout to prevent hanging requests
            signal: AbortSignal.timeout(10000) // 10 second timeout
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
        if (error.name === 'AbortError') {
            throw new Error('Request to Jellyfin timed out after 10 seconds')
        }
        if (error.code === 'ECONNREFUSED') {
            throw new Error(`Cannot connect to Jellyfin at ${process.env.JELLYFIN_HOST}:${process.env.JELLYFIN_PORT}. Please check if Jellyfin is running and the host/port are correct.`)
        }
        throw error
    }
}

export async function triggerLibraryScan() {
    try {
        // Trigger a scan of all libraries using the correct scheduled task endpoint
        const result = await fetchFromJellyfin('/ScheduledTasks/Running/7738148ffcd07979c7ceb148e06b3aed', '', 'POST')
        console.log('[INFO] Jellyfin library scan triggered successfully')
        return result
    } catch (error) {
        console.error('[ERROR] Failed to trigger Jellyfin library scan:', error.message)
        throw error
    }
} 