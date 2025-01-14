'use client'
import { useEffect, useState } from "react"

// Custom hook to check if a movie exists in the database
export const useMovieExistsInDb = (movie) => {
    const [movieExistsInDb, setMovieExistsInDb] = useState(undefined)

    useEffect(() => {
        const timer = setTimeout(async () => {
            try {
                const response = await fetch(`/api/library/movies?tmdbId=${movie.id}`)
                const data = await response.json()
                setMovieExistsInDb({ exists: data.exists })
            } catch (error) {
                console.error("Error checking if movie exists in DB:", error)
            }
        }, 2000)

        return () => clearTimeout(timer)
    }, [movie])

    return movieExistsInDb
}

export const useTvShowExistsInDb = (tvShow) => {
    const [tvShowStatus, setTvShowStatus] = useState(undefined)

    useEffect(() => {
        const timer = setTimeout(async () => {
            try {
                const response = await fetch(`/api/library/tvshows?tmdbId=${tvShow.id}`)
                const data = await response.json()
                if (data.exists) {
                    console.log(data)
                }
                setTvShowStatus({ exists: data.exists, isComplete: data.missingSeasons?.length === 0 })
            } catch (error) {
                console.error("Error checking if TV show exists in DB:", error)
            }
        }, 2000)

        return () => clearTimeout(timer)
    }, [tvShow])

    return tvShowStatus
}
