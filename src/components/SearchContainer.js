'use client'

import { SearchBar } from '@/components/SearchBar'
import { SearchResults } from '@/components/SearchResults'
import { useSearch } from '@/hooks/useSearch'
import { useEffect } from 'react'

export default function SearchContainer() {
    const {
        searchString,
        setSearchString,
        movieResults,
        tvResults,
        error,
        loading,
        language,
        setLanguage,
        handleSearch,
        isClient
    } = useSearch()

    // Notify widgets without DOM MutationObserver (that competed with search UX)
    useEffect(() => {
        const movieCount = movieResults?.results?.length || 0
        const tvCount = tvResults?.results?.length || 0
        const hasResults = searchString.length >= 3 && (loading || movieCount > 0 || tvCount > 0 || !!error)
        window.dispatchEvent(new CustomEvent('usbeetv:search-active', {
            detail: { hasResults },
        }))
    }, [searchString, movieResults, tvResults, loading, error])

    return (
        <>
            <SearchBar
                searchString={searchString}
                onSearchChange={setSearchString}
                onSearch={handleSearch}
                language={language}
                onLanguageChange={setLanguage}
                isClient={isClient}
            />

            <SearchResults
                searchString={searchString}
                movieResults={movieResults}
                tvResults={tvResults}
                loading={loading}
                error={error}
                language={language}
            />
        </>
    )
}
