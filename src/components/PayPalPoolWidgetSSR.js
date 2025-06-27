'use client'

import { ProgressBar } from '@/components/ui/ProgressBar'
import { WidgetCard } from '@/components/ui/WidgetCard'
import { PAYPAL_CONFIG } from '@/constants/app'
import { usePolling } from '@/hooks/usePolling'
import { formatCurrency, formatDate } from '@/utils/formatters'
import { Box, Typography } from '@mui/material'
import { motion } from 'framer-motion'

const fetchPoolStatus = async () => {
    const response = await fetch('/api/paypal-pool-status')
    if (!response.ok) {
        throw new Error('Failed to fetch pool status')
    }
    return response.json()
}

export const PayPalPoolWidgetSSR = ({ initialData }) => {
    const { data: poolInfo, error, loading } = usePolling({
        fetchFunction: fetchPoolStatus,
        interval: 300000, // 5 minutes
        enabled: initialData && !initialData.error,
        initialData
    })

    const handleClick = () => {
        window.open(PAYPAL_CONFIG.POOL_URL, '_blank')
    }

    if (!poolInfo) return null

    const progressPercent = (poolInfo.currentAmount / poolInfo.targetAmount) * 100
    const remainingAmount = poolInfo.targetAmount - poolInfo.currentAmount

    return (
        <WidgetCard
            loading={loading && !poolInfo}
            error={!!error || !!poolInfo?.error}
            onClick={handleClick}
            hover={true}
        >
            <Box className="flex items-center gap-2 mb-3">
                <motion.div
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.3 }}
                    whileHover={{ scale: 1.1 }}
                >
                    <img
                        src="/euro4ssd.svg"
                        alt="Euro4SSD"
                        className="w-6 h-6"
                    />
                </motion.div>
                <Typography variant="caption" color="textSecondary" className="font-medium">
                    PayPal Pool: neue SSD
                </Typography>
            </Box>

            <ProgressBar
                value={progressPercent}
                maxValue={100}
                color="paypal"
                height={8}
                showValue={false}
                animated={true}
            />

            <Box className="flex justify-between items-center mb-2">
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                >
                    <Typography variant="body2" color="textSecondary">
                        {formatCurrency(poolInfo.currentAmount)} / {formatCurrency(poolInfo.targetAmount)}
                    </Typography>
                </motion.div>
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                >
                    <Typography
                        variant="body2"
                        color="textSecondary"
                        className="font-medium"
                    >
                        {progressPercent.toFixed(1)}%
                    </Typography>
                </motion.div>
            </Box>

            <Box className="flex justify-between items-center text-xs text-gray-600 mb-3">
                <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.6 }}
                >
                    <Typography variant="caption" color="textSecondary">
                        Noch benötigt: {formatCurrency(remainingAmount)}
                    </Typography>
                </motion.div>
            </Box>

            <Box className="flex justify-between mt-2 pt-2 border-t border-gray-200 mt-auto">
                <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.8 }}
                >
                    <Typography variant="caption" color="textSecondary">
                        {poolInfo.contributors} Beiträge
                    </Typography>
                </motion.div>
                <motion.div
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 1.0 }}
                >
                    <Typography variant="caption" color="textSecondary">
                        Stand: {poolInfo.lastUpdated ? formatDate(poolInfo.lastUpdated) : 'N/A'}
                    </Typography>
                </motion.div>
            </Box>
        </WidgetCard>
    )
} 