'use client'
import { useDownloadProgress } from '@/app/lib/useDownloadProgress'
import { useMovieExistsInDb, useTvShowExistsInDb } from '@/app/lib/useExistsInDb'
import { useFutureRelease } from '@/app/lib/useFutureRelease'
import { formatEta } from '@/utils/formatters'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import DownloadIcon from '@mui/icons-material/Download'
import RuleIcon from '@mui/icons-material/Rule'
import { Box, Card, CardActionArea, CardContent, CardMedia, CircularProgress, Tooltip, Typography } from "@mui/material"
import { motion } from "framer-motion"
import { useEffect, useState } from "react"
import { CircularProgressWithLabel } from "./CircularProgressWithLabel"
import { DownloadDialog } from './DownloadDialog'

const MotionCard = motion.create(Card)

export const ResultCard = ({ result, type, index = 0 }) => {
    const [open, setOpen] = useState(false)
    const [torrentId, setTorrentId] = useState(null)
    const [downloadStarted, setDownloadStarted] = useState(false)
    const [loading, setLoading] = useState(true)

    const futureRelease = useFutureRelease(result, type)
    const movieExists = useMovieExistsInDb(result)
    const tvExists = useTvShowExistsInDb(result)
    const existsInDb = type === 'movie' ? movieExists : tvExists

    useEffect(() => {
        if (existsInDb !== undefined) {
            setLoading(false)
        }
    }, [existsInDb])

    const downloadProgress = useDownloadProgress(torrentId)

    const handleCardClick = async () => {
        if (loading || existsInDb?.exists || downloadStarted) return

        setDownloadStarted(true)

        try {
            const response = await fetch(`/api/download?tmdbId=${result.id}&type=${type}`)
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

    const isDisabled = loading || existsInDb?.exists || downloadStarted
    const title = type === "movie" ? result.title : result.name

    return (
        <>
            <DownloadDialog
                open={open}
                onClose={() => setOpen(false)}
                futureRelease={futureRelease}
                result={result}
                type={type}
            />

            <MotionCard
                key={result.id}
                className={`rounded-lg min-w-[200px] aspect-square relative overflow-hidden ${downloadProgress.progress ? 'bg-black bg-opacity-80' : ''
                    }`}
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
                    className="h-full relative"
                    disabled={isDisabled}
                >
                    <CardMedia
                        component="img"
                        className="h-auto max-h-[25vh] !object-contain object-top transition-transform duration-300"
                        image={`https://image.tmdb.org/t/p/w500${result.poster_path}`}
                        alt={`${title} Poster`}
                        sx={{
                            filter: isDisabled ? 'grayscale(50%)' : 'none',
                            opacity: isDisabled ? 0.7 : 1
                        }}
                    />

                    <CardContent className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/80 to-transparent p-3">
                        <Typography
                            variant="body2"
                            className="font-medium text-white line-clamp-2"
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
                            {type === 'movie' ? 'Film' : 'Serie'}
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

                        {downloadStarted && !torrentId && (
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
                    {downloadProgress.progress > 0 && (
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
