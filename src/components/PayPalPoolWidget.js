'use client'

import { PAYPAL_CONFIG } from '@/constants/app'
import { Box, Card, CardActionArea, CardContent, LinearProgress, Typography } from '@mui/material'
import { useCallback, useEffect, useState } from 'react'

export const PayPalPoolWidget = () => {
    const [poolInfo, setPoolInfo] = useState(null)
    const [error, setError] = useState(null)
    const [loading, setLoading] = useState(true)

    const fetchPoolStatus = useCallback(async () => {
        try {
            setLoading(true)
            const response = await fetch('/api/paypal-pool-status')
            if (!response.ok) {
                throw new Error('Failed to fetch pool status')
            }
            const data = await response.json()
            setPoolInfo(data)
            setLoading(false)
            setError(null)
        } catch (error) {
            console.error('Error fetching pool status:', error)
            setError('Failed to load pool status')
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchPoolStatus()

        // Refresh pool status every 5 minutes
        const intervalId = setInterval(() => {
            fetchPoolStatus()
        }, 300000)

        return () => clearInterval(intervalId)
    }, [fetchPoolStatus])

    const handleClick = () => {
        window.open(PAYPAL_CONFIG.POOL_URL, '_blank')
    }

    if (error) {
        return (
            <Card className="w-full h-full flex flex-col flex-1 cursor-pointer hover:shadow-lg transition-shadow" onClick={handleClick}>
                <CardContent className="flex-1">
                    <Typography variant="body2" color="error">
                        {error}
                    </Typography>
                </CardContent>
            </Card>
        )
    }

    if (loading) {
        return (
            <Card className="w-full h-full flex flex-col flex-1 cursor-pointer hover:shadow-lg transition-shadow" onClick={handleClick}>
                <CardContent className="flex-1">
                    <Typography variant="body2" color="textSecondary">
                        Loading pool status...
                    </Typography>
                </CardContent>
            </Card>
        )
    }

    if (!poolInfo) {
        return null
    }

    const progressPercent = (poolInfo.currentAmount / poolInfo.targetAmount) * 100
    const remainingAmount = poolInfo.targetAmount - poolInfo.currentAmount

    return (
        <Card
            className="w-full h-full flex flex-col flex-1"
        >
            <CardActionArea onClick={handleClick}>
                <CardContent className="pb-4 flex-1 flex flex-col">
                    <Typography variant="caption" color="textSecondary" className="block mb-2">
                        PayPal Pool: neue SSD
                    </Typography>

                    <Box className="mb-2">
                        <LinearProgress
                            variant="determinate"
                            value={progressPercent}
                            className="h-2 rounded"
                            sx={{
                                '& .MuiLinearProgress-bar': {
                                    backgroundColor: '#0070ba' // PayPal blue
                                }
                            }}
                        />
                    </Box>

                    <Box className="flex justify-between items-center mb-2">
                        <Typography variant="body2" color="textSecondary">
                            €{poolInfo.currentAmount.toFixed(2)} / €{poolInfo.targetAmount.toFixed(2)}
                        </Typography>
                        <Typography
                            variant="body2"
                            color="textSecondary"
                            className="font-medium"
                        >
                            {progressPercent.toFixed(1)}%
                        </Typography>
                    </Box>

                    <Box className="flex justify-between items-center text-xs text-gray-600">
                        <Typography variant="caption" color="textSecondary">
                            Noch benötigt: €{remainingAmount.toFixed(2)}
                        </Typography>
                    </Box>

                    <Box className="flex justify-between mt-2 pt-2 border-t border-gray-200 mt-auto">
                        <Typography variant="caption" color="textSecondary">
                            {poolInfo.contributors} Beiträge
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                            Stand: {poolInfo.lastUpdated ? new Date(poolInfo.lastUpdated).toLocaleString('de-DE', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                            }) : 'N/A'}
                        </Typography>
                    </Box>
                </CardContent>
            </CardActionArea>
        </Card>
    )
} 