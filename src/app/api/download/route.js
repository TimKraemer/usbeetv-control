import { sendToDeluge } from '@/app/lib/sendToDeluge'
import { NextResponse } from 'next/server'

const tagScores = {
    'DL': 1, 'ML': 1,
    'HEVC': 1,
    'HDR10': 1, 'HDR10+': 1,
    'DTS': 1, 'DTSHD': 1, 'DTSHR': 1,
    'Dolby Vision': 1,

}

const blacklist = ['.TS', 'telesync', ".CAM", ".HDTS"]

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
    // Categories 37 and 57 are "English only"
    // Categories 9 and 55 are "guaranteed German but maybe also English, depends if the name includes 'ML' or 'DL'"

    const isEnglishOnly = row.category === 37 || row.category === 57
    const isGermanGuaranteed = row.category === 9 || row.category === 55

    if (userLanguage === 'de-DE') {
        // User wants German
        if (isEnglishOnly) {
            return {
                valid: false,
                warning: `Diese${type === 'movie' ? 'r Film' : ' Serie'} ist nur auf Englisch verfügbar. Trotzdem laden?`
            }
        }
        // For German-guaranteed categories, both DL and ML include German, so no warning needed
    } else if (userLanguage === 'en-US') {
        // User wants English
        if (isGermanGuaranteed) {
            const hasML = row.tags.includes('ML')
            const hasDL = row.tags.includes('DL')

            // If it's German-guaranteed but has neither ML nor DL tags, it might be German-only
            if (!hasML && !hasDL) {
                return {
                    valid: false,
                    warning: `Diese${type === 'movie' ? 'r Film' : ' Serie'} ist möglicherweise nur auf Deutsch verfügbar. Trotzdem laden?`
                }
            }
            // If it has ML or DL tags, it includes English, so no warning needed
        }
    }

    return { valid: true }
}

export async function GET(request) {
    const { searchParams } = new URL(request.url)
    const tmdbId = searchParams.get('tmdbId')
    const type = searchParams.get('type')
    const language = searchParams.get('language') || 'de-DE'
    const force = searchParams.get('force') === 'true'

    if (!tmdbId) {
        return NextResponse.json({ error: 'TMDB ID is required' }, { status: 400 })
    }

    try {
        const categories = type === 'movie' ? '9,37' : '55,57'
        let response = await fetch(`${process.env.TS_API_URL}/browse.php?tmdbId=${tmdbId}&apikey=${process.env.TS_API_KEY}&cats=${categories}&release_type=Scene,P2P`)
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)

        let data = await response.json()
        if (data.count === 0) {
            // Retry without release_type filter
            response = await fetch(`${process.env.TS_API_URL}/browse.php?tmdbId=${tmdbId}&apikey=${process.env.TS_API_KEY}&cats=${categories}`)
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

        if (type === 'tv') {
            return NextResponse.json({
                error: 'TV shows now use season selection. Please use the season selection dialog to choose which seasons to download.',
                useSeasonSelection: true
            }, { status: 400 })
        }

        const bestRow = filteredRows[0]

        if (!force) {
            const languageValidation = validateLanguage(bestRow, language, type)

            if (!languageValidation.valid) {
                return NextResponse.json({ languageWarning: languageValidation.warning })
            }
        }

        const result = await sendToDeluge(`https://torrent-syndikat.org/download.php?id=${bestRow.id}&apikey=${process.env.TS_API_KEY}`, type)
        return NextResponse.json(result)
    } catch (error) {
        return NextResponse.json({ error: `Error fetching data: ${error}` }, { status: 500 })
    }
}

