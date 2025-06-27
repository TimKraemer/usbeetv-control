'use client'

import { Card, CardActionArea, CardContent, Skeleton } from '@mui/material'
import { motion } from 'framer-motion'

const MotionCard = motion.create(Card)

export const WidgetCard = ({
    children,
    className = '',
    onClick,
    loading = false,
    error = false,
    hover = true
}) => {
    const baseClasses = "w-full h-full flex flex-col flex-1"
    const hoverClasses = hover ? "cursor-pointer hover:shadow-lg transition-all duration-300 hover:scale-[1.02]" : ""
    const errorClasses = error ? "border-red-500 border-2" : ""

    const combinedClasses = `${baseClasses} ${hoverClasses} ${errorClasses} ${className}`.trim()

    if (loading) {
        return (
            <MotionCard
                className={combinedClasses}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
            >
                <CardContent className="flex-1">
                    <Skeleton variant="text" width="60%" height={20} className="mb-2" />
                    <Skeleton variant="rectangular" height={8} className="mb-2 rounded" />
                    <Skeleton variant="text" width="40%" height={16} />
                </CardContent>
            </MotionCard>
        )
    }

    return (
        <MotionCard
            className={combinedClasses}
            onClick={onClick}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            whileHover={hover ? { scale: 1.02 } : {}}
            whileTap={onClick ? { scale: 0.98 } : {}}
        >
            <CardContent className="pb-4 flex-1 flex flex-col">
                {children}
            </CardContent>
        </MotionCard>
    )
} 