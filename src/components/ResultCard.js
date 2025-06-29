'use client'
import { useDownloadProgress } from '@/app/lib/useDownloadProgress'
import { useMovieExistsInDb, useTvShowExistsInDb } from '@/app/lib/useExistsInDb'
import { useFutureRelease } from '@/app/lib/useFutureRelease'
import { useDownloadState } from '@/hooks/useDownloadState'
import { formatEta } from '@/utils/formatters'
import CancelIcon from '@mui/icons-material/Cancel'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import DownloadIcon from '@mui/icons-material/Download'
import RuleIcon from '@mui/icons-material/Rule'
import WarningIcon from '@mui/icons-material/Warning'
import { Alert, Box, Button, Card, CardActionArea, CardContent, CardMedia, CircularProgress, Dialog, DialogActions, DialogContent, IconButton, Tooltip, Typography } from "@mui/material"
import { motion } from "framer-motion"
import { useEffect, useState } from "react"
import { CircularProgressWithLabel } from "./CircularProgressWithLabel"
import { DownloadDialog } from './DownloadDialog'
import { SeasonSelectionDialog } from './SeasonSelectionDialog'

const MotionCard = motion.create(Card)

export const ResultCard = ({ result, type, index = 0, language }) => {
    const [open, setOpen] = useState(false)
    const [torrentId, setTorrentId] = useState(null)
    const [torrentIds, setTorrentIds] = useState([])
    const [downloadStarted, setDownloadStarted] = useState(false)
    const [downloadInitiated, setDownloadInitiated] = useState(false)
    const [loading, setLoading] = useState(true)
    const [languageWarning, setLanguageWarning] = useState(null)
    const [showLanguageDialog, setShowLanguageDialog] = useState(false)
    const [showSeasonDialog, setShowSeasonDialog] = useState(false)
    const [cancelling, setCancelling] = useState(false)

    const futureRelease = useFutureRelease(result, type)
    const movieExists = useMovieExistsInDb(result)
    const tvExists = useTvShowExistsInDb(result)
    const existsInDb = type === 'movie' ? movieExists : tvExists
    const { startDownload, activeDownloads, cancelDownload } = useDownloadState()
    const title = type === "movie" ? result.title : result.name

    useEffect(() => {
        if (existsInDb !== undefined) {
            setLoading(false)
        }
    }, [existsInDb])

    // Check if this item has an active download on mount
    useEffect(() => {
        const activeDownload = activeDownloads.find(d => d.tmdbId === result.id && d.type === type)
        if (activeDownload) {
            setTorrentId(activeDownload.torrentId)
            setDownloadStarted(true)
            setDownloadInitiated(false) // Don't show "Starte Download" since it's already started
        }
    }, [activeDownloads, result.id, type])

    const downloadProgress = useDownloadProgress(torrentId, result.id, type, title)

    // Reset downloadInitiated when torrentId is set (progress tracking starts)
    useEffect(() => {
        if (torrentId && downloadInitiated) {
            setDownloadInitiated(false)
        }
    }, [torrentId, downloadInitiated])

    const handleCardClick = async () => {
        if (loading || downloadStarted || downloadInitiated) return // Prevent double-clicks

        // For TV shows, always show season selection dialog (regardless of existence)
        if (type === 'tv') {
            setShowSeasonDialog(true)
            return
        }

        // For movies, check if they exist and disable if they do
        if (existsInDb?.exists) return

        // For movies, use the existing download logic
        setDownloadStarted(true)
        setDownloadInitiated(true) // Set initiated state
        setLanguageWarning(null)
        startDownload() // Start without torrent ID initially

        try {
            const response = await fetch(`/api/download?tmdbId=${result.id}&type=${type}&language=${language}`)
            const data = await response.json()
            if (data.error) {
                setOpen(true)
                setDownloadStarted(false)
                setDownloadInitiated(false) // Reset initiated state
            } else if (data.languageWarning) {
                setLanguageWarning(data.languageWarning)
                setShowLanguageDialog(true)
                setDownloadStarted(false)
                setDownloadInitiated(false) // Reset initiated state
            } else if (data.hash) {
                setTorrentId(data.hash)
                // Update the download state with the torrent ID
                startDownload(data.hash, result.id, type, title)
            }
        } catch (error) {
            console.error("Error fetching download:", error)
            setDownloadStarted(false)
            setDownloadInitiated(false) // Reset initiated state
        }
    }

    const handleSeasonDownloadComplete = (results) => {
        // Handle season download completion
        const successfulDownloads = results.filter(r => r.success)
        if (successfulDownloads.length > 0) {
            setDownloadInitiated(true) // Set initiated state for TV shows
            // Set the first successful download's hash as the primary torrent ID for progress tracking
            const firstSuccessful = successfulDownloads[0]
            if (firstSuccessful.hash) {
                setTorrentId(firstSuccessful.hash)
                // Register the download with the global state
                startDownload(firstSuccessful.hash, result.id, type, title)
            }
            // Store all torrent IDs for potential future use
            const hashes = successfulDownloads.map(r => r.hash).filter(Boolean)
            setTorrentIds(hashes)
        }
    }

    const handleLanguageConfirm = async () => {
        setShowLanguageDialog(false)
        setDownloadStarted(true)
        setDownloadInitiated(true) // Set initiated state
        startDownload() // Start without torrent ID initially

        try {
            const response = await fetch(`/api/download?tmdbId=${result.id}&type=${type}&language=${language}&force=true`)
            const data = await response.json()
            if (data.error) {
                setOpen(true)
                setDownloadStarted(false)
                setDownloadInitiated(false) // Reset initiated state
            } else if (data.hash) {
                setTorrentId(data.hash)
                // Update the download state with the torrent ID
                startDownload(data.hash, result.id, type, title)
            }
        } catch (error) {
            console.error("Error fetching download:", error)
            setDownloadStarted(false)
            setDownloadInitiated(false) // Reset initiated state
        }
    }

    const handleLanguageCancel = () => {
        setShowLanguageDialog(false)
        setLanguageWarning(null)
    }

    const handleCancelDownload = async () => {
        if (!torrentId) return

        setCancelling(true)
        try {
            const result = await cancelDownload(torrentId)
            if (result.success) {
                setTorrentId(null)
                setDownloadStarted(false)
                setDownloadInitiated(false)
            } else {
                console.error('Failed to cancel download:', result.error)
            }
        } finally {
            setCancelling(false)
        }
    }

    const isDisabled = loading || (type === 'movie' && existsInDb?.exists) || downloadStarted || downloadInitiated

    // Extract year from release date
    const getYear = () => {
        const dateString = type === 'movie' ? result.release_date : result.first_air_date
        if (!dateString) return null
        return new Date(dateString).getFullYear()
    }

    const year = getYear()

    return (
        <>
            <DownloadDialog
                open={open}
                onClose={() => setOpen(false)}
                futureRelease={futureRelease}
                result={result}
                type={type}
            />

            <SeasonSelectionDialog
                open={showSeasonDialog}
                onClose={() => setShowSeasonDialog(false)}
                tmdbId={result.id}
                showName={title}
                language={language}
                onDownloadComplete={handleSeasonDownloadComplete}
            />

            {/* Language Warning Dialog */}
            <Dialog open={showLanguageDialog} onClose={handleLanguageCancel}>
                <DialogContent>
                    <Alert severity="warning" className="mb-4">
                        {languageWarning}
                    </Alert>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleLanguageCancel} color="primary">
                        Abbrechen
                    </Button>
                    <Button onClick={handleLanguageConfirm} color="warning" variant="contained">
                        Trotzdem herunterladen
                    </Button>
                </DialogActions>
            </Dialog>

            <MotionCard
                key={result.id}
                className={`rounded-lg min-w-[200px] max-w-[250px] flex flex-col bg-transparent relative overflow-hidden ${(downloadProgress.progress || downloadInitiated) ? 'bg-black bg-opacity-80' : ''}`}
                initial={{ opacity: 0, y: 20, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{
                    duration: 0.3,
                    delay: index * 0.1,
                    ease: "easeOut"
                }}
                whileHover={{
                    scale: isDisabled ? 1 : 1.05,
                    y: isDisabled ? 0 : -5
                }}
                whileTap={{ scale: isDisabled ? 1 : 0.95 }}
            >
                <CardActionArea
                    onClick={handleCardClick}
                    className="flex flex-col h-full relative"
                    disabled={isDisabled}
                >
                    {result.poster_path ? (
                        <CardMedia
                            component="img"
                            className="h-64 w-full object-contain transition-transform duration-300"
                            image={`https://image.tmdb.org/t/p/w500${result.poster_path}`}
                            alt={`${title} Poster`}
                            sx={{
                                filter: isDisabled ? 'grayscale(50%)' : 'none',
                                opacity: isDisabled ? 0.7 : 1
                            }}
                        />
                    ) : (
                        <div className="w-full h-64 bg-gray-800 flex items-center justify-center">
                            <span className="text-white opacity-60 text-center px-2">{title}</span>
                        </div>
                    )}

                    <CardContent className="p-3 bg-white/10 flex flex-col items-start mt-auto">
                        <Typography
                            variant="body2"
                            className="font-medium line-clamp-2"
                            sx={{
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden'
                            }}
                        >
                            {title}
                        </Typography>

                        <Typography variant="caption" color="textSecondary" className="block mt-1">
                            {year ? `(${year})` : ''}
                        </Typography>
                    </CardContent>

                    {/* Status Overlay */}
                    <Box className="absolute top-2 right-2">
                        {loading && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ duration: 0.3 }}
                            >
                                <CircularProgress size={24} className="text-blue-500" />
                            </motion.div>
                        )}

                        {existsInDb?.exists && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.3 }}
                            >
                                <Tooltip title={
                                    type === 'tv'
                                        ? (existsInDb.isComplete
                                            ? "Vollständig verfügbar - Klicken für Staffel-Auswahl"
                                            : "Teilweise verfügbar - Klicken für fehlende Staffeln")
                                        : (existsInDb.isComplete
                                            ? "Vollständig verfügbar"
                                            : "Teilweise verfügbar")
                                }>
                                    <CheckCircleIcon
                                        className={`text-2xl ${existsInDb.isComplete ? 'text-green-500' : 'text-yellow-500'}`}
                                    />
                                </Tooltip>
                            </motion.div>
                        )}

                        {futureRelease && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.3 }}
                            >
                                <Tooltip title="Zukünftige Veröffentlichung">
                                    <RuleIcon className="text-2xl text-orange-500" />
                                </Tooltip>
                            </motion.div>
                        )}

                        {languageWarning && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.3 }}
                            >
                                <Tooltip title={languageWarning}>
                                    <WarningIcon className="text-2xl text-yellow-500" />
                                </Tooltip>
                            </motion.div>
                        )}

                        {downloadStarted && !torrentId && !languageWarning && !downloadInitiated && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.3 }}
                            >
                                <CircularProgress size={24} className="text-blue-500" />
                            </motion.div>
                        )}
                    </Box>

                    {/* Download Progress Overlay */}
                    {downloadProgress.progress > 0 && !downloadProgress.isComplete && (
                        <motion.div
                            className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.3 }}
                        >
                            <Box className="text-center relative">
                                <CircularProgressWithLabel
                                    value={downloadProgress.progress}
                                    className="text-white"
                                />
                                <Typography variant="caption" className="text-white block mt-2">
                                    ETA: {formatEta(downloadProgress.eta)}
                                </Typography>
                                <Tooltip title="Download abbrechen">
                                    <IconButton
                                        onClick={handleCancelDownload}
                                        disabled={cancelling}
                                        size="small"
                                        className="absolute -top-2 -right-2 text-red-300 hover:text-red-100 bg-black bg-opacity-50"
                                    >
                                        {cancelling ? (
                                            <CircularProgress size={16} className="text-red-300" />
                                        ) : (
                                            <CancelIcon />
                                        )}
                                    </IconButton>
                                </Tooltip>
                            </Box>
                        </motion.div>
                    )}

                    {/* Download Initiated Loading Overlay */}
                    {downloadInitiated && !downloadProgress.progress && !downloadProgress.isComplete && (
                        <motion.div
                            className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.3 }}
                        >
                            <Box className="text-center relative">
                                <CircularProgress size={48} className="text-blue-500 mb-2" />
                                <Typography variant="body2" className="text-white font-medium">
                                    Starte Download...
                                </Typography>
                                <Tooltip title="Download abbrechen">
                                    <IconButton
                                        onClick={handleCancelDownload}
                                        disabled={cancelling}
                                        size="small"
                                        className="absolute -top-2 -right-2 text-red-300 hover:text-red-100 bg-black bg-opacity-50"
                                    >
                                        {cancelling ? (
                                            <CircularProgress size={16} className="text-red-300" />
                                        ) : (
                                            <CancelIcon />
                                        )}
                                    </IconButton>
                                </Tooltip>
                            </Box>
                        </motion.div>
                    )}

                    {/* Download Complete Overlay */}
                    {downloadProgress.isComplete && (
                        <motion.div
                            className="absolute inset-0 bg-green-600 bg-opacity-80 flex items-center justify-center"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.3 }}
                        >
                            <Box className="text-center">
                                <CheckCircleIcon className="text-white text-6xl mb-2" />
                                <Typography variant="body2" className="text-white font-medium">
                                    Download abgeschlossen
                                </Typography>
                                <Typography variant="caption" className="text-white block mt-1">
                                    Bibliothek wird gescannt...
                                </Typography>
                            </Box>
                        </motion.div>
                    )}

                    {/* Download Icon Overlay */}
                    {((!isDisabled && !downloadProgress.progress && !downloadInitiated) || (type === 'tv' && !downloadProgress.progress && !downloadInitiated)) && (
                        <motion.div
                            className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-30 flex items-center justify-center transition-all duration-300"
                            initial={{ opacity: 0 }}
                            whileHover={{ opacity: 1 }}
                        >
                            <DownloadIcon className="text-white text-4xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        </motion.div>
                    )}
                </CardActionArea>
            </MotionCard>
        </>
    )
}
