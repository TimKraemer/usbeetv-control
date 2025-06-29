'use client'

import { JellyfinNotice } from '@/components/JellyfinNotice'
import { MobileWidgetsContainer } from '@/components/MobileWidgetsContainer'
import SearchContainer from '@/components/SearchContainer'
import { useDownloadState } from '@/hooks/useDownloadState'
import { formatEta } from '@/utils/formatters'
import CancelIcon from '@mui/icons-material/Cancel'
import ClearIcon from '@mui/icons-material/Clear'
import { Box, Chip, IconButton, LinearProgress, Tooltip, Typography } from '@mui/material'
import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'

export const ClientPageWrapper = () => {
    const [isCollapsed, setIsCollapsed] = useState(false)
    const { activeDownloads, clearCompletedDownloads, cancelDownload } = useDownloadState()
    const [cancellingDownloads, setCancellingDownloads] = useState(new Set())

    const handleCancelDownload = async (torrentId) => {
        setCancellingDownloads(prev => new Set(prev).add(torrentId))
        try {
            const result = await cancelDownload(torrentId)
            if (!result.success) {
                console.error('Failed to cancel download:', result.error)
            }
        } finally {
            setCancellingDownloads(prev => {
                const newSet = new Set(prev)
                newSet.delete(torrentId)
                return newSet
            })
        }
    }

    return (
        <>
            {/* Active Downloads Indicator */}
            <AnimatePresence>
                {activeDownloads.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.3 }}
                        className="mb-6"
                    >
                        <Box className="bg-blue-600 bg-opacity-20 border border-blue-500 rounded-lg p-4">
                            <div className="flex justify-between items-center mb-3">
                                <Typography variant="h6" className="text-blue-300">
                                    Aktive Downloads ({activeDownloads.length})
                                </Typography>
                                <Tooltip title="Download-Historie löschen">
                                    <IconButton
                                        onClick={clearCompletedDownloads}
                                        size="small"
                                        className="text-blue-300 hover:text-blue-100"
                                    >
                                        <ClearIcon />
                                    </IconButton>
                                </Tooltip>
                            </div>
                            <div className="space-y-3">
                                {activeDownloads.map((download, index) => (
                                    <motion.div
                                        key={download.torrentId}
                                        initial={{ opacity: 0, scale: 0.8 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ delay: index * 0.1 }}
                                        className="bg-blue-500 bg-opacity-20 rounded-lg p-3"
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex-1 min-w-0">
                                                <Typography variant="body2" className="text-white font-medium truncate">
                                                    {download.title}
                                                </Typography>
                                                <Typography variant="caption" className="text-blue-200">
                                                    {download.type === 'movie' ? 'Film' : 'Serie'} • {download.state}
                                                    {download.reconnected && (
                                                        <span className="text-yellow-300 ml-1">• aus vorheriger Sitzung</span>
                                                    )}
                                                </Typography>
                                            </div>
                                            <Tooltip title="Download abbrechen">
                                                <IconButton
                                                    onClick={() => handleCancelDownload(download.torrentId)}
                                                    size="small"
                                                    disabled={cancellingDownloads.has(download.torrentId)}
                                                    className="text-red-300 hover:text-red-100 ml-2"
                                                >
                                                    <CancelIcon />
                                                </IconButton>
                                            </Tooltip>
                                        </div>

                                        <div className="space-y-1">
                                            <div className="flex justify-between items-center">
                                                <Typography variant="caption" className="text-blue-200">
                                                    {download.reconnected ? 'N/A' : `${download.progress}%`}
                                                </Typography>
                                                <Typography variant="caption" className="text-blue-200">
                                                    ETA: {download.reconnected ? 'N/A' : formatEta(download.eta)}
                                                </Typography>
                                            </div>
                                            {download.reconnected ? (
                                                <div className="h-2 bg-gray-600 bg-opacity-20 rounded-full flex items-center justify-center">
                                                    <Typography variant="caption" className="text-gray-400 text-xs">
                                                        Keine Echtzeit-Updates verfügbar
                                                    </Typography>
                                                </div>
                                            ) : (
                                                <LinearProgress
                                                    variant="determinate"
                                                    value={download.progress}
                                                    className="h-2 rounded-full"
                                                    sx={{
                                                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                                        '& .MuiLinearProgress-bar': {
                                                            backgroundColor: '#3b82f6',
                                                            borderRadius: 'inherit'
                                                        }
                                                    }}
                                                />
                                            )}
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </Box>
                    </motion.div>
                )}
            </AnimatePresence>

            <MobileWidgetsContainer onCollapsedChange={setIsCollapsed} />
            <JellyfinNotice isCollapsed={isCollapsed} />
            <SearchContainer />
        </>
    )
} 