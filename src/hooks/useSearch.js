'use client'

import { useCallback, useEffect, useState } from 'react'
import { useClientLanguage } from './useClientLanguage'

// Constants moved inline to prevent import issues
const SEARCH_CONFIG = {
    MIN_SEARCH_LENGTH: 3,
    DEBOUNCE_DELAY: 300,
    ALLOWED_CHARS_REGEX: /[^a-zA-Z0-9äöüÄÖÜß ]/g
}

const SEARCH_TYPES = {
    MOVIE: 'movie',
    TV: 'tv'
}

const ERROR_MESSAGES = {
    FETCH_FAILED: 'Failed to fetch data. Please try again.',
    SEARCH_FAILED: 'Failed to fetch search results.',
    NETWORK_ERROR: 'Network error. Please check your connection.'
}

export const useSearch = () => {
    const [searchString, setSearchString] = useState('')
    const [movieResults, setMovieResults] = useState([])
    const [tvResults, setTvResults] = useState([])
    const [error, setError] = useState(null)
    const [loading, setLoading] = useState(false)
    const { language, setLanguage, isClient } = useClientLanguage()

    const fetchData = useCallback(async (query) => {
        if (!query || query.trim().length < SEARCH_CONFIG.MIN_SEARCH_LENGTH) {
            setMovieResults([])
            setTvResults([])
            return
        }

        setLoading(true)
        setError(null)

        try {
            const encodedQuery = encodeURIComponent(query.trim())
            const responses = await Promise.all([
                fetch(`/api/search?searchstring=${encodedQuery}&type=${SEARCH_TYPES.MOVIE}&language=${language}`),
                fetch(`/api/search?searchstring=${encodedQuery}&type=${SEARCH_TYPES.TV}&language=${language}`)
            ])

            // Check if any response failed
            const hasError = responses.some(response => !response.ok)
            if (hasError) {
                throw new Error(ERROR_MESSAGES.SEARCH_FAILED)
            }

            const [movieData, tvData] = await Promise.all(
                responses.map(res => res.json())
            )

            setMovieResults(movieData.tmdbResults || [])
            setTvResults(tvData.tmdbResults || [])
        } catch (error) {
            console.error('Search error:', error)
            setError(ERROR_MESSAGES.FETCH_FAILED)
            setMovieResults([])
            setTvResults([])
        } finally {
            setLoading(false)
        }
    }, [language])

    // Debounced search effect
    useEffect(() => {
        if (!isClient) return // Don't search until client is hydrated

        const trimmedSearchString = searchString.trim().replace(SEARCH_CONFIG.ALLOWED_CHARS_REGEX, '')

        if (trimmedSearchString.length >= SEARCH_CONFIG.MIN_SEARCH_LENGTH) {
            const timeoutId = setTimeout(() => {
                fetchData(trimmedSearchString)
            }, SEARCH_CONFIG.DEBOUNCE_DELAY)

            return () => clearTimeout(timeoutId)
        }

        setMovieResults([])
        setTvResults([])
        setError(null)
    }, [searchString, fetchData, isClient])

    const handleSearch = useCallback(() => {
        const trimmedSearchString = searchString.trim()
        if (trimmedSearchString.length >= SEARCH_CONFIG.MIN_SEARCH_LENGTH) {
            fetchData(trimmedSearchString)
        }
    }, [searchString, fetchData])

    const clearSearch = useCallback(() => {
        setSearchString('')
        setMovieResults([])
        setTvResults([])
        setError(null)
    }, [])

    return {
        searchString,
        setSearchString,
        movieResults,
        tvResults,
        error,
        loading,
        language,
        setLanguage,
        handleSearch,
        clearSearch,
        isClient
    }
} 