'use client'
import { useEffect, useState } from "react"

export const useFutureRelease = (result, type) => {
    const [futureRelease, setFutureRelease] = useState(false)

    useEffect(() => {
        const releaseDate = new Date(type === 'movie' ? result.release_date : result.first_air_date)
        const currentDate = new Date()
        if (releaseDate > currentDate) {
            setFutureRelease(true)
        }
    }, [result, type])

    return futureRelease
}
