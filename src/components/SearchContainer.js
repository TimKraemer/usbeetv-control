'use client'

import { DiskSpaceWidget } from '@/components/DiskSpaceWidget'
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
            {/* Header with Disk Space Widget */}
            <div className="flex justify-center sm:justify-start row">
                <DiskSpaceWidget />
            </div>

            {/* Search Section */}
            <SearchBar
                searchString={searchString}
                onSearchChange={setSearchString}
                onSearch={handleSearch}
                language={language}
                onLanguageChange={setLanguage}
                disabled={loading}
                isClient={isClient}
            />

            {/* Content Section */}
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