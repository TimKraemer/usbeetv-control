import { findSeriesByTmdbId, getSeriesSeasonNumbers } from '@/app/lib/jellyfinApi'
import { getTvShowDetails } from '@/app/lib/tmdbApi'
import {
    fetchTorrentsByTmdbId,
    isSeasonPack,
    parseSeasonEpisode,
    pickBestByKey,
    sortTorrents,
    summarizeTorrent,
} from '@/app/lib/tsApi'
import { NextResponse } from 'next/server'

function relevantSeasonNumbers(allSeasons) {
    return allSeasons
        .filter(season => season.season_number > 0 && season.episode_count > 0)
        .map(season => season.season_number)
}

export async function GET(request) {
    const { searchParams } = new URL(request.url)
    const tmdbId = searchParams.get('tmdbId')
    const language = searchParams.get('language') || 'de-DE'

    if (!tmdbId) {
        return NextResponse.json({ error: 'TMDB ID is required' }, { status: 400 })
    }

    try {
        // TMDB details, Jellyfin status and torrents are independent: load them in parallel
        const [tvShowDetails, libraryResult, rows] = await Promise.all([
            getTvShowDetails(tmdbId),
            (async () => {
                const matchedSeries = await findSeriesByTmdbId(tmdbId)
                if (!matchedSeries) return { matchedSeries: null, existingSeasons: [] }
                const existingSeasons = await getSeriesSeasonNumbers(matchedSeries.Id)
                return { matchedSeries, existingSeasons }
            })().catch(jellyfinError => {
                console.warn(`[Seasons] Jellyfin unavailable, treating all seasons as missing: ${jellyfinError.message}`)
                return { matchedSeries: null, existingSeasons: [] }
            }),
            fetchTorrentsByTmdbId(tmdbId, 'series'),
        ])

        const isEnded = tvShowDetails.status === 'Ended'
        const totalSeasons = tvShowDetails.number_of_seasons
        const allSeasons = tvShowDetails.seasons || []
        const originalLanguage = tvShowDetails.original_language || null
        const { matchedSeries, existingSeasons } = libraryResult
        const missingSeasons = relevantSeasonNumbers(allSeasons)
            .filter(seasonNumber => !existingSeasons.includes(seasonNumber))

        // sortTorrents encodes the full preference order (language match,
        // quality incl. Dolby Vision penalty, age), so the first row per key wins
        const sortedRows = sortTorrents(rows, { userLanguage: language, originalLanguage })
        const seasonPackMap = pickBestByKey(sortedRows, row => {
            if (!isSeasonPack(row)) return null
            return parseSeasonEpisode(row.name).season
        })
        const episodeMap = new Map() // season -> Set(episode)
        for (const row of sortedRows) {
            const parsed = parseSeasonEpisode(row.name)
            if (!parsed || parsed.episode === null) continue
            if (!episodeMap.has(parsed.season)) episodeMap.set(parsed.season, new Set())
            episodeMap.get(parsed.season).add(parsed.episode)
        }

        const availableSeasons = []
        for (const season of allSeasons) {
            if (season.season_number <= 0 || season.episode_count <= 0) continue
            const seasonNumber = season.season_number
            const torrentRow = seasonPackMap.get(seasonNumber)
            const availableEpisodes = [...(episodeMap.get(seasonNumber) || [])].sort((a, b) => a - b)

            availableSeasons.push({
                seasonNumber,
                name: season.name,
                episodeCount: season.episode_count,
                airDate: season.air_date,
                existsInLibrary: existingSeasons.includes(seasonNumber),
                isMissing: missingSeasons.includes(seasonNumber),
                hasTorrent: Boolean(torrentRow),
                availableEpisodes,
                availableEpisodeCount: availableEpisodes.length,
                torrentInfo: summarizeTorrent(torrentRow),
            })
        }

        return NextResponse.json({
            showInfo: {
                name: tvShowDetails.name,
                isEnded,
                totalSeasons,
                exists: Boolean(matchedSeries),
                originalLanguage
            },
            seasons: availableSeasons
        })
    } catch (error) {
        return NextResponse.json({ error: `Error fetching season data: ${error.message}` }, { status: 500 })
    }
}
