'use client'

import { LibraryScanButton } from '@/components/LibraryScanButton'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { PAYPAL_CONFIG } from '@/constants/app'
import { formatCurrency, formatDate } from '@/utils/formatters'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import StorageIcon from '@mui/icons-material/Storage'
import { Box, IconButton, Typography } from '@mui/material'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect } from 'react'

export const MobileWidgets = ({
    diskInfo,
    poolInfo,
    hasSearchResults = false,
    isCollapsed = false,
    onCollapsedChange,
}) => {

    // Defensive: Only parse if usePercent is a string
    const usePercent = (typeof diskInfo?.usePercent === 'string' && diskInfo.usePercent.includes('%'))
        ? Number.parseInt(diskInfo.usePercent.replace('%', ''))
        : 0
    const isLowSpace = usePercent > 80

    // Defensive: Only calculate if both are numbers
    const progressPercent = (typeof poolInfo?.currentAmount === 'number' && typeof poolInfo?.targetAmount === 'number' && poolInfo.targetAmount > 0)
        ? (poolInfo.currentAmount / poolInfo.targetAmount) * 100
        : 0

    // Auto-collapse when search has results
    useEffect(() => {
        if (hasSearchResults) {
            onCollapsedChange?.(true)
        } else {
            onCollapsedChange?.(false)
        }
    }, [hasSearchResults, onCollapsedChange])

    const handlePayPalClick = () => {
        if (isCollapsed) {
            onCollapsedChange?.(false)
        } else {
            window.open(PAYPAL_CONFIG.POOL_URL, '_blank')
        }
    }

    const handleDiskClick = () => {
        onCollapsedChange?.(!isCollapsed)
    }


    return (
        <AnimatePresence>
            <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="mt-4"
            >
                {isCollapsed ? (
                    // Collapsed state - single row
                    <div className="flex flex-col gap-2 px-4">
                        {/* Disk Space Widget - Collapsed */}
                        <motion.div
                            className="flex-1 bg-white bg-opacity-5 rounded-lg border border-gray-600 p-2 flex flex-col items-center justify-center min-w-0 cursor-pointer"
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: 0.1 }}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={handleDiskClick}
                        >
                            <div className="flex items-center gap-2 w-full">
                                <StorageIcon
                                    className={`text-xl ${isLowSpace ? 'text-red-500' : 'text-green-500'}`}
                                />
                                <div className="flex-1">
                                    <ProgressBar
                                        value={usePercent}
                                        maxValue={100}
                                        color={isLowSpace ? 'error' : 'success'}
                                        height={4}
                                        showValue={false}
                                        animated={true}
                                    />
                                </div>
                                <Typography variant="caption" color="textSecondary" className="font-medium whitespace-nowrap">
                                    {diskInfo?.available || 'N/A'} | {usePercent}%
                                </Typography>
                            </div>
                        </motion.div>

                        {/* PayPal Pool Widget - Collapsed */}
                        <motion.div
                            className="flex-1 bg-white bg-opacity-5 rounded-lg border border-gray-600 p-2 flex flex-col items-center justify-center min-w-0 cursor-pointer"
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: 0.2 }}
                            onClick={handlePayPalClick}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                        >
                            <div className="flex items-center gap-2 w-full">
                                <img
                                    src="/euro4ssd.svg"
                                    alt="Euro4SSD"
                                    className="w-5 h-5"
                                />
                                <div className="flex-1">
                                    <ProgressBar
                                        value={progressPercent}
                                        maxValue={100}
                                        color="paypal"
                                        height={4}
                                        showValue={false}
                                        animated={true}
                                    />
                                </div>
                                <Typography variant="caption" color="textSecondary" className="font-medium whitespace-nowrap">
                                    {poolInfo ? formatCurrency(poolInfo.currentAmount) : 'N/A'} | {progressPercent.toFixed(0)}%
                                </Typography>
                            </div>
                        </motion.div>
                    </div>
                ) : (
                    // Uncollapsed state - full widgets
                    <div className="flex flex-col sm:flex-row gap-2 px-4">
                        {/* Disk Space Widget - Uncollapsed */}
                        <motion.div
                            className="flex-1 bg-white bg-opacity-5 rounded-lg border border-gray-600 p-3 flex flex-col min-w-0"
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: 0.1 }}
                        >
                            <div className="flex justify-between mb-2">
                                <div className="flex items-center gap-2 mb-2">
                                    <StorageIcon
                                        className={`text-xl ${isLowSpace ? 'text-red-500' : 'text-green-500'}`}
                                    />
                                    <Typography variant="caption" color="textSecondary" className="font-medium">
                                        USBeeTV Speicherplatz
                                    </Typography>
                                </div>
                                <div className="flex items-center gap-1">
                                    <LibraryScanButton isVisible={true} />
                                    <IconButton
                                        size="small"
                                        onClick={handleDiskClick}
                                        className="ml-auto"
                                        sx={{
                                            color: 'text.secondary',
                                            '&:hover': {
                                                backgroundColor: 'rgba(255, 255, 255, 0.08)'
                                            }
                                        }}
                                    >
                                        <ExpandMoreIcon
                                            sx={{
                                                transform: isCollapsed ? 'rotate(180deg)' : 'rotate(0deg)',
                                                transition: 'transform 0.2s ease-in-out'
                                            }}
                                        />
                                    </IconButton>
                                </div>
                            </div>
                            <ProgressBar
                                value={usePercent}
                                maxValue={100}
                                color={isLowSpace ? 'error' : 'success'}
                                height={8}
                                showValue={false}
                                animated={true}
                            />
                            <Box className="flex justify-between items-center mt-2">
                                <Typography variant="body2" color="textSecondary">
                                    {diskInfo?.available || 'N/A'} verfügbar
                                </Typography>
                                <Typography variant="body2" color="textSecondary" className="font-medium">
                                    {usePercent}%
                                </Typography>
                            </Box>
                        </motion.div>

                        {/* PayPal Pool Widget - Uncollapsed */}
                        <motion.div
                            className="flex-1 bg-white bg-opacity-5 rounded-lg border border-gray-600 p-3 flex flex-col min-w-0 cursor-pointer"
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: 0.2 }}
                            onClick={handlePayPalClick}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                        >
                            <div className="flex justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <img
                                        src="/euro4ssd.svg"
                                        alt="Euro4SSD"
                                        className="w-16 h-16"
                                    />
                                    <Typography variant="caption" color="textSecondary" className="font-medium">
                                        Hilf mit, mehr Speicherplatz zu kaufen!
                                    </Typography>
                                </div>
                                <IconButton
                                    size="small"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        e.preventDefault()
                                        handleDiskClick()
                                    }}
                                    className="ml-auto"
                                    sx={{
                                        color: 'text.secondary',
                                        '&:hover': {
                                            backgroundColor: 'rgba(255, 255, 255, 0.08)'
                                        }
                                    }}
                                >
                                    <ExpandMoreIcon
                                        sx={{
                                            transform: isCollapsed ? 'rotate(180deg)' : 'rotate(0deg)',
                                            transition: 'transform 0.2s ease-in-out'
                                        }}
                                    />
                                </IconButton>
                            </div>
                            <ProgressBar
                                value={progressPercent}
                                maxValue={100}
                                color="paypal"
                                height={8}
                                showValue={false}
                                animated={true}
                            />
                            <Box className="flex justify-between items-center mt-2">
                                <Typography variant="body2" color="textSecondary">
                                    {formatCurrency(poolInfo?.currentAmount || 0)} / {formatCurrency(poolInfo?.targetAmount || 0)}
                                </Typography>
                                <Typography variant="body2" color="textSecondary" className="font-medium">
                                    {progressPercent.toFixed(1)}%
                                </Typography>
                            </Box>
                            <Box className="flex justify-between mt-2 pt-2 border-t border-gray-200">
                                <Typography variant="caption" color="textSecondary">
                                    {poolInfo?.contributors || 0} Beiträge
                                </Typography>
                                <Typography variant="caption" color="textSecondary">
                                    Stand: {poolInfo?.lastUpdated ? formatDate(poolInfo.lastUpdated) : 'N/A'}
                                </Typography>
                            </Box>
                        </motion.div>
                    </div>
                )}
            </motion.div>
        </AnimatePresence>
    )
} 