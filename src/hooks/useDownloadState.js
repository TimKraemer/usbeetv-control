'use client'

import { createContext, useContext, useEffect, useState } from 'react'

const DownloadStateContext = createContext()

export const DownloadStateProvider = ({ children }) => {
    const [hasActiveDownloads, setHasActiveDownloads] = useState(false)
    const [activeDownloads, setActiveDownloads] = useState([]) // Track individual downloads

    // No persistence: each session starts clean

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