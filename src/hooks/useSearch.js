'use client'

import { sanitizeSearchString } from '@/utils/formatters'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useClientLanguage } from './useClientLanguage'

// Constants moved inline to prevent import issues
const SEARCH_CONFIG = {
    MIN_SEARCH_LENGTH: 3,
    DEBOUNCE_DELAY: 300,
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

    // Stabilize setSearchString to prevent re-renders
    const stableSetSearchString = useCallback((value) => {
        setSearchString(value)
    }, [])

    // Memoize the sanitized search string
    const sanitizedSearchString = useMemo(() =>
        sanitizeSearchString(searchString),
        [searchString]
    )

    // Memoize the search validity
    const isValidSearch = useMemo(() =>
        sanitizedSearchString.length >= SEARCH_CONFIG.MIN_SEARCH_LENGTH,
        [sanitizedSearchString]
    )

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

        if (isValidSearch) {
            const timeoutId = setTimeout(() => {
                fetchData(sanitizedSearchString)
            }, SEARCH_CONFIG.DEBOUNCE_DELAY)

            return () => clearTimeout(timeoutId)
        }

        setMovieResults([])
        setTvResults([])
        setError(null)
    }, [sanitizedSearchString, fetchData, isClient, isValidSearch])

    const handleSearch = useCallback(() => {
        if (isValidSearch) {
            fetchData(sanitizedSearchString)
        }
    }, [sanitizedSearchString, fetchData, isValidSearch])

    const clearSearch = useCallback(() => {
        setSearchString('')
        setMovieResults([])
        setTvResults([])
        setError(null)
    }, [])

    // Create a completely stable search state object that never changes
    // This prevents any re-renders of the SearchBar component
    const stableSearchState = useMemo(() => ({
        searchString,
        setSearchString: stableSetSearchString,
        language,
        setLanguage,
        handleSearch,
        clearSearch,
        isClient,
        isValidSearch
    }), [
        searchString,
        stableSetSearchString,
        language,
        setLanguage,
        handleSearch,
        clearSearch,
        isClient,
        isValidSearch
    ])

    // Return the stable search state and unstable values separately
    return {
        ...stableSearchState,
        // These values can change and cause re-renders, but they're only used by SearchResults
        movieResults,
        tvResults,
        error,
        loading
    }
} 