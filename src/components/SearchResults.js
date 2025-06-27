'use client'

import { CircularProgress, Typography } from '@mui/material'
import { ResultsSection } from './ResultsSection'

export const SearchResults = ({
    searchString,
    movieResults,
    tvResults,
    loading,
    error
}) => {
    if (error) {
        return (
            <div className="w-full px-4 sm:px-6 lg:px-8">
                <Typography variant="body1" color="error" className="text-center mb-4">
                    {error}
                </Typography>
            </div>
        )
    }

    if (loading) {
        return (
            <div className="flex justify-center py-12">
                <CircularProgress />
            </div>
        )
    }

    if (!searchString || searchString.length < 3) {
        return (
            <div className="max-w-2xl mx-auto text-center px-4 sm:px-6 lg:px-8">
                <Typography variant="body1" className="text-gray-400 text-lg">
                    Um dem USBeeTV einen Film oder eine Serie hinzuzufügen, suche ihn zunächst mit der Suchbox und tippe dann auf den gewünschten Titel.
                </Typography>
            </div>
        )
    }

    return (
        <div className="flex flex-col lg:flex-row gap-8 w-full">
            <ResultsSection title="Filme" results={movieResults} type="movie" />
            <ResultsSection title="Serien" results={tvResults} type="tv" />
        </div>
    )
} 