'use client'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import { Box, Card, CardActionArea, CardContent, CardMedia, Typography } from "@mui/material"
import { useEffect, useState } from "react"
import { useInterval } from "react-use"
import { CircularProgressWithLabel } from "./CircularProgressWithLabel"
import { DownloadDialog } from './DownloadDialog'

const useFutureRelease = (result, type) => {
    const [futureRelease, setFutureRelease] = useState(false)

    useEffect(() => {
        const releaseDate = new Date(type === 'movie' ? result.release_date : result.first_air_date)
        const currentDate = new Date()
        if (releaseDate > currentDate) {
            setFutureRelease(true)
        }
    }, [result, type])

    return futureRelease
}

const fetchSeriesStatus = async (tmdbId) => {
    try {
        const response = await fetch(`/api/library/tvshows?tmdbId=${tmdbId}`)
        const data = await response.json()
        return data
    } catch (error) {
        console.error('Error fetching series status:', error)
        return { status: 'error' }
    }
}

export const ResultCard = ({ result, type }) => {
    const [open, setOpen] = useState(false)
    const [downloadProgress, setDownloadProgress] = useState({ progress: 0, eta: 0 })
    const futureRelease = useFutureRelease(result, type)
    const [torrentId, setTorrentId] = useState(null)
    const [existsInDb, setExistsInDb] = useState(false)
    const [seriesStatus, setSeriesStatus] = useState(null)
    const [downloadStarted, setDownloadStarted] = useState(false)

    useEffect(() => {
        const checkIfExists = async () => {
            try {
                const response = await fetch(`/api/library/movies?tmdbId=${result.id}`)
                const data = await response.json()
                setExistsInDb(data.exists)
            } catch (error) {
                console.error("Error checking if movie exists in DB:", error)
            }
        }

        checkIfExists()
    }, [result])

    const handleCardClick = async () => {
        if (existsInDb || downloadStarted) return // Prevent action if movie exists in DB or download has started

        setDownloadStarted(true) // Set download started to true


        try {
            const response = await fetch(
                `/api/download?tmdbId=${result.id}&type=${type}`
            )
            const data = await response.json()
            if (data.error) {
                setOpen(true)
                setDownloadStarted(false) // Reset if there's an error
                setDownloadProgress({ progress: 0, eta: 0 }) // Reset progress
            } else {
                if (data.hash) {
                    setTorrentId(data.hash)
                }
            }
        } catch (error) {
            console.error("Error fetching download:", error)
            setDownloadStarted(false) // Reset if there's an error
            setDownloadProgress({ progress: 0, eta: 0 }) // Reset progress
        }
    }

    const fetchDownloadProgress = async (torrentId) => {
        try {
            const response = await fetch(`/api/progress?torrentId=${torrentId}`)
            const data = await response.json()
            setDownloadProgress({ progress: Math.round(data.progress), eta: data.eta })
        } catch (error) {
            console.error("Error fetching download progress:", error)
        }
    }

    useInterval(() => {
        if (torrentId) {
            fetchDownloadProgress(torrentId)
        }
    }, 5000)

    return (
        <>
            <DownloadDialog
                open={open}
                onClose={() => setOpen(false)}
                futureRelease={futureRelease}
                result={result}
                type={type} />
            <Card
                key={result.id}
                className={`rounded-lg min-w-[200px] aspect-square relative ${downloadProgress !== null ? 'bg-black bg-opacity-80' : ''}`}
            >
                <CardActionArea
                    onClick={handleCardClick}
                    className="h-full"
                    disabled={existsInDb || downloadStarted}
                >
                    <CardMedia
                        component="img"
                        className="h-auto max-h-[25vh] !object-contain object-top"
                        image={`https://image.tmdb.org/t/p/w500${result.poster_path}`}
                        alt={`${type === "movie" ? result.title : result.name} Poster`} />
                    <CardContent className="flex flex-col gap-2 min-h-full">
                        <div className="flex flex-row gap-2">
                            <Typography variant="body2" color="textSecondary">
                                {new Date(
                                    type === "movie"
                                        ? result.release_date
                                        : result.first_air_date
                                ).getFullYear() || "????"}
                            </Typography>
                            <Typography variant="h8">
                                {type === "movie"
                                    ? result.title === result.original_title
                                        ? result.title
                                        : `${result.title} / ${result.original_title}`
                                    : result.name === result.original_name
                                        ? result.name
                                        : `${result.name} / ${result.original_name}`}
                            </Typography>
                        </div>
                    </CardContent>
                    {(existsInDb || downloadProgress.progress === 100) && (
                        <CheckCircleIcon
                            sx={{ position: "absolute", top: 8, right: 8, color: "green", backgroundColor: "white", borderRadius: "50%" }} />
                    )}
                </CardActionArea>
                {downloadStarted && downloadProgress.progress < 100 && (
                    <Box
                        className="absolute inset-0 flex justify-center items-center bg-black bg-opacity-80 flex-col pb-20"
                    >
                        <CircularProgressWithLabel value={downloadProgress.progress} />
                        <Typography variant="caption" color="textSecondary">
                            {(() => {
                                const seconds = downloadProgress.eta % 60
                                const minutes = Math.floor(downloadProgress.eta / 60) % 60
                                const hours = Math.floor(downloadProgress.eta / 3600)
                                return `${hours ? `${hours}h ` : ''}${minutes ? `${minutes}m ` : ''}${seconds ? `${seconds}s` : ''}`.trim()
                            })()}
                        </Typography>
                    </Box>
                )}
            </Card>
        </>
    )
}
