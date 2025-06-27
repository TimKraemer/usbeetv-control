'use client'

import { useCallback, useEffect, useState } from 'react'

export const usePolling = ({
    fetchFunction,
    interval = 30000,
    enabled = true,
    initialData = null
}) => {
    const [data, setData] = useState(initialData)
    const [error, setError] = useState(null)
    const [loading, setLoading] = useState(false)

    const fetchData = useCallback(async () => {
        if (!enabled) return

        try {
            setLoading(true)
            setError(null)
            const result = await fetchFunction()
            setData(result)
        } catch (err) {
            console.error('Polling error:', err)
            setError(err.message || 'Failed to fetch data')
        } finally {
            setLoading(false)
        }
    }, [fetchFunction, enabled])

    useEffect(() => {
        if (!enabled || !initialData) return

        // Initial fetch
        fetchData()

        // Set up polling interval
        const intervalId = setInterval(fetchData, interval)

        return () => clearInterval(intervalId)
    }, [fetchData, interval, enabled, initialData])

    const refetch = useCallback(() => {
        fetchData()
    }, [fetchData])

    return {
        data,
        error,
        loading,
        refetch
    }
} 