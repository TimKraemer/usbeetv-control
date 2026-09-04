'use client'

import { useEffect, useState } from 'react'
import { MobileWidgets } from './MobileWidgets'

const DISK_SPACE_TIMEOUT_MS = 10000
const DISK_SPACE_POLL_MS = 30000
const DISK_SPACE_DEFER_MS = 500

export const MobileWidgetsContainer = ({ onCollapsedChange }) => {
    const [diskInfo, setDiskInfo] = useState(null)
    const [hasSearchResults, setHasSearchResults] = useState(false)
    const [isCollapsed, setIsCollapsed] = useState(false)

    // Collapse widgets when search is active (driven by SearchContainer events)
    useEffect(() => {
        const handleSearchActive = (event) => {
            setHasSearchResults(Boolean(event.detail?.hasResults))
        }
        window.addEventListener('usbeetv:search-active', handleSearchActive)
        return () => window.removeEventListener('usbeetv:search-active', handleSearchActive)
    }, [])

    // Notify parent when collapsed state changes
    useEffect(() => {
        if (onCollapsedChange) {
            onCollapsedChange(isCollapsed)
        }
    }, [isCollapsed, onCollapsedChange])

    useEffect(() => {
        let cancelled = false
        let diskInterval

        const fetchDiskSpace = async () => {
            try {
                const response = await fetch('/api/disk-space', {
                    signal: AbortSignal.timeout(DISK_SPACE_TIMEOUT_MS),
                })
                if (!response.ok) {
                    throw new Error('Failed to fetch disk space')
                }
                const data = await response.json()
                if (!cancelled) {
                    setDiskInfo(data)
                }
            } catch (error) {
                if (error.name === 'TimeoutError' || error.name === 'AbortError') {
                    console.warn('Disk space check timed out')
                } else {
                    console.error('Error fetching disk space:', error)
                }
            }
        }

        // Defer so search/API traffic is not blocked by Synology on first paint
        const deferId = setTimeout(() => {
            fetchDiskSpace()
            diskInterval = setInterval(fetchDiskSpace, DISK_SPACE_POLL_MS)
        }, DISK_SPACE_DEFER_MS)

        return () => {
            cancelled = true
            clearTimeout(deferId)
            if (diskInterval) clearInterval(diskInterval)
        }
    }, [])

    return (
        <MobileWidgets
            diskInfo={diskInfo}
            hasSearchResults={hasSearchResults}
            isCollapsed={isCollapsed}
            onCollapsedChange={setIsCollapsed}
        />
    )
}
