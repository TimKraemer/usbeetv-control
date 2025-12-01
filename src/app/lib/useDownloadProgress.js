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

        const fetchDownloadProgress = async () => {
            try {
                const response = await fetch(`/api/progress?torrentId=${torrentId}`)
                const data = await response.json()
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
                console.error("Error fetching download progress:", error)
            }
        }

        let intervalId = null

        const startPolling = () => {
            fetchDownloadProgress()
            intervalId = setInterval(fetchDownloadProgress, 5000)
        }

        startPolling()

        return () => {
            if (intervalId) clearInterval(intervalId)
        }
    }, [torrentId, tmdbId, type, title, startDownload, updateDownloadProgress, stopDownload])

    return downloadProgress
}
