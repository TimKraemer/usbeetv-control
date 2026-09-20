'use client'

import EmojiEventsIcon from '@mui/icons-material/EmojiEvents'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { Box, CircularProgress, IconButton, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useState } from 'react'

const JELLYFIN_WEB_URL = 'https://usbeetv.tk22.de:8920/web/#/details?id='
const VISIBLE_ENTRIES = 10

function entryDetails(entry, type) {
    const viewers = `${entry.viewers} Zuschauer`
    if (type === 'series') {
        return `${viewers} • ${entry.plays} ${entry.plays === 1 ? 'Folge' : 'Folgen'} gesehen`
    }
    return `${viewers} • ${entry.plays}× abgespielt`
}

export const WatchRankingWidget = () => {
    const [ranking, setRanking] = useState(null)
    const [loading, setLoading] = useState(false)
    const [failed, setFailed] = useState(false)
    const [isCollapsed, setIsCollapsed] = useState(true)
    const [type, setType] = useState('movies')
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

    const entries = ranking?.[type] || []
    const visibleEntries = showAll ? entries : entries.slice(0, VISIBLE_ENTRIES)

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
                        <div className="flex flex-col gap-2 mt-2">
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
                                <ToggleButton value="movies">Filme</ToggleButton>
                                <ToggleButton value="series">Serien</ToggleButton>
                            </ToggleButtonGroup>

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

                            {!loading && !failed && ranking && entries.length === 0 && (
                                <Typography variant="body2" className="text-gray-400">
                                    Noch nichts gesehen.
                                </Typography>
                            )}

                            {visibleEntries.map((entry, index) => (
                                <Box
                                    key={entry.id}
                                    className="flex items-center gap-3 bg-white/5 rounded-md p-2"
                                >
                                    <Typography variant="body2" className="text-gray-400 w-6 text-right shrink-0">
                                        {index + 1}
                                    </Typography>
                                    <Box className="min-w-0">
                                        <a
                                            href={`${JELLYFIN_WEB_URL}${entry.id}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="block text-sm text-white truncate hover:underline"
                                        >
                                            {entry.title}
                                            {entry.year ? ` (${entry.year})` : ''}
                                        </a>
                                        <Typography variant="caption" className="text-gray-400">
                                            {entryDetails(entry, type)}
                                        </Typography>
                                    </Box>
                                </Box>
                            ))}

                            {entries.length > VISIBLE_ENTRIES && (
                                <button
                                    type="button"
                                    className="text-xs text-gray-400 hover:text-gray-200 underline self-center"
                                    onClick={() => setShowAll(prev => !prev)}
                                >
                                    {showAll ? 'Weniger anzeigen' : `Alle ${entries.length} anzeigen`}
                                </button>
                            )}
                        </div>
                    )}
                </Box>
            </motion.div>
        </AnimatePresence>
    )
}
