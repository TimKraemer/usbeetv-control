'use client'

import { createContext, useContext, useEffect, useState } from 'react'

const DownloadStateContext = createContext()

export const DownloadStateProvider = ({ children }) => {
    const [hasActiveDownloads, setHasActiveDownloads] = useState(false)
    const [activeDownloads, setActiveDownloads] = useState([]) // Track individual downloads

    // Load active downloads from localStorage on mount
    useEffect(() => {
        try {
            const stored = localStorage.getItem('activeDownloads')
            if (stored) {
                const downloads = JSON.parse(stored)
                // Clean up downloads older than 24 hours
                const now = Date.now()
                const validDownloads = downloads.filter(d => {
                    const age = now - d.startTime
                    return age < 24 * 60 * 60 * 1000 // 24 hours
                })

                if (validDownloads.length !== downloads.length) {
                    console.log(`Cleaned up ${downloads.length - validDownloads.length} old downloads`)
                }

                // Mark reconnected downloads as not having real-time progress
                const reconnectedDownloads = validDownloads.map(d => ({
                    ...d,
                    progress: 0, // Reset progress for reconnected downloads
                    eta: 0,      // Reset ETA for reconnected downloads
                    reconnected: true // Mark as reconnected
                }))

                setActiveDownloads(reconnectedDownloads)
                setHasActiveDownloads(reconnectedDownloads.length > 0)
            }
        } catch (error) {
            console.error('Error loading active downloads from localStorage:', error)
        }
    }, [])

    // Save active downloads to localStorage whenever they change
    useEffect(() => {
        try {
            localStorage.setItem('activeDownloads', JSON.stringify(activeDownloads))
        } catch (error) {
            console.error('Error saving active downloads to localStorage:', error)
        }
    }, [activeDownloads])

    const startDownload = (torrentId = null, tmdbId = null, type = null, title = null) => {
        setHasActiveDownloads(true)
        if (torrentId) {
            setActiveDownloads(prev => {
                const existing = prev.find(d => d.torrentId === torrentId)
                if (existing) return prev
                return [...prev, {
                    torrentId,
                    tmdbId,
                    type,
                    title,
                    startTime: Date.now(),
                    progress: 0,
                    eta: 0,
                    state: 'Downloading'
                }]
            })
        }
    }

    const updateDownloadProgress = (torrentId, progress, eta, state) => {
        setActiveDownloads(prev =>
            prev.map(d =>
                d.torrentId === torrentId
                    ? { ...d, progress, eta, state }
                    : d
            )
        )
    }

    const cancelDownload = async (torrentId) => {
        try {
            const response = await fetch('/api/download/cancel', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ torrentId })
            })

            if (!response.ok) {
                throw new Error('Failed to cancel download')
            }

            // Remove from active downloads
            stopDownload(torrentId)
            return { success: true }
        } catch (error) {
            console.error('Error cancelling download:', error)
            return { success: false, error: error.message }
        }
    }

    const stopDownload = (torrentId = null) => {
        if (torrentId) {
            setActiveDownloads(prev => prev.filter(d => d.torrentId !== torrentId))
            setHasActiveDownloads(prev => {
                const remaining = activeDownloads.filter(d => d.torrentId !== torrentId)
                return remaining.length > 0
            })
        } else {
            setHasActiveDownloads(false)
            setActiveDownloads([])
        }
    }

    const clearCompletedDownloads = () => {
        setActiveDownloads([])
        setHasActiveDownloads(false)
    }

    return (
        <DownloadStateContext.Provider value={{
            hasActiveDownloads,
            activeDownloads,
            startDownload,
            updateDownloadProgress,
            cancelDownload,
            stopDownload,
            clearCompletedDownloads
        }}>
            {children}
        </DownloadStateContext.Provider>
    )
}

export const useDownloadState = () => {
    const context = useContext(DownloadStateContext)
    if (!context) {
        throw new Error('useDownloadState must be used within a DownloadStateProvider')
    }
    return context
} 