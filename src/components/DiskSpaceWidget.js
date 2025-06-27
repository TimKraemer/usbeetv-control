'use client'

import { Box, Card, CardContent, LinearProgress, Typography } from '@mui/material'
import { useCallback, useEffect, useState } from 'react'

export const DiskSpaceWidget = () => {
    const [diskInfo, setDiskInfo] = useState(null)
    const [error, setError] = useState(null)

    const fetchDiskSpace = useCallback(async () => {
        try {
            const response = await fetch('/api/disk-space')
            if (!response.ok) {
                throw new Error('Failed to fetch disk space')
            }
            const data = await response.json()
            setDiskInfo(data)
            setError(null)
        } catch (error) {
            console.error('Error fetching disk space:', error)
            setError('Failed to load disk space')
        }
    }, [])

    useEffect(() => {
        fetchDiskSpace()

        // Refresh disk space every 30 seconds
        const intervalId = setInterval(() => {
            fetchDiskSpace()
        }, 30000)

        return () => clearInterval(intervalId)
    }, [fetchDiskSpace])

    if (error) {
        return (
            <Card className="w-full max-w-sm">
                <CardContent>
                    <Typography variant="body2" color="error">
                        {error}
                    </Typography>
                </CardContent>
            </Card>
        )
    }

    if (!diskInfo) {
        return (
            <Card className="w-full max-w-sm">
                <CardContent>
                    <Typography variant="body2" color="textSecondary">
                        Loading disk space...
                    </Typography>
                </CardContent>
            </Card>
        )
    }

    const usePercent = Number.parseInt(diskInfo.usePercent.replace('%', ''))
    const isLowSpace = usePercent > 80

    return (
        <Card className="w-full max-w-sm">
            <CardContent className="pb-4">
                {diskInfo.path && (
                    <Typography variant="caption" color="textSecondary" className="block mb-2">
                        USBeeTV Speicherplatz
                    </Typography>
                )}
                <Box className="mb-2">
                    <LinearProgress
                        variant="determinate"
                        value={usePercent}
                        className={`h-2 rounded ${isLowSpace ? 'bg-red-200' : ''}`}
                        sx={{
                            '& .MuiLinearProgress-bar': {
                                backgroundColor: isLowSpace ? '#ef4444' : '#10b981'
                            }
                        }}
                    />
                </Box>
                <Box className="flex justify-between items-center">
                    <Typography variant="body2" color="textSecondary">
                        noch frei: {diskInfo.available}
                    </Typography>
                    <Typography
                        variant="body2"
                        color={isLowSpace ? 'error' : 'textSecondary'}
                        className="font-medium"
                    >
                        {usePercent}% used
                    </Typography>
                </Box>
            </CardContent>
        </Card>
    )
} 