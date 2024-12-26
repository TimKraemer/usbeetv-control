import { authenticateDeluge } from '@/app/lib/authenticateDeluge'
import { NextResponse } from 'next/server'

const tagScores = {
    'DL': 1, 'ML': 1,
    'HEVC': 1,
    'HDR10': 1, 'HDR10+': 1,
    'DTS': 1, 'DTSHD': 1, 'DTSHR': 1,
    'Dolby Vision': 1
}

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

async function downloadTorrent(sessionId, torrentUrl) {
    const response = await fetch(`http://${process.env.DELUGE_HOST}:${process.env.DELUGE_PORT}/json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': sessionId },
        body: JSON.stringify({ method: 'web.download_torrent_from_url', params: [torrentUrl], id: 2 })
    })
    if (!response.ok) throw new Error(`Torrent download failed: HTTP ${response.status}`)
    const result = await response.json()
    if (!result.result || result.error) throw new Error(`Error downloading torrent: ${result.error || 'Unknown error'}`)
    return result.result
}

async function addTorrent(sessionId, torrentPath, type) {
    const response = await fetch(`http://${process.env.DELUGE_HOST}:${process.env.DELUGE_PORT}/json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': sessionId },
        body: JSON.stringify({
            method: 'web.add_torrents',
            params: [[{
                path: torrentPath,
                options: {
                    move_completed: false,
                    // move_completed_path: type === 'movie' ? process.env.MOVIE_DOWNLOAD_PATH : process.env.TV_DOWNLOAD_PATH,
                    download_location: type === 'movie' ? process.env.MOVIE_DOWNLOAD_PATH : process.env.TV_DOWNLOAD_PATH,
                    pre_allocate_storage: true,
                    prioritize_first_last_pieces: true,
                    sequential_download: true,
                },
            }]],
            id: 3
        })
    })
    if (!response.ok) throw new Error(`Failed to add torrent: HTTP ${response.status} - ${await response.text()}`)
    const result = await response.json()
    if (result.error) throw new Error(`Error adding torrent: ${result.error}`)
    return result
}

async function sendToDeluge(torrentUrl, type) {
    try {
        const sessionId = await authenticateDeluge()
        const torrentPath = await downloadTorrent(sessionId, torrentUrl)
        const addedTorrents = await addTorrent(sessionId, torrentPath, type)
        return NextResponse.json({ hash: addedTorrents.result[0][1] })
    } catch (error) {
        return NextResponse.json({ message: `Error Deluge: ${error.message}` })
    }
}

export async function GET(request) {
    const { searchParams } = new URL(request.url)
    const tmdbId = searchParams.get('tmdbId')
    const type = searchParams.get('type')

    if (!tmdbId) {
        return NextResponse.json({ error: 'TMDB ID is required' }, { status: 400 })
    }

    try {
        const category = type === 'movie' ? '9' : '55'
        const response = await fetch(`${process.env.TS_API_URL}/browse.php?tmdbId=${tmdbId}&apikey=${process.env.TS_API_KEY}&cats=${category}`)
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)

        const data = await response.json()
        if (data.count === 0) return NextResponse.json({ error: 'No results found' }, { status: 404 })

        const filteredRows = data.rows.filter(row => row.trumped === 0 && row.seeders !== 0 && (type !== 'movie' || row.numfiles < 5))
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

