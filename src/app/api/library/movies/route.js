import { NextResponse } from 'next/server'

// Temporarily disable SSL certificate verification for development
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const JELLYFIN_TIMEOUT_MS = 5000
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 1000

async function fetchFromJellyfin(endpoint, queryParams = '') {
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
            const response = await fetch(url, {
                headers: {
                    'X-Emby-Token': process.env.JELLYFIN_API_KEY,
                },
                signal: AbortSignal.timeout(JELLYFIN_TIMEOUT_MS),
            })

            if (!response.ok) {
                throw new Error(`Jellyfin API returned ${response.status}: ${response.statusText}`)
            }

            return await response.json()
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

export async function GET(req) {
    const { searchParams } = new URL(req.url)
    const tmdbId = searchParams.get('tmdbId')

    if (!tmdbId) {
        return NextResponse.json({ error: 'TMDB ID is required' }, { status: 400 })
    }

    try {
        const data = await fetchFromJellyfin('/Items', '?Recursive=true&IncludeItemTypes=Movie&Fields=ProviderIds&Filters=IsNotFolder')
        const items = data.Items || []

        let exists = false
        for (const item of items) {
            if (item.ProviderIds?.Tmdb === tmdbId) {
                exists = true
                break
            }
        }

        return NextResponse.json({ exists })
    } catch (error) {
        console.error('[ERROR] Failed to check movie in Jellyfin:', error.message)
        return NextResponse.json({
            error: `Failed to check movie: ${error.message}`,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }, { status: 500 })
    }
}
