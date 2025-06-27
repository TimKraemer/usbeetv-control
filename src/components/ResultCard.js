'use client'
import { useDownloadProgress } from '@/app/lib/useDownloadProgress'
import { useMovieExistsInDb, useTvShowExistsInDb } from '@/app/lib/useExistsInDb'
import { useFutureRelease } from '@/app/lib/useFutureRelease'
import { useDownloadState } from '@/hooks/useDownloadState'
import { formatEta } from '@/utils/formatters'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import DownloadIcon from '@mui/icons-material/Download'
import RuleIcon from '@mui/icons-material/Rule'
import WarningIcon from '@mui/icons-material/Warning'
import { Alert, Box, Button, Card, CardActionArea, CardContent, CardMedia, CircularProgress, Dialog, DialogActions, DialogContent, Tooltip, Typography } from "@mui/material"
import { motion } from "framer-motion"
import { useEffect, useState } from "react"
import { CircularProgressWithLabel } from "./CircularProgressWithLabel"
import { DownloadDialog } from './DownloadDialog'

const MotionCard = motion.create(Card)

export const ResultCard = ({ result, type, index = 0, language }) => {
    const [open, setOpen] = useState(false)
    const [torrentId, setTorrentId] = useState(null)
    const [downloadStarted, setDownloadStarted] = useState(false)
    const [loading, setLoading] = useState(true)
    const [languageWarning, setLanguageWarning] = useState(null)
    const [showLanguageDialog, setShowLanguageDialog] = useState(false)

    const futureRelease = useFutureRelease(result, type)
    const movieExists = useMovieExistsInDb(result)
    const tvExists = useTvShowExistsInDb(result)
    const existsInDb = type === 'movie' ? movieExists : tvExists
    const { startDownload } = useDownloadState()

    useEffect(() => {
        if (existsInDb !== undefined) {
            setLoading(false)
        }
    }, [existsInDb])

    const downloadProgress = useDownloadProgress(torrentId)

    const handleCardClick = async () => {
        if (loading || existsInDb?.exists || downloadStarted) return

        setDownloadStarted(true)
        setLanguageWarning(null)
        startDownload()

        try {
            const response = await fetch(`/api/download?tmdbId=${result.id}&type=${type}&language=${language}`)
            const data = await response.json()
            if (data.error) {
                setOpen(true)
                setDownloadStarted(false)
            } else if (data.languageWarning) {
                setLanguageWarning(data.languageWarning)
                setShowLanguageDialog(true)
                setDownloadStarted(false)
            } else if (data.hash) {
                setTorrentId(data.hash)
            }
        } catch (error) {
            console.error("Error fetching download:", error)
            setDownloadStarted(false)
        }
    }

    const handleLanguageConfirm = async () => {
        setShowLanguageDialog(false)
        setDownloadStarted(true)
        startDownload()

        try {
            const response = await fetch(`/api/download?tmdbId=${result.id}&type=${type}&language=${language}&force=true`)
            const data = await response.json()
            if (data.error) {
                setOpen(true)
                setDownloadStarted(false)
            } else if (data.hash) {
                setTorrentId(data.hash)
            }
        } catch (error) {
            console.error("Error fetching download:", error)
            setDownloadStarted(false)
        }
    }

    const handleLanguageCancel = () => {
        setShowLanguageDialog(false)
        setLanguageWarning(null)
    }

    const isDisabled = loading || existsInDb?.exists || downloadStarted
    const title = type === "movie" ? result.title : result.name

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
                className={`rounded-lg min-w-[200px] max-w-[250px] flex flex-col bg-transparent relative overflow-hidden ${downloadProgress.progress ? 'bg-black bg-opacity-80' : ''}`}
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
                                <Tooltip title={existsInDb.isComplete ? "Vollständig verfügbar" : "Teilweise verfügbar"}>
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

                        {downloadStarted && !torrentId && !languageWarning && (
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
                            <Box className="text-center">
                                <CircularProgressWithLabel
                                    value={downloadProgress.progress}
                                    className="text-white"
                                />
                                <Typography variant="caption" className="text-white block mt-2">
                                    ETA: {formatEta(downloadProgress.eta)}
                                </Typography>
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
                    {!isDisabled && !downloadProgress.progress && (
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
