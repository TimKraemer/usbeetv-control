'use client'

import { Skeleton, Typography } from '@mui/material'
import { motion } from 'framer-motion'
import { ResultCard } from './ResultCard'

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1
        }
    }
}

export const ResultsSection = ({ title, results, type, className = '', loading = false, language }) => {
    if (!results?.length && !loading) {
        return null
    }

    return (
        <motion.div
            className={`flex-1 overflow-hidden flex flex-col items-stretch ${className}`}
            variants={containerVariants}
            initial="hidden"
            animate="visible"
        >
            <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5 }}
            >
                <Typography variant="h5" className="mb-4 px-4 sm:px-6 lg:px-8">
                    {title}
                </Typography>
            </motion.div>

            <div className="flex overflow-x-auto gap-4 h-full flex-1 px-4 sm:px-6 lg:px-8 pb-4">
                {loading ? (
                    // Loading skeletons
                    Array.from({ length: 6 }, (_, i) => `skeleton-${type}-${i}`).map((skeletonId) => (
                        <motion.div
                            key={skeletonId}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: Number.parseInt(skeletonId.split('-').pop()) * 0.1 }}
                            className="min-w-[200px] aspect-square"
                        >
                            <Skeleton
                                variant="rectangular"
                                width="100%"
                                height="100%"
                                className="rounded-lg"
                            />
                        </motion.div>
                    ))
                ) : (
                    // Actual results
                    results?.map((result, index) => (
                        <ResultCard
                            key={result.id}
                            result={result}
                            type={type}
                            index={index}
                            language={language}
                        />
                    ))
                )}
            </div>
        </motion.div>
    )
} 