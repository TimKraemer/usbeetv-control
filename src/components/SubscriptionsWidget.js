'use client'

import DeleteIcon from '@mui/icons-material/Delete'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import RefreshIcon from '@mui/icons-material/Refresh'
import SubscriptionsIcon from '@mui/icons-material/Subscriptions'
import { Box, CircularProgress, IconButton, Tooltip, Typography } from '@mui/material'
import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useState } from 'react'

const REFRESH_INTERVAL_MS = 60000

function formatRelative(isoString) {
    if (!isoString) return 'ausstehend'
    const diffMs = Date.now() - new Date(isoString).getTime()
    const minutes = Math.round(diffMs / 60000)
    if (minutes < 1) return 'gerade eben'
    if (minutes < 60) return `vor ${minutes} min`
    const hours = Math.round(minutes / 60)
    if (hours < 24) return `vor ${hours} h`
    const days = Math.round(hours / 24)
    return `vor ${days} d`
}

function lastEpisodeLabel(subscription) {
    if (!subscription.downloaded || subscription.downloaded.length === 0) return null
    const latest = [...subscription.downloaded].sort((a, b) => {
        if (a.season !== b.season) return b.season - a.season
        return b.episode - a.episode
    })[0]
    return `S${String(latest.season).padStart(2, '0')}E${String(latest.episode).padStart(2, '0')}`
}

export const SubscriptionsWidget = () => {
    const [subscriptions, setSubscriptions] = useState([])
    const [loading, setLoading] = useState(true)
    const [checking, setChecking] = useState(false)
    const [isCollapsed, setIsCollapsed] = useState(false)

    const fetchSubscriptions = useCallback(async () => {
        try {
            const response = await fetch('/api/subscriptions')
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
            const data = await response.json()
            setSubscriptions(data.subscriptions || [])
        } catch (error) {
            console.error('Error fetching subscriptions:', error)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchSubscriptions()
        const interval = setInterval(fetchSubscriptions, REFRESH_INTERVAL_MS)
        const onChanged = () => fetchSubscriptions()
        window.addEventListener('usbeetv:subscriptions-changed', onChanged)
        return () => {
            clearInterval(interval)
            window.removeEventListener('usbeetv:subscriptions-changed', onChanged)
        }
    }, [fetchSubscriptions])

    const handleCheckNow = async () => {
        setChecking(true)
        try {
            await fetch('/api/subscriptions/check', { method: 'POST' })
            await fetchSubscriptions()
        } catch (error) {
            console.error('Error checking subscriptions:', error)
        } finally {
            setChecking(false)
        }
    }

    const handleRemove = async (tmdbId) => {
        try {
            await fetch(`/api/subscriptions?tmdbId=${tmdbId}`, { method: 'DELETE' })
            setSubscriptions(prev => prev.filter(sub => sub.tmdbId !== tmdbId))
            window.dispatchEvent(new Event('usbeetv:subscriptions-changed'))
        } catch (error) {
            console.error('Error removing subscription:', error)
        }
    }

    const activeSubscriptions = subscriptions.filter(sub => sub.active)

    if (loading || activeSubscriptions.length === 0) return null

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
                    <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-2">
                            <SubscriptionsIcon className="text-purple-400" />
                            <Typography variant="caption" color="textSecondary" className="font-medium">
                                Serien-Abos ({activeSubscriptions.length})
                            </Typography>
                        </div>
                        <div className="flex items-center gap-1">
                            <Tooltip title="Jetzt nach neuen Folgen suchen">
                                <span>
                                    <IconButton
                                        size="small"
                                        onClick={handleCheckNow}
                                        disabled={checking}
                                        sx={{ color: 'text.secondary' }}
                                    >
                                        {checking
                                            ? <CircularProgress size={16} />
                                            : <RefreshIcon fontSize="small" />}
                                    </IconButton>
                                </span>
                            </Tooltip>
                            <IconButton
                                size="small"
                                onClick={() => setIsCollapsed(prev => !prev)}
                                sx={{ color: 'text.secondary' }}
                            >
                                <ExpandMoreIcon
                                    sx={{
                                        transform: isCollapsed ? 'rotate(180deg)' : 'rotate(0deg)',
                                        transition: 'transform 0.2s ease-in-out',
                                    }}
                                />
                            </IconButton>
                        </div>
                    </div>

                    {!isCollapsed && (
                        <div className="flex flex-col gap-2">
                            {activeSubscriptions.map((subscription) => {
                                const lastEpisode = lastEpisodeLabel(subscription)
                                return (
                                    <Box
                                        key={subscription.tmdbId}
                                        className="flex items-center justify-between gap-2 bg-white/5 rounded-md p-2"
                                    >
                                        <Box className="min-w-0">
                                            <Typography variant="body2" className="text-white truncate">
                                                {subscription.title || `TMDB ${subscription.tmdbId}`}
                                            </Typography>
                                            <Typography variant="caption" className="text-gray-400">
                                                {lastEpisode ? `Zuletzt geladen: ${lastEpisode}` : 'Noch keine Folge geladen'}
                                                {' • '}
                                                Check {formatRelative(subscription.lastCheckedAt)}
                                            </Typography>
                                        </Box>
                                        <Tooltip title="Abo entfernen">
                                            <IconButton
                                                size="small"
                                                onClick={() => handleRemove(subscription.tmdbId)}
                                                className="text-red-300 hover:text-red-100"
                                            >
                                                <DeleteIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                    </Box>
                                )
                            })}
                        </div>
                    )}
                </Box>
            </motion.div>
        </AnimatePresence>
    )
}
