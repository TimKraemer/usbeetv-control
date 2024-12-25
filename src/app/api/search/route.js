import axios from 'axios'
import { NextResponse } from 'next/server'

export async function GET(request) {
    const { searchParams } = new URL(request.url)
    const searchstring = searchParams.get('searchstring')
    const searchType = searchParams.get('type') || 'movie' // 'movie' or 'tv'
    const language = searchParams.get('language') || 'de-DE'

    if (!searchstring) {
        return NextResponse.json({ error: 'Search string is required' }, { status: 400 })
    }

    try {
        // const allRows = await fetchAllRowsFromTSAPI(searchstring, ponly)
        // const uniquePids = extractUniquePidsFromTSAPI(allRows)
        // const pidDetails = await fetchPidDetailsFromTSAPI(uniquePids)
        const tmdbResults = await searchTMDB(searchstring, searchType, language)

        const response = NextResponse.json({
            // count: allRows.length,
            // rows: allRows,
            // total: allRows.length,
            // uniquePids,
            // pidDetails,
            tmdbResults,
        })
        response.headers.set('Cache-Control', 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400')

        return response
    } catch (error) {
        return NextResponse.json({ error: `Error fetching data: ${error}` }, { status: 500 })
    }
}

async function fetchAllRowsFromTSAPI(searchstring, ponly) {
    let allRows = []
    let offset = 0
    let total = 0

    do {
        const response = await axios.get(`${process.env.TS_API_URL}/browse.php`, {
            params: {
                searchstring,
                ponly,
                apikey: process.env.TS_API_KEY,
                limit: 50,
                offset,
            },
        })

        const { rows, total: responseTotal } = response.data
        allRows = allRows.concat(rows)
        total = responseTotal
        offset += 50
    } while (offset < total)

    return allRows
}

function extractUniquePidsFromTSAPI(rows) {
    const pidSet = new Set()

    for (const row of rows) {
        if (row.pid !== undefined && row.pid !== null) {
            pidSet.add(row.pid)
        }
    }

    return Array.from(pidSet)
}

async function fetchPidDetailsFromTSAPI(uniquePids) {
    const pidDetails = []

    for (const pid of uniquePids) {
        const pidResponse = await axios.get(`${process.env.TS_API_URL}/product.php`, {
            params: {
                pid,
                apikey: process.env.TS_API_KEY,
            },
        })
        if (pidResponse.data.error) {
            throw new Error(`Error fetching data for PID ${pid}: ${pidResponse.data.error}`)
        }
        pidDetails.push(pidResponse.data)
    }

    return pidDetails
}

async function searchTMDB(query, type = 'movie', language = 'de-DE') {
    const url = `https://api.themoviedb.org/3/search/${type}`
    const response = await axios.get(url, {
        params: {
            api_key: process.env.TMDB_API_KEY,
            language,
            query,
        },
    })

    if (response.data.errors) {
        throw new Error(`TMDB API error: ${response.data.errors.join(', ')}`)
    }

    return response.data.results
}

