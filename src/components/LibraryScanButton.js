'use client'

import { API_ENDPOINTS } from '@/constants/app'
import RefreshIcon from '@mui/icons-material/Refresh'
import { Alert, IconButton, Snackbar, Tooltip } from '@mui/material'
import { useEffect, useState } from 'react'

function formatRemaining(ms) {
    const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    if (minutes <= 0) return `${seconds}s`
    return `${minutes}:${String(seconds).padStart(2, '0')} min`
}

export const LibraryScanButton = ({ isVisible = false }) => {
    const [isScanning, setIsScanning] = useState(false)
    const [cooldownUntil, setCooldownUntil] = useState(0)
    const [now, setNow] = useState(() => Date.now())
    const [showSuccess, setShowSuccess] = useState(false)
    const [showCooldown, setShowCooldown] = useState(false)
    const [showError, setShowError] = useState(false)
    const [errorMessage, setErrorMessage] = useState('')

    const remainingMs = Math.max(0, cooldownUntil - now)
    const isOnCooldown = remainingMs > 0

    useEffect(() => {
        let cancelled = false

        const loadCooldown = async () => {
            try {
                const response = await fetch(API_ENDPOINTS.LIBRARY_SCAN)
                if (!response.ok) return
                const data = await response.json()
                const remaining = data.cooldown?.remainingMs || 0
                if (!cancelled && remaining > 0) {
                    setCooldownUntil(Date.now() + remaining)
                }
            } catch (error) {
                console.error('Error loading library scan cooldown:', error)
            }
        }

        loadCooldown()
        return () => {
            cancelled = true
        }
    }, [])

    useEffect(() => {
        if (!isOnCooldown) return
        const intervalId = setInterval(() => setNow(Date.now()), 1000)
        return () => clearInterval(intervalId)
    }, [isOnCooldown])

    const applyCooldown = (cooldown) => {
        const remaining = cooldown?.remainingMs || 0
        if (remaining > 0) {
            setCooldownUntil(Date.now() + remaining)
            setNow(Date.now())
        }
    }

    const handleScan = async () => {
        if (isScanning || isOnCooldown) return

        setIsScanning(true)
        setShowError(false)
        setShowSuccess(false)
        setShowCooldown(false)

        try {
            const response = await fetch(API_ENDPOINTS.LIBRARY_SCAN, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({})
            })

            const data = await response.json()
            applyCooldown(data.cooldown)

            if (!response.ok) {
                throw new Error(data.error || 'Failed to trigger library scan')
            }

            if (data.skipped) {
                setShowCooldown(true)
            } else {
                setShowSuccess(true)
            }
        } catch (error) {
            console.error('Error triggering library scan:', error)
            setErrorMessage(error.message)
            setShowError(true)
        } finally {
            setIsScanning(false)
        }
    }

    if (!isVisible) return null

    const tooltip = isOnCooldown
        ? `Scan-Cooldown aktiv — verfügbar in ${formatRemaining(remainingMs)}`
        : 'Jellyfin Bibliothek scannen'

    return (
        <>
            <Tooltip title={tooltip}>
                <span>
                    <IconButton
                        size="small"
                        onClick={handleScan}
                        disabled={isScanning || isOnCooldown}
                        sx={{
                            color: isOnCooldown ? 'text.disabled' : 'rgb(59, 130, 246)',
                            '&:hover': {
                                backgroundColor: isOnCooldown ? 'transparent' : 'rgba(59, 130, 246, 0.1)'
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
                                color: isOnCooldown ? 'text.disabled' : 'inherit'
                            }}
                        />
                    </IconButton>
                </span>
            </Tooltip>

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

            <Snackbar
                open={showCooldown}
                autoHideDuration={4000}
                onClose={() => setShowCooldown(false)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    onClose={() => setShowCooldown(false)}
                    severity="info"
                    sx={{ width: '100%' }}
                >
                    Scan kürzlich ausgelöst — nächster in {formatRemaining(remainingMs)}
                </Alert>
            </Snackbar>

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
