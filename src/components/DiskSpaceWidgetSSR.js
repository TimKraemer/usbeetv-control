'use client'

import { Box, Card, CardContent, LinearProgress, Typography } from '@mui/material'
import { useCallback, useEffect, useState } from 'react'

export const DiskSpaceWidgetSSR = ({ initialData }) => {
    const [diskInfo, setDiskInfo] = useState(initialData)
    const [error, setError] = useState(initialData?.error || null)

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
        // Only start polling if we have valid initial data
        if (!error && diskInfo && !diskInfo.error) {
            // Refresh disk space every 30 seconds
            const intervalId = setInterval(() => {
                fetchDiskSpace()
            }, 30000)

            return () => clearInterval(intervalId)
        }
    }, [fetchDiskSpace, error, diskInfo])

    if (error || (diskInfo?.error)) {
        return (
            <Card className="w-full h-full flex flex-col flex-1">
                <CardContent className="flex-1">
                    <Typography variant="body2" color="error">
                        {error || diskInfo?.error}
                    </Typography>
                </CardContent>
            </Card>
        )
    }

    if (!diskInfo) {
        return (
            <Card className="w-full h-full flex flex-col flex-1">
                <CardContent className="flex-1">
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
        <Card className="w-full h-full flex flex-col flex-1">
            <CardContent className="pb-4 flex-1 flex flex-col">
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
                <Box className="flex justify-between items-center mt-auto">
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