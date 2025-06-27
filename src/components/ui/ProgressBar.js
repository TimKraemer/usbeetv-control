'use client'

import { Box, LinearProgress, Typography } from '@mui/material'
import { motion } from 'framer-motion'

const MotionLinearProgress = motion.create(LinearProgress)

export const ProgressBar = ({
    value,
    maxValue = 100,
    color = 'primary',
    height = 8,
    showValue = true,
    className = '',
    animated = true
}) => {
    const percentage = Math.min((value / maxValue) * 100, 100)

    const getColor = () => {
        if (color === 'error' || percentage > 80) return '#ef4444'
        if (color === 'warning' || percentage > 60) return '#f59e0b'
        if (color === 'success') return '#10b981'
        if (color === 'paypal') return '#0070ba'
        return '#3b82f6'
    }

    const progressBar = (
        <MotionLinearProgress
            variant="determinate"
            value={percentage}
            className={`h-${height} rounded-full ${className}`}
            sx={{
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                '& .MuiLinearProgress-bar': {
                    backgroundColor: getColor(),
                    borderRadius: 'inherit',
                    transition: animated ? 'all 0.3s ease-in-out' : 'none'
                }
            }}
            initial={animated ? { scaleX: 0 } : {}}
            animate={animated ? { scaleX: 1 } : {}}
            transition={animated ? { duration: 0.8, ease: "easeOut" } : {}}
        />
    )

    if (!showValue) {
        return (
            <Box className="mb-2">
                {progressBar}
            </Box>
        )
    }

    return (
        <Box className="mb-2">
            {progressBar}
            <Box className="flex justify-between items-center mt-1">
                <motion.span
                    className="text-xs text-gray-400"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                >
                    {value}
                </motion.span>
                <motion.span
                    className="text-xs font-medium"
                    style={{ color: getColor() }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                >
                    {percentage.toFixed(1)}%
                </motion.span>
            </Box>
        </Box>
    )
} 