'use client'

import { SearchBar } from '@/components/SearchBar'
import { SearchResults } from '@/components/SearchResults'
import { useSearch } from '@/hooks/useSearch'

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

    return (
        <>
            {/* Search Section - Only receives stable props */}
            <SearchBar
                searchString={searchString}
                onSearchChange={setSearchString}
                onSearch={handleSearch}
                language={language}
                onLanguageChange={setLanguage}
                isClient={isClient}
            />

            {/* Content Section - Receives search results */}
            <SearchResults
                searchString={searchString}
                movieResults={movieResults}
                tvResults={tvResults}
                loading={loading}
                error={error}
            />
        </>
    )
} 