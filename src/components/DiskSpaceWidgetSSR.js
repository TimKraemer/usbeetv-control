'use client'

import { ProgressBar } from '@/components/ui/ProgressBar'
import { WidgetCard } from '@/components/ui/WidgetCard'
import { usePolling } from '@/hooks/usePolling'
import { formatBytes } from '@/utils/formatters'
import StorageIcon from '@mui/icons-material/Storage'
import { Box, Typography } from '@mui/material'
import { motion } from 'framer-motion'

const fetchDiskSpace = async () => {
    const response = await fetch('/api/disk-space')
    if (!response.ok) {
        throw new Error('Failed to fetch disk space')
    }
    return response.json()
}

export const DiskSpaceWidgetSSR = ({ initialData }) => {
    const { data: diskInfo, error, loading } = usePolling({
        fetchFunction: fetchDiskSpace,
        interval: 30000,
        enabled: initialData && !initialData.error,
        initialData
    })

    const usePercent = (typeof diskInfo?.usePercent === 'string' && diskInfo.usePercent.includes('%'))
        ? Number.parseInt(diskInfo.usePercent.replace('%', ''))
        : 0
    const isLowSpace = usePercent > 80

    return (
        <WidgetCard
            loading={loading && !diskInfo}
            error={!!error || !!diskInfo?.error}
            hover={false}
        >
            <Box className="flex items-center gap-2 mb-3">
                <StorageIcon
                    className={`text-2xl ${isLowSpace ? 'text-red-500' : 'text-green-500'}`}
                />
                <Typography variant="caption" color="textSecondary" className="font-medium">
                    USBeeTV Speicherplatz
                </Typography>
            </Box>

            <ProgressBar
                value={usePercent}
                maxValue={100}
                color={isLowSpace ? 'error' : 'success'}
                height={8}
                showValue={false}
                animated={true}
            />

            <Box className="flex justify-between items-center mt-auto">
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 }}
                >
                    <Typography variant="body2" color="textSecondary">
                        noch frei: {diskInfo?.available || 'N/A'}
                    </Typography>
                </motion.div>
                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 }}
                >
                    <Typography
                        variant="body2"
                        color={isLowSpace ? 'error' : 'textSecondary'}
                        className="font-medium"
                    >
                        {usePercent}% used
                    </Typography>
                </motion.div>
            </Box>
        </WidgetCard>
    )
} 