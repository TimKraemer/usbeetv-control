'use client'
import { useEffect, useState } from "react"

const LIBRARY_CHECK_TIMEOUT_MS = 8000
const LIBRARY_CHECK_MAX_RETRIES = 3
const LIBRARY_CHECK_RETRY_DELAY_MS = 1000

async function fetchWithTimeoutRetry(url, options = {}, {
    timeoutMs = LIBRARY_CHECK_TIMEOUT_MS,
    maxRetries = LIBRARY_CHECK_MAX_RETRIES,
    retryDelayMs = LIBRARY_CHECK_RETRY_DELAY_MS,
} = {}) {
    let lastError

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch(url, {
                ...options,
                signal: AbortSignal.timeout(timeoutMs),
            })
            return response
        } catch (error) {
            lastError = error
            console.warn(`[Library check] Attempt ${attempt}/${maxRetries} failed: ${error.message}`)
            if (attempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, retryDelayMs))
            }
        }
    }

    throw lastError
}

// Custom hook to check if a movie exists in the database
export const useMovieExistsInDb = (movie) => {
    const [movieExistsInDb, setMovieExistsInDb] = useState(undefined)

    useEffect(() => {
        let cancelled = false
        const timer = setTimeout(async () => {
            try {
                const response = await fetchWithTimeoutRetry(`/api/library/movies?tmdbId=${movie.id}`)
                const data = await response.json()
                if (!cancelled) {
                    setMovieExistsInDb({ exists: data.exists, isComplete: data.exists })
                }
            } catch (error) {
                console.error("Error checking if movie exists in DB:", error)
                if (!cancelled) {
                    setMovieExistsInDb({ exists: false, isComplete: false })
                }
            }
        }, 1500)

        return () => {
            cancelled = true
            clearTimeout(timer)
        }
    }, [movie])

    return movieExistsInDb
}

export const useTvShowExistsInDb = (tvShow) => {
    const [tvShowStatus, setTvShowStatus] = useState(undefined)

    useEffect(() => {
        let cancelled = false
        const timer = setTimeout(async () => {
            try {
                const response = await fetchWithTimeoutRetry(`/api/library/tvshows?tmdbId=${tvShow.id}`)
                const data = await response.json()
                if (!cancelled) {
                    setTvShowStatus({ exists: data.exists, isComplete: data.missingSeasons?.length === 0 })
                }
            } catch (error) {
                console.error("Error checking if TV show exists in DB:", error)
                if (!cancelled) {
                    setTvShowStatus({ exists: false, isComplete: false })
                }
            }
        }, 1500)

        return () => {
            cancelled = true
            clearTimeout(timer)
        }
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

        let cancelled = false

        const checkLibrary = async () => {
            setLoading(true)

            try {
                const items = results.map(result => ({
                    tmdbId: result.id.toString(),
                    type: type
                }))

                const response = await fetchWithTimeoutRetry('/api/library/batch', {
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
                if (!cancelled) {
                    setLibraryStatus(data)
                }
            } catch (error) {
                console.error("Error batch checking library:", error)
                if (!cancelled) {
                    // Treat as "not in library" so cards stay usable instead of spinning forever
                    const fallbackStatus = {}
                    for (const result of results) {
                        fallbackStatus[result.id] = { exists: false, isComplete: false }
                    }
                    setLibraryStatus(fallbackStatus)
                }
            } finally {
                if (!cancelled) {
                    setLoading(false)
                }
            }
        }

        checkLibrary()

        return () => {
            cancelled = true
        }
    }, [results, type])

    return { libraryStatus, loading }
}
