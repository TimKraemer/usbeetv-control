'use client'

import { useEffect, useState } from 'react'
import { MobileWidgets } from './MobileWidgets'

export const MobileWidgetsContainer = () => {
    const [diskInfo, setDiskInfo] = useState(null)
    const [poolInfo, setPoolInfo] = useState(null)
    const [diskError, setDiskError] = useState(null)
    const [poolError, setPoolError] = useState(null)
    const [hasSearchResults, setHasSearchResults] = useState(false)

    // Check for search results by observing the DOM
    useEffect(() => {
        const checkForSearchResults = () => {
            const searchResults = document.querySelectorAll('[data-testid="search-results"], .search-results, [class*="ResultsSection"]')
            const hasResults = searchResults.length > 0 &&
                Array.from(searchResults).some(el => el.children.length > 0)
            setHasSearchResults(hasResults)
        }

        // Check immediately
        checkForSearchResults()

        // Set up observer to watch for changes
        const observer = new MutationObserver(checkForSearchResults)
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'style']
        })

        return () => observer.disconnect()
    }, [])

    useEffect(() => {
        // Fetch disk space data
        const fetchDiskSpace = async () => {
            try {
                const response = await fetch('/api/disk-space')
                if (!response.ok) {
                    throw new Error('Failed to fetch disk space')
                }
                const data = await response.json()
                setDiskInfo(data)
                setDiskError(null)
            } catch (error) {
                console.error('Error fetching disk space:', error)
                setDiskError('Failed to load disk space')
            }
        }

        // Fetch PayPal pool data
        const fetchPoolStatus = async () => {
            try {
                const response = await fetch('/api/paypal-pool-status')
                if (!response.ok) {
                    throw new Error('Failed to fetch pool status')
                }
                const data = await response.json()
                setPoolInfo(data)
                setPoolError(null)
            } catch (error) {
                console.error('Error fetching pool status:', error)
                setPoolError('Failed to load pool status')
            }
        }

        // Fetch both data
        fetchDiskSpace()
        fetchPoolStatus()

        // Set up polling for disk space (every 30 seconds)
        const diskInterval = setInterval(fetchDiskSpace, 30000)

        // Set up polling for pool status (every 5 minutes)
        const poolInterval = setInterval(fetchPoolStatus, 300000)

        return () => {
            clearInterval(diskInterval)
            clearInterval(poolInterval)
        }
    }, [])

    return (
        <MobileWidgets
            diskInfo={diskInfo}
            poolInfo={poolInfo}
            hasSearchResults={hasSearchResults}
        />
    )
} 