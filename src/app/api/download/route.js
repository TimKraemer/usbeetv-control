import { sendToDeluge } from '@/app/lib/sendToDeluge'
import { NextResponse } from 'next/server'

const tagScores = {
    'DL': 1, 'ML': 1,
    'HEVC': 1,
    'HDR10': 1, 'HDR10+': 1,
    'DTS': 1, 'DTSHD': 1, 'DTSHR': 1,
    'Dolby Vision': 1
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


export async function GET(request) {
    const { searchParams } = new URL(request.url)
    const tmdbId = searchParams.get('tmdbId')
    const type = searchParams.get('type')

    if (!tmdbId) {
        return NextResponse.json({ error: 'TMDB ID is required' }, { status: 400 })
    }

    try {
        const categories = type === 'movie' ? '9,37' : '55,57'
        const response = await fetch(`${process.env.TS_API_URL}/browse.php?tmdbId=${tmdbId}&apikey=${process.env.TS_API_KEY}&cats=${categories}`)
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)

        const data = await response.json()
        if (data.count === 0) return NextResponse.json({ error: 'No results found' }, { status: 404 })

        const filteredRows = data.rows.filter(row =>
            row.trumped === 0 &&
            row.seeders !== 0 &&
            (type !== 'movie' || row.numfiles < 5) &&
            !blacklist.some(term => row.name.toLowerCase().includes(term.toLowerCase()))
        )
        filteredRows.sort((a, b) => rankRow(b) - rankRow(a) || a.added - b.added)
        if (type === 'tv') {
            const seasonMap = new Map()

            for (const row of filteredRows) {
                const seasonMatch = row.name.match(/S\d{2}/)
                if (seasonMatch) {
                    const season = seasonMatch[0]
                    if (!seasonMap.has(season) || rankRow(row) > rankRow(seasonMap.get(season))) {
                        seasonMap.set(season, row)
                    }
                }
            }

            const bestRows = Array.from(seasonMap.values())
            const results = []

            for (const bestRow of bestRows) {
                const result = await sendToDeluge(`https://torrent-syndikat.org/download.php?id=${bestRow.id}&apikey=${process.env.TS_API_KEY}`, type)
                results.push(result)
            }

            return NextResponse.json({ filteredRows, results, bestRows })
        }
        const bestRow = filteredRows[0]
        return await sendToDeluge(`https://torrent-syndikat.org/download.php?id=${bestRow.id}&apikey=${process.env.TS_API_KEY}`, type)
    } catch (error) {
        return NextResponse.json({ error: `Error fetching data: ${error}` }, { status: 500 })
    }
}

