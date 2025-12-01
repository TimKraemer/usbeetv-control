'use client'
import { formatBytes } from '@/utils/formatters'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import DownloadIcon from '@mui/icons-material/Download'
import WarningIcon from '@mui/icons-material/Warning'
import {
    Alert,
    Box,
    Button,
    Checkbox,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControlLabel,
    Grid,
    Typography
} from "@mui/material"
import { useCallback, useEffect, useState } from 'react'

export const SeasonSelectionDialog = ({
    open,
    onClose,
    tmdbId,
    showName,
    language,
    onDownloadComplete
}) => {
    const [seasons, setSeasons] = useState([])
    const [showInfo, setShowInfo] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [selectedSeasons, setSelectedSeasons] = useState([])
    const [downloading, setDownloading] = useState(false)
    const [downloadResults, setDownloadResults] = useState([])
    const [languageWarning, setLanguageWarning] = useState(null)
    const [showLanguageDialog, setShowLanguageDialog] = useState(false)

    const fetchSeasons = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const response = await fetch(`/api/download/seasons?tmdbId=${tmdbId}&language=${language}`)
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`)
            }
            const data = await response.json()
            setSeasons(data.seasons)
            setShowInfo(data.showInfo)


            // Pre-select missing seasons that have torrents available
            const missingSeasonsWithTorrents = data.seasons
                .filter(season => season.isMissing && season.hasTorrent)
                .map(season => season.seasonNumber)
            setSelectedSeasons(missingSeasonsWithTorrents)
        } catch (error) {
            console.error('Error fetching seasons:', error)
            setError(error.message)
        } finally {
            setLoading(false)
        }
    }, [tmdbId, language])

    useEffect(() => {
        if (open && tmdbId) {
            fetchSeasons()
        }
    }, [open, tmdbId, fetchSeasons])

    const handleSeasonToggle = (seasonNumber) => {
        setSelectedSeasons(prev =>
            prev.includes(seasonNumber)
                ? prev.filter(s => s !== seasonNumber)
                : [...prev, seasonNumber]
        )
    }

    const handleDownload = async () => {
        if (selectedSeasons.length === 0) return

        setDownloading(true)
        setDownloadResults([])
        setLanguageWarning(null)

        try {
            const response = await fetch('/api/download/seasons/download', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    tmdbId,
                    selectedSeasons,
                    language,
                    force: false
                })
            })

            const data = await response.json()

            if (data.languageWarning) {
                setLanguageWarning(data.languageWarning)
                setShowLanguageDialog(true)
                setDownloading(false)
                return
            }

            if (data.error) {
                setError(data.error)
                setDownloading(false)
                return
            }

            setDownloadResults(data.results)
            if (onDownloadComplete) {
                onDownloadComplete(data.results)
            }
        } catch (error) {
            console.error('Error downloading seasons:', error)
            setError(error.message)
        } finally {
            setDownloading(false)
        }
    }

    const handleLanguageConfirm = async () => {
        setShowLanguageDialog(false)
        setDownloading(true)

        try {
            const response = await fetch('/api/download/seasons/download', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    tmdbId,
                    selectedSeasons,
                    language,
                    force: true
                })
            })

            const data = await response.json()

            if (data.error) {
                setError(data.error)
                setDownloading(false)
                return
            }

            setDownloadResults(data.results)
            if (onDownloadComplete) {
                onDownloadComplete(data.results)
            }
        } catch (error) {
            console.error('Error downloading seasons:', error)
            setError(error.message)
        } finally {
            setDownloading(false)
        }
    }

    const handleLanguageCancel = () => {
        setShowLanguageDialog(false)
        setLanguageWarning(null)
    }

    const getSeasonStatusIcon = (season) => {
        if (season.existsInLibrary) {
            return <CheckCircleIcon className="text-green-500" />
        }
        if (season.hasTorrent) {
            return <DownloadIcon className="text-blue-500" />
        }
        return <WarningIcon className="text-gray-400" />
    }

    const getSeasonStatusText = (season) => {
        if (season.existsInLibrary) {
            return 'In Bibliothek'
        }
        if (season.hasTorrent) {
            return 'Verfügbar'
        }
        return 'Nicht verfügbar'
    }

    const getSeasonStatusColor = (season) => {
        if (season.existsInLibrary) {
            return 'success'
        }
        if (season.hasTorrent) {
            return 'primary'
        }
        return 'default'
    }

    const availableSeasons = seasons.filter(season => season.hasTorrent)
    const missingSeasons = seasons.filter(season => season.isMissing && season.hasTorrent)

    return (
        <>
            <Dialog
                open={open}
                onClose={onClose}
                maxWidth="md"
                fullWidth
                PaperProps={{
                    className: "bg-gray-900 text-white"
                }}
            >
                <DialogTitle className="text-white">
                    <Typography variant="h6" className="text-white">
                        {showName} - Staffeln auswählen
                    </Typography>
                    {showInfo && (
                        <Typography variant="body2" className="text-gray-400 mt-2">
                            {showInfo.totalSeasons} Staffel{showInfo.totalSeasons !== 1 ? 'n' : ''}
                        </Typography>
                    )}
                </DialogTitle>

                <DialogContent>
                    {loading && (
                        <Box className="flex justify-center items-center py-8">
                            <CircularProgress />
                        </Box>
                    )}

                    {error && (
                        <Alert severity="error" className="mb-4">
                            {error}
                        </Alert>
                    )}

                    {!loading && !error && (
                        <>
                            {missingSeasons.length > 0 && (
                                <Alert severity="info" className="mb-4">
                                    {missingSeasons.length} Staffel{missingSeasons.length !== 1 ? 'n' : ''} fehlt in der Bibliothek und wurde vorausgewählt.
                                </Alert>
                            )}

                            <Grid container spacing={2}>
                                {seasons.map((season) => (
                                    <Grid item xs={12} sm={6} md={4} key={season.seasonNumber}>
                                        <Box className={`p-4 border rounded-lg ${season.existsInLibrary
                                            ? 'border-green-500 bg-green-900/20'
                                            : season.hasTorrent
                                                ? 'border-blue-500 bg-blue-900/20'
                                                : 'border-gray-600 bg-gray-800'
                                            }`}>
                                            <Box className="flex items-center justify-between gap-2">
                                                <Typography variant="h6" className="text-white">
                                                    Staffel {season.seasonNumber}
                                                </Typography>
                                                {getSeasonStatusIcon(season)}
                                            </Box>

                                            <Typography variant="body2" className="text-gray-400">
                                                {season.episodeCount} Episode{season.episodeCount !== 1 ? 'n' : ''}
                                            </Typography>

                                            <Chip
                                                label={getSeasonStatusText(season)}
                                                color={getSeasonStatusColor(season)}
                                                size="small"
                                                className="mt-2"
                                            />

                                            {season.hasTorrent && !season.existsInLibrary && (
                                                <FormControlLabel
                                                    control={
                                                        <Checkbox
                                                            checked={selectedSeasons.includes(season.seasonNumber)}
                                                            onChange={() => handleSeasonToggle(season.seasonNumber)}
                                                            className="text-blue-500"
                                                        />
                                                    }
                                                    label="Laden"
                                                    className="text-white"
                                                />
                                            )}
                                        </Box>
                                    </Grid>
                                ))}
                            </Grid>

                            {downloadResults.length > 0 && (
                                <Box className="mt-4">
                                    <Typography variant="h6" className="text-white mb-2">
                                        Download Ergebnisse:
                                    </Typography>
                                    {downloadResults.map((result) => (
                                        <Alert
                                            key={`${result.seasonNumber}-${result.success ? 'success' : 'error'}`}
                                            severity={result.success ? 'success' : 'error'}
                                            className="mb-2"
                                        >
                                            Staffel {result.seasonNumber}: {result.success ? 'Erfolgreich gestartet' : result.error}
                                        </Alert>
                                    ))}
                                </Box>
                            )}
                        </>
                    )}
                </DialogContent>

                <DialogActions className="p-4">
                    <Button onClick={onClose} className="text-white">
                        Abbrechen
                    </Button>
                    <Button
                        onClick={handleDownload}
                        disabled={selectedSeasons.length === 0 || downloading}
                        variant="contained"
                        className="bg-blue-600 hover:bg-blue-700"
                    >
                        {downloading ? (
                            <>
                                <CircularProgress size={16} className="mr-2" />
                                Lade herunter...
                            </>
                        ) : (
                            `${selectedSeasons.length} Staffel${selectedSeasons.length !== 1 ? 'n' : ''} laden`
                        )}
                    </Button>
                </DialogActions>
            </Dialog>

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
        </>
    )
} 