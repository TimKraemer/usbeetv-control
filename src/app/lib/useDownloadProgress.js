'use client'
import { useDownloadState } from '@/hooks/useDownloadState'
import { useEffect, useState } from "react"

// Custom hook to manage download progress
export const useDownloadProgress = (torrentId, tmdbId = null, type = null, title = null) => {
    const [downloadProgress, setDownloadProgress] = useState({ progress: 0, eta: 0, state: '', isComplete: false })
    const { startDownload, updateDownloadProgress, stopDownload } = useDownloadState()

    useEffect(() => {
        if (!torrentId) return

        // Register this download with the global state
        startDownload(torrentId, tmdbId, type, title)

        const abortController = new AbortController()
        let intervalId = null

        const fetchDownloadProgress = async () => {
            try {
                const response = await fetch(`/api/progress?torrentId=${torrentId}`, {
                    signal: abortController.signal
                })
                
                // If torrent not found or error, stop polling
                if (!response.ok) {
                    if (intervalId) clearInterval(intervalId)
                    stopDownload(torrentId)
                    return
                }
                
                const data = await response.json()
                
                // If torrent was removed/cancelled, stop polling
                if (data.error || data.notFound) {
                    if (intervalId) clearInterval(intervalId)
                    stopDownload(torrentId)
                    return
                }
                
                const newProgress = {
                    progress: Math.round(data.progress),
                    eta: data.eta,
                    state: data.state,
                    isComplete: data.isComplete
                }
                setDownloadProgress(newProgress)

                // Update global state with progress
                updateDownloadProgress(torrentId, newProgress.progress, newProgress.eta, newProgress.state)

                // If download is complete, notify the context to stop tracking active downloads
                if (newProgress.isComplete) {
                    if (intervalId) clearInterval(intervalId)
                    // Delay stopping the download state to show completion status
                    setTimeout(() => {
                        stopDownload(torrentId)
                    }, 10000) // 10 second delay to show completion status
                }
            } catch (error) {
                // Ignore abort errors
                if (error.name === 'AbortError') return
                
                console.error("Error fetching download progress:", error)
                // On error, stop polling to prevent endless failed requests
                if (intervalId) clearInterval(intervalId)
            }
        }

        const startPolling = () => {
            fetchDownloadProgress()
            intervalId = setInterval(fetchDownloadProgress, 2000)
        }

        startPolling()

        return () => {
            abortController.abort()
            if (intervalId) clearInterval(intervalId)
        }
    }, [torrentId, tmdbId, type, title, startDownload, updateDownloadProgress, stopDownload])

    return downloadProgress
}
