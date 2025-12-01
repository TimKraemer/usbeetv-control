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
                setMovieExistsInDb({ exists: data.exists, isComplete: data.exists })
            } catch (error) {
                console.error("Error checking if movie exists in DB:", error)
            }
        }, 1500)

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
                // if (data.exists) {
                //     console.log(data)
                // }
                setTvShowStatus({ exists: data.exists, isComplete: data.missingSeasons?.length === 0 })
            } catch (error) {
                console.error("Error checking if TV show exists in DB:", error)
            }
        }, 1500)

        return () => clearTimeout(timer)
    }, [tvShow])

    return tvShowStatus
}

// Batch hook to check multiple items at once
export const useBatchLibraryCheck = (results, type) => {
    const [libraryStatus, setLibraryStatus] = useState({})
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!results || results.length === 0) {
            setLibraryStatus({})
            setLoading(false)
            return
        }

        const checkLibrary = async () => {
            try {
                const items = results.map(result => ({
                    tmdbId: result.id.toString(),
                    type: type
                }))

                const response = await fetch('/api/library/batch', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ items })
                })

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}: ${response.statusText}` }))
                    throw new Error(errorData.error || `Failed to batch check library: HTTP ${response.status}`)
                }

                const data = await response.json()
                setLibraryStatus(data)
            } catch (error) {
                console.error("Error batch checking library:", error)
                // Set all to undefined on error
                const errorStatus = {}
                for (const result of results) {
                    errorStatus[result.id] = undefined
                }
                setLibraryStatus(errorStatus)
            } finally {
                setLoading(false)
            }
        }

        checkLibrary()
    }, [results, type])

    return { libraryStatus, loading }
}
