'use client'

import { createContext, useContext, useState } from 'react'

const DownloadStateContext = createContext()

export const DownloadStateProvider = ({ children }) => {
    const [hasActiveDownloads, setHasActiveDownloads] = useState(false)

    const startDownload = () => {
        setHasActiveDownloads(true)
    }

    const stopDownload = () => {
        setHasActiveDownloads(false)
    }

    return (
        <DownloadStateContext.Provider value={{
            hasActiveDownloads,
            startDownload,
            stopDownload
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