'use client'
import { useEffect, useState } from "react"

// Custom hook to manage download progress
export const useDownloadProgress = (torrentId) => {
    const [downloadProgress, setDownloadProgress] = useState({ progress: 0, eta: 0 })

    useEffect(() => {
        if (!torrentId) return

        const fetchDownloadProgress = async () => {
            try {
                const response = await fetch(`/api/progress?torrentId=${torrentId}`)
                const data = await response.json()
                setDownloadProgress({ progress: Math.round(data.progress), eta: data.eta })
            } catch (error) {
                console.error("Error fetching download progress:", error)
            }
        }

        fetchDownloadProgress()
        const intervalId = setInterval(fetchDownloadProgress, 5000)
        return () => clearInterval(intervalId)
    }, [torrentId])

    return downloadProgress
}
