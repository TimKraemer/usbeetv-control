import { sendToDeluge } from '@/app/lib/sendToDeluge'
import { NextResponse } from 'next/server'
import { Agent } from 'undici'

// Custom agent with extended connect timeout for slow torrent server
const slowServerAgent = new Agent({
    connect: {
        timeout: 60000 // 1 minute connect timeout per attempt
    }
})

const TORRENT_API_TIMEOUT = 60000 // 1 minute timeout per attempt
const MAX_RETRIES = 3

// Fetch with automatic retry logic
async function fetchWithRetry(url, options = {}) {
    let lastError
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            console.log(`[Torrent API] Attempt ${attempt}/${MAX_RETRIES}...`)
            const response = await fetch(url, {
                ...options,
                signal: AbortSignal.timeout(TORRENT_API_TIMEOUT),
                dispatcher: slowServerAgent
            })
            return response
        } catch (error) {
            lastError = error
            console.log(`[Torrent API] Attempt ${attempt} failed: ${error.message}`)
            if (attempt < MAX_RETRIES) {
                console.log(`[Torrent API] Retrying in 2 seconds...`)
                await new Promise(resolve => setTimeout(resolve, 2000))
            }
        }
    }
    throw lastError
}

const tagScores = {
    'DL': 1, 'ML': 1,
    'HEVC': 1,
    'HDR10': 1, 'HDR10+': 1,
    'DTS': 1, 'DTSHD': 1, 'DTSHR': 1,
    'Dolby Vision': 1,
}

const blacklist = ['.TS.', 'telesync', ".CAM"]

function rankRow(row) {
    let score = 0
    for (const tag of row.tags) {
        score += tagScores[tag] || 0
    }
    if (row.name.includes('BluRay') || row.name.includes('BDRiP')) {
        score += 1
    }
    return score
}

function validateLanguage(row, userLanguage, type) {
    const isEnglishOnly = row.category === 37 || row.category === 57
    const isGermanGuaranteed = row.category === 9 || row.category === 55

    if (userLanguage === 'de-DE') {
        if (isEnglishOnly) {
            return {
                valid: false,
                warning: `Diese${type === 'movie' ? 'r Film' : ' Serie'} ist nur auf Englisch verfügbar. Trotzdem laden?`
            }
        }
    } else if (userLanguage === 'en-US') {
        if (isGermanGuaranteed) {
            const hasML = row.tags.includes('ML')
            const hasDL = row.tags.includes('DL')

            if (!hasML && !hasDL) {
                return {
                    valid: false,
                    warning: `Diese${type === 'movie' ? 'r Film' : ' Serie'} ist möglicherweise nur auf Deutsch verfügbar. Trotzdem laden?`
                }
            }
        }
    }

    return { valid: true }
}

export async function POST(request) {
    try {
        const body = await request.json()
        const { tmdbId, selectedSeasons, language = 'de-DE', force = false } = body

        if (!tmdbId || !selectedSeasons || selectedSeasons.length === 0) {
            return NextResponse.json({ error: 'TMDB ID and selected seasons are required' }, { status: 400 })
        }

        const categories = '55,57'
        let response = await fetchWithRetry(`${process.env.TS_API_URL}/browse.php?tmdbId=${tmdbId}&apikey=${process.env.TS_API_KEY}&cats=${categories}&release_type=Scene,P2P`)
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)

        let data = await response.json()
        if (data.count === 0) {
            // Retry without release_type filter
            response = await fetchWithRetry(`${process.env.TS_API_URL}/browse.php?tmdbId=${tmdbId}&apikey=${process.env.TS_API_KEY}&cats=${categories}`)
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
            data = await response.json()
            if (data.count === 0) return NextResponse.json({ error: 'No results found' }, { status: 404 })
        }

        const filteredRows = data.rows.filter(row =>
            row.trumped === 0 &&
            row.seeders !== 0 &&
            !blacklist.some(term => row.name.toLowerCase().includes(term.toLowerCase()))
        )
        filteredRows.sort((a, b) => rankRow(b) - rankRow(a) || a.added - b.added)

        // Group torrents by season
        const seasonMap = new Map()
        for (const row of filteredRows) {
            const seasonMatch = row.name.match(/S(\d{2})/)
            if (seasonMatch) {
                const seasonNumber = Number.parseInt(seasonMatch[1])
                if (!seasonMap.has(seasonNumber) || rankRow(row) > rankRow(seasonMap.get(seasonNumber))) {
                    seasonMap.set(seasonNumber, row)
                }
            }
        }

        // Find best torrents for selected seasons
        const results = []
        let hasLanguageWarning = false

        for (const seasonNumber of selectedSeasons) {
            const bestRow = seasonMap.get(seasonNumber)

            if (!bestRow) {
                results.push({
                    seasonNumber,
                    error: `No torrent found for Season ${seasonNumber}`
                })
                continue
            }

            if (!force) {
                const languageValidation = validateLanguage(bestRow, language, 'tv')
                if (!languageValidation.valid && !hasLanguageWarning) {
                    hasLanguageWarning = true
                    return NextResponse.json({
                        languageWarning: languageValidation.warning,
                        seasonNumber
                    })
                }
            }

            try {
                const result = await sendToDeluge(
                    `https://torrent-syndikat.org/download.php?id=${bestRow.id}&apikey=${process.env.TS_API_KEY}`,
                    'tv'
                )
                console.log('sendToDeluge result for season', seasonNumber, ':', result)
                results.push({
                    seasonNumber,
                    success: true,
                    ...result
                })
            } catch (error) {
                console.error('Error in sendToDeluge for season', seasonNumber, ':', error)
                results.push({
                    seasonNumber,
                    error: error.message
                })
            }
        }

        return NextResponse.json({ results })

    } catch (error) {
        return NextResponse.json({ error: `Error downloading seasons: ${error.message}` }, { status: 500 })
    }
} 