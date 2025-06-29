'use client'
import { useDownloadState } from '@/hooks/useDownloadState'
import { useEffect, useState } from "react"

// Custom hook to manage download progress
export const useDownloadProgress = (torrentId) => {
    const [downloadProgress, setDownloadProgress] = useState({ progress: 0, eta: 0, state: '', isComplete: false })
    const { stopDownload } = useDownloadState()

    useEffect(() => {
        console.log('useDownloadProgress: torrentId changed to:', torrentId)
        if (!torrentId) return

        const fetchDownloadProgress = async () => {
            try {
                console.log('Fetching progress for torrent ID:', torrentId)
                const response = await fetch(`/api/progress?torrentId=${torrentId}`)
                const data = await response.json()
                console.log('Progress data received:', data)
                const newProgress = {
                    progress: Math.round(data.progress),
                    eta: data.eta,
                    state: data.state,
                    isComplete: data.isComplete
                }
                setDownloadProgress(newProgress)

                // If download is complete, notify the context to stop tracking active downloads
                if (newProgress.isComplete) {
                    // Delay stopping the download state to allow for library scan feedback
                    setTimeout(() => {
                        stopDownload()
                    }, 10000) // 10 second delay to show completion status
                }
            } catch (error) {
                console.error("Error fetching download progress:", error)
            }
        }

        fetchDownloadProgress()
        const intervalId = setInterval(fetchDownloadProgress, 5000)
        return () => clearInterval(intervalId)
    }, [torrentId, stopDownload])

    return downloadProgress
}
