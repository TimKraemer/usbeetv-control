import { describe, expect, test } from 'bun:test'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { isTorrentComplete } from '@/app/lib/delugeTorrent'
import { createListStore } from '@/app/lib/jsonStore'
import { getAllAiredEpisodes } from '@/app/lib/subscriptionChecker'
import { parseSeasonEpisode, sortTorrents } from '@/app/lib/tsApi'

const row = (name, extra = {}) => ({ name, tags: [], isForeign: 0, added: 1, ...extra })

describe('sortTorrents', () => {
    test('Dolby Vision sinks below every other release, whatever its tags', () => {
        const dv = row('Film.2020.German.DL.DV.HDR10.2160p', { tags: ['dl', 'hevc', 'hdr10', 'dts'] })
        const plain = row('Film.2020.German.1080p')
        expect(sortTorrents([dv, plain], { userLanguage: 'de-DE' })[0]).toBe(plain)
    })

    test('language match beats quality', () => {
        const foreign = row('Film.2020.BluRay.2160p', { isForeign: 1, tags: ['hevc', 'hdr10'] })
        const german = row('Film.2020.German.720p')
        expect(sortTorrents([foreign, german], { userLanguage: 'de-DE' })[0]).toBe(german)
    })
})

test('parseSeasonEpisode', () => {
    expect(parseSeasonEpisode('Show.S01E02.German.1080p')).toEqual({ season: 1, episode: 2 })
    expect(parseSeasonEpisode('Show.S03.German.DL.1080p')).toEqual({ season: 3, episode: null })
    expect(parseSeasonEpisode('Film.2020.German.1080p')).toBeNull()
})

test('isTorrentComplete', () => {
    expect(isTorrentComplete(100, 'Seeding')).toBe(true)
    expect(isTorrentComplete(1, 'Paused')).toBe(true)
    // Finished torrent waiting in a full seed queue
    expect(isTorrentComplete(100, 'Queued')).toBe(true)
    expect(isTorrentComplete(100, 'Checking')).toBe(false)
    expect(isTorrentComplete(55, 'Downloading')).toBe(false)
})

test('getAllAiredEpisodes counts past seasons fully and the current one up to the last aired episode', () => {
    const details = {
        last_episode_to_air: { season_number: 2, episode_number: 2 },
        seasons: [
            { season_number: 0, episode_count: 4 },
            { season_number: 1, episode_count: 3 },
            { season_number: 2, episode_count: 10 },
            { season_number: 3, episode_count: 8 },
        ],
    }
    expect(getAllAiredEpisodes(details).map(({ season, episode }) => `${season}:${episode}`))
        .toEqual(['1:1', '1:2', '1:3', '2:1', '2:2'])
    expect(getAllAiredEpisodes({ seasons: details.seasons })).toEqual([])
})

test('a list store never overwrites a file it cannot read', async () => {
    process.env.DATA_DIR = await mkdtemp(path.join(tmpdir(), 'usbeetv-store-'))
    const filePath = path.join(process.env.DATA_DIR, 'items.json')
    const store = createListStore('items.json', 'items')

    await store.update(items => items.push('a'))
    expect(await store.read()).toEqual(['a'])

    await writeFile(filePath, '{"items": [', 'utf8')
    await expect(store.update(items => items.push('b'))).rejects.toThrow()
    expect(await readFile(filePath, 'utf8')).toBe('{"items": [')
})
