import { Agent } from 'undici'

// Custom agent with extended connect timeout for slow torrent server
const slowServerAgent = new Agent({
    connect: {
        timeout: 60000 // 1 minute connect timeout per attempt
    }
})

const TORRENT_API_TIMEOUT = 60000 // 1 minute timeout per attempt
const MAX_RETRIES = 3
const MAX_PAGES = 20 // safety cap for paging loops

const blacklist = ['.TS.', 'telesync', '.CAM', '.HDTS']

// v2 tags are lowercase
const tagScores = {
    dl: 1, ml: 1,
    hevc: 1,
    hdr10: 1, hdr10plus: 1, dv: 1,
    dts: 1, dtshd: 1, dtshr: 1,
}

export function getApiBaseUrl() {
    if (process.env.TS_API2_URL) return process.env.TS_API2_URL.replace(/\/$/, '')
    if (process.env.TS_API_URL) {
        // Derive v2 base from the v1 URL (…/v1 -> …/v2)
        return `${process.env.TS_API_URL.replace(/\/v1\/?$/, '')}/v2`
    }
    throw new Error('TS_API2_URL (or TS_API_URL) environment variable is not set')
}

function getApiKey() {
    if (!process.env.TS_API2_KEY) {
        throw new Error('TS_API2_KEY environment variable is not set')
    }
    return process.env.TS_API2_KEY
}

async function tsFetchJson(path, params = {}) {
    const url = new URL(`${getApiBaseUrl()}${path}`)
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) url.searchParams.set(key, value)
    }

    let lastError
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            console.log(`[TS APIv2] ${path} attempt ${attempt}/${MAX_RETRIES}...`)
            const response = await fetch(url, {
                headers: {
                    apiKey: getApiKey(),
                    Accept: 'application/json',
                },
                signal: AbortSignal.timeout(TORRENT_API_TIMEOUT),
                dispatcher: slowServerAgent,
            })
            if (!response.ok) {
                throw new Error(`TS APIv2 ${path} returned ${response.status}: ${response.statusText}`)
            }
            return await response.json()
        } catch (error) {
            lastError = error
            console.log(`[TS APIv2] Attempt ${attempt} failed: ${error.message}`)
            if (attempt < MAX_RETRIES) {
                await new Promise(resolve => setTimeout(resolve, 2000))
            }
        }
    }
    throw lastError
}

function isBlacklisted(row) {
    return blacklist.some(term => row.name.toLowerCase().includes(term.toLowerCase()))
}

/**
 * Fetch all torrents for a TMDB id via the v2 uniqueId endpoint (pages through
 * all results). The endpoint intentionally has no server-side filters, so we
 * filter client-side: product type match (TMDB ids collide between movies and
 * TV shows), not trumped/deprecated, has seeders, not blacklisted.
 *
 * @param {number|string} tmdbId
 * @param {'series'|'movie'} productType
 */
export async function fetchTorrentsByTmdbId(tmdbId, productType) {
    const rows = []
    let pageId = null

    for (let page = 0; page < MAX_PAGES; page++) {
        const data = await tsFetchJson('/torrents/uniqueId.php', {
            id: `tmdb:${tmdbId}`,
            ...(pageId ? { pageId } : {}),
        })
        rows.push(...(data.data || []))
        if (!data.nextPageId) break
        pageId = data.nextPageId
    }

    return rows.filter(row =>
        row.product?.productType === productType &&
        !row.isTrumped &&
        !row.isDeprecated &&
        row.seeders !== 0 &&
        !isBlacklisted(row)
    )
}

/** v2 download URL for a torrent id, usable by sendToDeluge. */
export function getDownloadUrl(torrentId) {
    return `${getApiBaseUrl()}/torrents/download.php?id=${torrentId}&apiKey=${getApiKey()}`
}

export function rankTorrent(row) {
    let score = 0
    for (const tag of row.tags || []) {
        score += tagScores[tag] || 0
    }
    if (row.name.includes('BluRay') || row.name.includes('BDRiP')) {
        score += 1
    }
    return score
}

/**
 * Determine available audio tracks from v2 signals (empirically verified):
 * - isForeign === 1        -> original audio only, no German
 * - isForeign === 0 + dl/ml -> German + original audio
 * - isForeign === 0 alone  -> German only
 *
 * TS does not know which language the "original" audio is, so we combine with
 * TMDB's original_language (null/undefined is treated as English, the most
 * common case).
 */
export function getTorrentLanguages(row, originalLanguage) {
    const tags = row.tags || []
    const hasOriginalAudio = row.isForeign === 1 || tags.includes('dl') || tags.includes('ml')
    const originalIsEnglish = !originalLanguage || originalLanguage === 'en'
    return {
        hasGerman: row.isForeign === 0,
        hasEnglish: hasOriginalAudio && originalIsEnglish,
    }
}

export function matchesLanguage(row, userLanguage, originalLanguage) {
    const { hasGerman, hasEnglish } = getTorrentLanguages(row, originalLanguage)
    if (userLanguage === 'en-US') return hasEnglish
    return hasGerman
}

export function validateLanguage(row, userLanguage, originalLanguage, type) {
    const { hasGerman, hasEnglish } = getTorrentLanguages(row, originalLanguage)
    const subject = type === 'movie' ? 'r Film' : ' Serie'

    if (userLanguage === 'de-DE' && !hasGerman) {
        return {
            valid: false,
            warning: `Diese${subject} ist nur in der Originalsprache verfügbar. Trotzdem laden?`
        }
    }

    if (userLanguage === 'en-US' && !hasEnglish) {
        return {
            valid: false,
            warning: `Diese${subject} enthält möglicherweise keine englische Tonspur. Trotzdem laden?`
        }
    }

    return { valid: true }
}

/**
 * Sort torrents: language match first (so warnings only appear when no
 * matching release exists at all), then quality score, then oldest first
 * (matches previous behavior).
 */
export function sortTorrents(rows, { userLanguage, originalLanguage } = {}) {
    return [...rows].sort((a, b) => {
        if (userLanguage) {
            const langA = matchesLanguage(a, userLanguage, originalLanguage) ? 1 : 0
            const langB = matchesLanguage(b, userLanguage, originalLanguage) ? 1 : 0
            if (langA !== langB) return langB - langA
        }
        return rankTorrent(b) - rankTorrent(a) || a.added - b.added
    })
}

const SEASON_EPISODE_REGEX = /S(\d{2,3})E(\d{2,3})/i
const SEASON_REGEX = /S(\d{2,3})(?!E\d)/i

/** Parse season/episode info from a release name. */
export function parseSeasonEpisode(name) {
    const episodeMatch = name.match(SEASON_EPISODE_REGEX)
    if (episodeMatch) {
        return {
            season: Number.parseInt(episodeMatch[1], 10),
            episode: Number.parseInt(episodeMatch[2], 10),
        }
    }
    const seasonMatch = name.match(SEASON_REGEX)
    if (seasonMatch) {
        return { season: Number.parseInt(seasonMatch[1], 10), episode: null }
    }
    return null
}

/** True if the torrent is a full-season pack (not a single episode release). */
export function isSeasonPack(row) {
    const parsed = parseSeasonEpisode(row.name)
    return row.isPack === 1 && parsed !== null && parsed.episode === null
}

/** True if the torrent is a single episode release. */
export function isEpisodeRelease(row) {
    const parsed = parseSeasonEpisode(row.name)
    return parsed !== null && parsed.episode !== null
}
