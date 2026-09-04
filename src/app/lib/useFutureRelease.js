'use client'
import { useMemo } from 'react'

export const useFutureRelease = (result, type) => {
    return useMemo(() => {
        const dateString = type === 'movie' ? result?.release_date : result?.first_air_date
        if (!dateString) return false
        const releaseDate = new Date(dateString)
        if (Number.isNaN(releaseDate.getTime())) return false
        return releaseDate > new Date()
    }, [result, type])
}
