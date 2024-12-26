import axios from 'axios'
import { NextResponse } from 'next/server'

function rankRow(row) {
    const tags = row.tags
    let score = 0

    const tagScores = {
        'DL': 1, 'ML': 1,
        'HEVC': 1,
        'HDR10': 1, 'HDR10+': 1,
        'DTS': 1, 'DTSHD': 1, 'DTSHR': 1,
        'Dolby Vision': 1
    }

    for (const tag of tags) {
        if (tagScores[tag]) {
            score += tagScores[tag]
        }
    }

    if (row.name.includes('BluRay') || row.name.includes('BDRiP')) {
        score += 1
    }

    return score
}

export async function GET(request) {
    const { searchParams } = new URL(request.url)
    const tmdbId = searchParams.get('tmdbId')

    if (!tmdbId) {
        return NextResponse.json({ error: 'TMDB ID is required' }, { status: 400 })
    }

    try {
        const response = await axios.get(`${process.env.TS_API_URL}/browse.php`, {
            params: {
                tmdbId,
                apikey: process.env.TS_API_KEY,
                cats: "9,53"
            },
        })

        if (response.data.count === 0) {
            return NextResponse.json({ error: 'No results found' }, { status: 404 })
        }

        const filteredRows = response.data.rows.filter(row => row.trumped === 0 && row.seeders !== 0 && row.numfiles < 5)


        filteredRows.sort((a, b) => {
            const scoreDifference = rankRow(b) - rankRow(a)
            if (scoreDifference !== 0) {
                return scoreDifference
            }
            return a.added - b.added
        })

        const bestRow = filteredRows[0]
        // return NextResponse.json(bestRow.id)

        const downloadResponse = await axios.get("https://torrent-syndikat.org/download.php", {
            params: {
                id: bestRow.id,
                apikey: process.env.TS_API_KEY,
            },
            responseType: 'arraybuffer'
        })

        const fileName = `${bestRow.name}.torrent`
        return new NextResponse(downloadResponse.data, {
            headers: {
                'Content-Type': 'application/x-bittorrent',
                'Content-Disposition': `attachment; filename="${fileName}"`,
            },
        })
    } catch (error) {
        return NextResponse.json({ error: `Error fetching data: ${error}` }, { status: 500 })
    }
}

