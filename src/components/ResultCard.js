'use client'
import { useDownloadProgress } from '@/app/lib/useDownloadProgress'
import { useMovieExistsInDb, useTvShowExistsInDb } from '@/app/lib/useExistsInDb'
import { useFutureRelease } from '@/app/lib/useFutureRelease'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import RuleIcon from '@mui/icons-material/Rule'
import { Box, Card, CardActionArea, CardContent, CardMedia, CircularProgress, Tooltip, Typography } from "@mui/material"
import { useEffect, useState } from "react"
import { CircularProgressWithLabel } from "./CircularProgressWithLabel"
import { DownloadDialog } from './DownloadDialog'

export const ResultCard = ({ result, type }) => {
    const [open, setOpen] = useState(false)
    const [torrentId, setTorrentId] = useState(null)
    const [downloadStarted, setDownloadStarted] = useState(false)
    const [loading, setLoading] = useState(true)

    const futureRelease = useFutureRelease(result, type)
    let existsInDb
    if (type === 'movie') {
        existsInDb = useMovieExistsInDb(result)
    } else if (type === 'tv') {
        existsInDb = useTvShowExistsInDb(result)
    }

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

    const formatEta = (eta) => {
        const seconds = eta % 60
        const minutes = Math.floor(eta / 60) % 60
        const hours = Math.floor(eta / 3600)
        return `${hours ? `${hours}h ` : ''}${minutes ? `${minutes}m ` : ''}${seconds ? `${seconds}s` : ''}`.trim()
    }

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
                className={`rounded-lg min-w-[200px] aspect-square relative ${downloadProgress.progress ? 'bg-black bg-opacity-80' : ''}`}
            >
                <CardActionArea
                    onClick={handleCardClick}
                    className="h-full"
                    disabled={loading || existsInDb?.exists || downloadStarted}
                >
                    <CardMedia
                        component="img"
                        className="h-auto max-h-[25vh] !object-contain object-top"
                        image={`https://image.tmdb.org/t/p/w500${result.poster_path}`}
                        alt={`${type === "movie" ? result.title : result.name} Poster`} />
                    <CardContent className="flex flex-col gap-2 min-h-full">
                        <div className="flex flex-row gap-2">
                            <Typography variant="body2" color="textSecondary">
                                {new Date(type === "movie" ? result.release_date : result.first_air_date).getFullYear() || "????"}
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
                    {loading ? (
                        <CircularProgress size={24} sx={{ position: "absolute", top: 8, right: 8 }} />
                    ) : (existsInDb?.exists || downloadProgress.progress === 100) && (existsInDb?.isComplete ? (
                        <CheckCircleIcon
                            sx={{ position: "absolute", top: 8, right: 8, color: "green", backgroundColor: "white", borderRadius: "50%" }} />
                    ) : (
                        <Tooltip open arrow placement="left" title="Unvollständig">
                            <CheckCircleIcon
                                sx={{ position: "absolute", top: 8, right: 8, color: "orange", backgroundColor: "white", borderRadius: "50%" }} />
                        </Tooltip>
                    ))}
                </CardActionArea>
                {downloadStarted && downloadProgress.progress < 100 && (
                    <Box
                        className="absolute inset-0 flex justify-center items-center bg-black bg-opacity-80 flex-col pb-20"
                    >
                        <CircularProgressWithLabel value={downloadProgress.progress} />
                        <Typography variant="caption" color="textSecondary">
                            {formatEta(downloadProgress.eta)}
                        </Typography>
                    </Box>
                )}
            </Card>
        </>
    )
}
