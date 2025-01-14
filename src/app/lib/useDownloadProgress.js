'use client'
import { useState } from "react"
import { useInterval } from "react-use"

// Custom hook to manage download progress
export const useDownloadProgress = (torrentId) => {
    const [downloadProgress, setDownloadProgress] = useState({ progress: 0, eta: 0 })

    const fetchDownloadProgress = async () => {
        try {
            const response = await fetch(`/api/progress?torrentId=${torrentId}`)
            const data = await response.json()
            setDownloadProgress({ progress: Math.round(data.progress), eta: data.eta })
        } catch (error) {
            console.error("Error fetching download progress:", error)
        }
    }

    useInterval(() => {
        if (torrentId) {
            fetchDownloadProgress()
        }
    }, 5000)

    return downloadProgress
}
