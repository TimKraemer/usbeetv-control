'use client'

import { API_ENDPOINTS } from '@/constants/app'
import { useDownloadState } from '@/hooks/useDownloadState'
import RefreshIcon from '@mui/icons-material/Refresh'
import { Alert, IconButton, Snackbar, Tooltip } from '@mui/material'
import { useEffect, useState } from 'react'

export const LibraryScanButton = ({ isVisible = false }) => {
    const [isScanning, setIsScanning] = useState(false)
    const [hasScanned, setHasScanned] = useState(false)
    const [showSuccess, setShowSuccess] = useState(false)
    const [showError, setShowError] = useState(false)
    const [errorMessage, setErrorMessage] = useState('')
    const { hasActiveDownloads } = useDownloadState()

    // Reset state when downloads are no longer active
    useEffect(() => {
        if (!hasActiveDownloads) {
            setHasScanned(false)
            setIsScanning(false)
        }
    }, [hasActiveDownloads])

    const handleScan = async () => {
        if (isScanning || hasScanned) return

        setIsScanning(true)
        setShowError(false)
        setShowSuccess(false)

        try {
            const response = await fetch(API_ENDPOINTS.LIBRARY_SCAN, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({})
            })

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.error || 'Failed to trigger library scan')
            }

            setHasScanned(true)
            setShowSuccess(true)
        } catch (error) {
            console.error('Error triggering library scan:', error)
            setErrorMessage(error.message)
            setShowError(true)
        } finally {
            setIsScanning(false)
        }
    }

    if (!isVisible) return null

    return (
        <>
            <Tooltip title={hasScanned ? "Bibliothek bereits gescannt" : "Jellyfin Bibliothek scannen"}>
                <IconButton
                    size="small"
                    onClick={handleScan}
                    disabled={isScanning || hasScanned}
                    sx={{
                        color: hasScanned ? 'text.disabled' : 'rgb(59, 130, 246)',
                        '&:hover': {
                            backgroundColor: hasScanned ? 'transparent' : 'rgba(59, 130, 246, 0.1)'
                        },
                        '&:disabled': {
                            color: 'rgba(75, 85, 99, 0.7)'
                        }
                    }}
                >
                    <RefreshIcon
                        className={isScanning ? 'animate-spin' : ''}
                        sx={{
                            fontSize: '1.2rem',
                            color: hasScanned ? 'text.disabled' : 'inherit'
                        }}
                    />
                </IconButton>
            </Tooltip>

            {/* Success Snackbar */}
            <Snackbar
                open={showSuccess}
                autoHideDuration={4000}
                onClose={() => setShowSuccess(false)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    onClose={() => setShowSuccess(false)}
                    severity="success"
                    sx={{ width: '100%' }}
                >
                    Bibliothek-Scan erfolgreich gestartet
                </Alert>
            </Snackbar>

            {/* Error Snackbar */}
            <Snackbar
                open={showError}
                autoHideDuration={6000}
                onClose={() => setShowError(false)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    onClose={() => setShowError(false)}
                    severity="error"
                    sx={{ width: '100%' }}
                >
                    Fehler beim Scannen: {errorMessage}
                </Alert>
            </Snackbar>
        </>
    )
} 