'use client'

import { CircularProgress, Typography } from '@mui/material'
import { motion } from 'framer-motion'
import { ResultsSection } from './ResultsSection'

export const SearchResults = ({
    searchString,
    movieResults,
    tvResults,
    loading,
    error,
    language
}) => {
    if (error) {
        return (
            <motion.div
                className="w-full px-4 sm:px-6 lg:px-8"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
            >
                <Typography variant="body1" color="error" className="text-center mb-4">
                    {error}
                </Typography>
            </motion.div>
        )
    }

    if (!searchString || searchString.length < 3) {
        return (
            <motion.div
                className="max-w-2xl mx-auto text-center px-4 sm:px-6 lg:px-8"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
            >
                <Typography variant="body1" className="text-gray-400 text-lg">
                    Um dem USBeeTV einen Film oder eine Serie hinzuzufügen, suche ihn zunächst mit der Suchbox und tippe dann auf den gewünschten Titel.
                </Typography>
            </motion.div>
        )
    }

    // Always extract the .results array from the API response
    const movieResultsArray = movieResults?.results || []
    const tvResultsArray = tvResults?.results || []

    // Helper to extract year for sorting
    function getYear(result, type) {
        const dateString = type === 'movie' ? result.release_date : result.first_air_date
        if (!dateString) return 0
        return new Date(dateString).getFullYear()
    }

    // Sort results by year descending
    const sortedMovieResults = [...movieResultsArray].sort((a, b) => getYear(b, 'movie') - getYear(a, 'movie'))
    const sortedTvResults = [...tvResultsArray].sort((a, b) => getYear(b, 'tv') - getYear(a, 'tv'))

    return (
        <motion.div
            data-testid="search-results"
            className="flex flex-col gap-8 w-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
        >
            <ResultsSection
                title="Filme"
                results={sortedMovieResults}
                type="movie"
                loading={loading}
                language={language}
            />
            <ResultsSection
                title="Serien"
                results={sortedTvResults}
                type="tv"
                loading={loading}
                language={language}
            />
        </motion.div>
    )
} 