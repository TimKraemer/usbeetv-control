'use client'

import { Typography } from '@mui/material'
import { ResultCard } from './ResultCard'

export const ResultsSection = ({ title, results, type, className = '' }) => {
    if (!results?.results?.length) {
        return null
    }

    return (
        <div className={`flex-1 overflow-hidden flex flex-col items-stretch ${className}`}>
            <Typography variant="h5" className="mb-4 px-4 sm:px-6 lg:px-8">
                {title}
            </Typography>
            <div className="flex overflow-x-auto gap-4 h-full flex-1 px-4 sm:px-6 lg:px-8 pb-4">
                {results.results.map((result) => (
                    <ResultCard key={result.id} result={result} type={type} />
                ))}
            </div>
        </div>
    )
} 