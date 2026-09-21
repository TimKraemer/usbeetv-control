'use client'

import ClearIcon from '@mui/icons-material/Clear'
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import MovieIcon from '@mui/icons-material/Movie'
import SearchIcon from '@mui/icons-material/Search'
import SortIcon from '@mui/icons-material/Sort'
import {
    Box,
    Chip,
    CircularProgress,
    IconButton,
    InputAdornment,
    TextField,
    ToggleButton,
    ToggleButtonGroup,
    Typography,
} from '@mui/material'
import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useState } from 'react'

const JELLYFIN_URL = 'https://usbeetv.tk22.de:8920'
const VISIBLE_ENTRIES = 10
const MAX_ENTRIES = 50

const PERIODS = [
    { key: 'all', label: 'Gesamt', days: null },
    { key: 'year', label: '12 Monate', days: 365 },
    { key: 'month', label: '30 Tage', days: 30 },
    { key: 'week', label: '7 Tage', days: 7 },
]

const SORTS = [
    { key: 'viewers', label: 'Meistgesehen' },
    { key: 'added', label: 'Neu hinzugefügt' },
]

const RANK_COLORS = ['text-yellow-400', 'text-gray-300', 'text-amber-600']

function normalize(text) {
    return (text || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/** Hint below the list about how reliable the selected time window is. */
function periodNote(ranking, period) {
    const days = PERIODS.find(({ key }) => key === period)?.days
    if (!ranking || !days) return null
    if (ranking.periodSource !== 'playback-reporting') {
        return 'Jellyfin merkt sich pro Nutzer nur das letzte Abspielen. Im Zeitraum zählt, wer den Titel zuletzt darin gesehen hat.'
    }
    if (!ranking.historySince) return 'Für diesen Zeitraum liegen noch keine Abspieldaten vor.'
    const since = new Date(`${ranking.historySince}T12:00:00`)
    if (since.getTime() <= Date.now() - days * 24 * 60 * 60 * 1000) return null
    return `Abspieldaten gibt es erst seit dem ${since.toLocaleDateString('de-DE')}.`
}

function formatAdded(addedAt) {
    if (!addedAt) return null
    const date = new Date(addedAt)
    if (Number.isNaN(date.getTime())) return null
    return `Neu seit ${date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}`
}

function entryDetails(stats, type, period, hasHistory) {
    if (stats.viewers === 0) return period === 'all' ? 'Noch nie gesehen' : 'In diesem Zeitraum nicht gesehen'
    if (type === 'series') return `${stats.plays} ${stats.plays === 1 ? 'Folge' : 'Folgen'} gesehen`
    // Without play history, play counts only exist as lifetime totals
    if (period !== 'all' && !hasHistory) return null
    return `${stats.plays}× abgespielt`
}

const Poster = ({ id, title }) => {
    const [broken, setBroken] = useState(false)

    return (
        <Box className="w-10 h-[60px] shrink-0 rounded overflow-hidden bg-white/10 flex items-center justify-center">
            {broken ? (
                <MovieIcon fontSize="small" className="text-gray-500" />
            ) : (
                // biome-ignore lint/performance/noImgElement: posters come straight from Jellyfin, not via the Next image optimizer
                <img
                    src={`${JELLYFIN_URL}/Items/${id}/Images/Primary?fillWidth=80&fillHeight=120&quality=90`}
                    alt={title}
                    loading="lazy"
                    className="w-full h-full object-cover"
                    onError={() => setBroken(true)}
                />
            )}
        </Box>
    )
}

export const WatchRankingWidget = () => {
    const [ranking, setRanking] = useState(null)
    const [loading, setLoading] = useState(false)
    const [failed, setFailed] = useState(false)
    const [isCollapsed, setIsCollapsed] = useState(true)
    const [type, setType] = useState('movies')
    const [period, setPeriod] = useState('all')
    const [sort, setSort] = useState('viewers')
    const [query, setQuery] = useState('')
    const [showAll, setShowAll] = useState(false)

    const fetchRanking = useCallback(async () => {
        setLoading(true)
        setFailed(false)
        try {
            const response = await fetch('/api/library/ranking')
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
            setRanking(await response.json())
        } catch (error) {
            console.error('Error fetching watch ranking:', error)
            setFailed(true)
        } finally {
            setLoading(false)
        }
    }, [])

    // Reading every user's play data is slow, so only load once the widget is opened
    useEffect(() => {
        if (!isCollapsed && !ranking && !loading && !failed) fetchRanking()
    }, [isCollapsed, ranking, loading, failed, fetchRanking])

    // Ranked list for the selected type and period; unwatched titles keep rank null
    const ranked = useMemo(() => {
        const entries = ranking?.[type] || []
        const sorted = entries
            .map(entry => ({ ...entry, current: entry.stats[period] }))
            .sort((a, b) =>
                b.current.viewers - a.current.viewers
                || b.current.plays - a.current.plays
                || a.title.localeCompare(b.title, 'de'))
        return sorted.map((entry, index) => ({ ...entry, rank: entry.current.viewers > 0 ? index + 1 : null }))
    }, [ranking, type, period])

    // "Neu hinzugefügt" lists every title, newest first, and keeps the rank from the viewer ranking
    const ordered = useMemo(() => {
        if (sort !== 'added') return ranked
        return [...ranked].sort((a, b) => (b.addedAt || '').localeCompare(a.addedAt || ''))
    }, [ranked, sort])

    const searchTerm = normalize(query.trim())
    const matching = searchTerm
        ? ordered.filter(entry => normalize(entry.title).includes(searchTerm))
        : ordered.filter(entry => sort === 'added' || entry.rank !== null)
    const limited = matching.slice(0, MAX_ENTRIES)
    const visibleEntries = showAll || searchTerm ? limited : limited.slice(0, VISIBLE_ENTRIES)
    const maxViewers = ranked[0]?.current.viewers || 0
    const hasHistory = ranking?.periodSource === 'playback-reporting'
    const note = periodNote(ranking, period)

    return (
        <AnimatePresence initial={false}>
            <motion.div
                initial={false}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="mt-4 px-4"
            >
                <Box className="bg-white/5 rounded-lg border border-gray-600 p-3">
                    <div
                        className="flex justify-between items-center cursor-pointer"
                        onClick={() => setIsCollapsed(prev => !prev)}
                    >
                        <div className="flex items-center gap-2">
                            <EmojiEventsIcon className="text-yellow-400" />
                            <Typography variant="caption" color="textSecondary" className="font-medium">
                                Meistgesehen
                            </Typography>
                        </div>
                        <IconButton size="small" sx={{ color: 'text.secondary' }}>
                            <ExpandMoreIcon
                                sx={{
                                    transform: isCollapsed ? 'rotate(180deg)' : 'rotate(0deg)',
                                    transition: 'transform 0.2s ease-in-out',
                                }}
                            />
                        </IconButton>
                    </div>

                    {!isCollapsed && (
                        <div className="flex flex-col gap-3 mt-3">
                            <div className="flex flex-wrap items-center gap-2">
                                <ToggleButtonGroup
                                    size="small"
                                    exclusive
                                    value={type}
                                    onChange={(_event, value) => {
                                        if (value) {
                                            setType(value)
                                            setShowAll(false)
                                        }
                                    }}
                                >
                                    <ToggleButton value="movies" sx={{ px: 2, py: 0.25, textTransform: 'none' }}>Filme</ToggleButton>
                                    <ToggleButton value="series" sx={{ px: 2, py: 0.25, textTransform: 'none' }}>Serien</ToggleButton>
                                </ToggleButtonGroup>
                                <div className="flex flex-wrap gap-1">
                                    {PERIODS.map(({ key, label }) => (
                                        <Chip
                                            key={key}
                                            label={label}
                                            size="small"
                                            color={period === key ? 'primary' : 'default'}
                                            variant={period === key ? 'filled' : 'outlined'}
                                            onClick={() => {
                                                setPeriod(key)
                                                setShowAll(false)
                                            }}
                                        />
                                    ))}
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-1">
                                <SortIcon fontSize="small" className="text-gray-400 mr-1" />
                                {SORTS.map(({ key, label }) => (
                                    <Chip
                                        key={key}
                                        label={label}
                                        size="small"
                                        color={sort === key ? 'primary' : 'default'}
                                        variant={sort === key ? 'filled' : 'outlined'}
                                        onClick={() => {
                                            setSort(key)
                                            setShowAll(false)
                                        }}
                                    />
                                ))}
                            </div>

                            <TextField
                                size="small"
                                fullWidth
                                placeholder={type === 'series' ? 'Serie suchen' : 'Film suchen'}
                                value={query}
                                onChange={event => setQuery(event.target.value)}
                                slotProps={{
                                    input: {
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <SearchIcon fontSize="small" className="text-gray-400" />
                                            </InputAdornment>
                                        ),
                                        endAdornment: query ? (
                                            <InputAdornment position="end">
                                                <IconButton size="small" onClick={() => setQuery('')} aria-label="Suche leeren">
                                                    <ClearIcon fontSize="small" />
                                                </IconButton>
                                            </InputAdornment>
                                        ) : null,
                                    },
                                }}
                            />

                            {loading && (
                                <Box className="flex justify-center p-4">
                                    <CircularProgress size={24} />
                                </Box>
                            )}

                            {failed && (
                                <Typography variant="body2" className="text-red-300">
                                    Ranking konnte nicht geladen werden.{' '}
                                    <button type="button" className="underline" onClick={fetchRanking}>
                                        Erneut versuchen
                                    </button>
                                </Typography>
                            )}

                            {!loading && !failed && ranking && visibleEntries.length === 0 && (
                                <Typography variant="body2" className="text-gray-400 text-center py-2">
                                    {searchTerm ? 'Kein Titel gefunden.' : 'In diesem Zeitraum wurde nichts gesehen.'}
                                </Typography>
                            )}

                            <div className="flex flex-col gap-1.5">
                                {visibleEntries.map((entry) => {
                                    const details = entryDetails(entry.current, type, period, hasHistory)
                                    const added = sort === 'added' ? formatAdded(entry.addedAt) : null
                                    const barWidth = maxViewers > 0 ? (entry.current.viewers / maxViewers) * 100 : 0
                                    return (
                                        <a
                                            key={entry.id}
                                            href={`${JELLYFIN_URL}/web/#/details?id=${entry.id}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-3 bg-white/5 hover:bg-white/10 transition-colors duration-200 rounded-md p-2"
                                        >
                                            <span
                                                className={`w-8 text-center shrink-0 font-bold tabular-nums ${
                                                    (sort === 'viewers' && RANK_COLORS[entry.rank - 1]) || 'text-gray-500'
                                                } ${sort === 'viewers' && entry.rank && entry.rank <= 3 ? 'text-lg' : 'text-sm'}`}
                                            >
                                                {entry.rank ? `${sort === 'added' ? '#' : ''}${entry.rank}` : '–'}
                                            </span>
                                            <Poster id={entry.id} title={entry.title} />
                                            <div className="min-w-0 flex-1">
                                                <div className="text-sm text-white truncate">
                                                    {entry.title}
                                                    {entry.year ? <span className="text-gray-400"> ({entry.year})</span> : null}
                                                </div>
                                                {added && (
                                                    <div className="text-xs text-blue-300 truncate">{added}</div>
                                                )}
                                                {details && (
                                                    <div className="text-xs text-gray-400 truncate">{details}</div>
                                                )}
                                                <div className="mt-1.5 h-1 rounded-full bg-white/10 overflow-hidden">
                                                    <div
                                                        className="h-full rounded-full bg-yellow-400/80"
                                                        style={{ width: `${barWidth}%` }}
                                                    />
                                                </div>
                                            </div>
                                            <div className="shrink-0 text-right leading-tight">
                                                <div className="text-base font-semibold text-white tabular-nums">
                                                    {entry.current.viewers}
                                                </div>
                                                <div className="text-[10px] uppercase tracking-wide text-gray-400">Nutzer</div>
                                            </div>
                                        </a>
                                    )
                                })}
                            </div>

                            {!searchTerm && limited.length > VISIBLE_ENTRIES && (
                                <button
                                    type="button"
                                    className="text-xs text-gray-400 hover:text-gray-200 underline self-center"
                                    onClick={() => setShowAll(prev => !prev)}
                                >
                                    {showAll ? 'Weniger anzeigen' : sort === 'added' ? `${limited.length} anzeigen` : `Top ${limited.length} anzeigen`}
                                </button>
                            )}

                            {note && (
                                <Typography variant="caption" className="text-gray-500 text-center">
                                    {note}
                                </Typography>
                            )}
                        </div>
                    )}
                </Box>
            </motion.div>
        </AnimatePresence>
    )
}
