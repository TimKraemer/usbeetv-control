'use client'
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    CircularProgress,
    Grid,
    TextField,
    Typography
} from '@mui/material'
import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'

export default function PoolEditPage() {
    const [poolData, setPoolData] = useState({
        currentAmount: '',
        targetAmount: '',
        contributors: '',
        lastUpdated: ''
    })
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState(null)
    const [success, setSuccess] = useState(false)
    const [authenticated, setAuthenticated] = useState(false)
    const [password, setPassword] = useState('')
    const [passwordError, setPasswordError] = useState(false)
    const [correctPassword, setCorrectPassword] = useState('')
    const [passwordLoading, setPasswordLoading] = useState(true)

    useEffect(() => {
        const initializePage = async () => {
            // Check if already authenticated (stored in sessionStorage)
            const isAuth = sessionStorage.getItem('pool-edit-authenticated')
            if (isAuth === 'true') {
                setAuthenticated(true)
                setPasswordLoading(false)
                await fetchPoolData()
            } else {
                await fetchPassword()
            }
        }

        initializePage()
    }, [])

    const fetchPassword = async () => {
        try {
            const response = await fetch('/api/pool-edit/auth')
            if (!response.ok) {
                throw new Error('Failed to fetch password')
            }
            const data = await response.json()
            setCorrectPassword(data.password)
        } catch (error) {
            setError(`Failed to load authentication: ${error.message}`)
        } finally {
            setPasswordLoading(false)
            setLoading(false)
        }
    }

    const handlePasswordSubmit = (e) => {
        e.preventDefault()
        if (password === correctPassword) {
            setAuthenticated(true)
            sessionStorage.setItem('pool-edit-authenticated', 'true')
            setPasswordError(false)
            fetchPoolData()
        } else {
            setPasswordError(true)
            setPassword('')
        }
    }

    const fetchPoolData = async () => {
        setLoading(true)
        try {
            const response = await fetch('/api/paypal-pool-status')
            if (!response.ok) {
                throw new Error('Failed to fetch pool data')
            }
            const data = await response.json()

            // Always use current date/time in user's local timezone
            const now = new Date()
            const year = now.getFullYear()
            const month = String(now.getMonth() + 1).padStart(2, '0')
            const day = String(now.getDate()).padStart(2, '0')
            const hours = String(now.getHours()).padStart(2, '0')
            const minutes = String(now.getMinutes()).padStart(2, '0')
            const currentDateTime = `${year}-${month}-${day}T${hours}:${minutes}`

            setPoolData({
                currentAmount: data.currentAmount || '',
                targetAmount: data.targetAmount || '',
                contributors: data.contributors || '',
                lastUpdated: currentDateTime
            })
        } catch (error) {
            setError(`Failed to load pool data: ${error.message}`)
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setSaving(true)
        setError(null)
        setSuccess(false)

        try {
            const response = await fetch('/api/pool-edit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    currentAmount: Number.parseFloat(poolData.currentAmount),
                    targetAmount: Number.parseFloat(poolData.targetAmount),
                    contributors: Number.parseInt(poolData.contributors),
                    lastUpdated: new Date(poolData.lastUpdated).toISOString()
                })
            })

            if (!response.ok) {
                throw new Error('Failed to update pool data')
            }

            setSuccess(true)
            setTimeout(() => setSuccess(false), 3000)
        } catch (error) {
            setError(`Failed to update pool data: ${error.message}`)
        } finally {
            setSaving(false)
        }
    }

    const handleInputChange = (field, value) => {
        setPoolData(prev => ({
            ...prev,
            [field]: value
        }))
    }

    if (loading || passwordLoading) {
        return (
            <Box className="min-h-screen bg-gray-900 flex items-center justify-center">
                <CircularProgress />
            </Box>
        )
    }

    if (!authenticated) {
        return (
            <Box className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    <Card className="bg-gray-800 text-white max-w-md w-full">
                        <CardContent className="p-6">
                            <Typography variant="h5" className="text-white mb-6 text-center">
                                Pool Editor Access
                            </Typography>

                            <form onSubmit={handlePasswordSubmit}>
                                <TextField
                                    fullWidth
                                    label="Password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="mb-4"
                                    error={passwordError}
                                    helperText={passwordError ? "Incorrect password" : ""}
                                    InputProps={{
                                        className: 'text-white'
                                    }}
                                    InputLabelProps={{
                                        className: 'text-gray-300'
                                    }}
                                />

                                <Button
                                    type="submit"
                                    variant="contained"
                                    fullWidth
                                    className="bg-blue-600 hover:bg-blue-700"
                                >
                                    Access Pool Editor
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                </motion.div>
            </Box>
        )
    }

    return (
        <Box className="min-h-screen bg-gray-900 p-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
            >
                <Box className="max-w-2xl mx-auto">
                    <Typography variant="h4" className="text-white mb-8 text-center">
                        PayPal Pool Data Editor
                    </Typography>

                    <Card className="bg-gray-800 text-white">
                        <CardContent className="p-6">
                            <form onSubmit={handleSubmit}>
                                <Grid container spacing={3}>
                                    <Grid item xs={12} sm={6}>
                                        <TextField
                                            fullWidth
                                            label="Current Amount (€)"
                                            type="number"
                                            step="0.01"
                                            value={poolData.currentAmount}
                                            onChange={(e) => handleInputChange('currentAmount', e.target.value)}
                                            className="text-white"
                                            InputProps={{
                                                className: 'text-white'
                                            }}
                                            InputLabelProps={{
                                                className: 'text-gray-300'
                                            }}
                                        />
                                    </Grid>

                                    <Grid item xs={12} sm={6}>
                                        <TextField
                                            fullWidth
                                            label="Target Amount (€)"
                                            type="number"
                                            step="0.01"
                                            value={poolData.targetAmount}
                                            onChange={(e) => handleInputChange('targetAmount', e.target.value)}
                                            className="text-white"
                                            InputProps={{
                                                className: 'text-white'
                                            }}
                                            InputLabelProps={{
                                                className: 'text-gray-300'
                                            }}
                                        />
                                    </Grid>

                                    <Grid item xs={12} sm={6}>
                                        <TextField
                                            fullWidth
                                            label="Number of Contributors"
                                            type="number"
                                            value={poolData.contributors}
                                            onChange={(e) => handleInputChange('contributors', e.target.value)}
                                            className="text-white"
                                            InputProps={{
                                                className: 'text-white'
                                            }}
                                            InputLabelProps={{
                                                className: 'text-gray-300'
                                            }}
                                        />
                                    </Grid>

                                    <Grid item xs={12} sm={6}>
                                        <TextField
                                            fullWidth
                                            label="Last Updated"
                                            type="datetime-local"
                                            value={poolData.lastUpdated}
                                            onChange={(e) => handleInputChange('lastUpdated', e.target.value)}
                                            className="text-white"
                                            InputProps={{
                                                className: 'text-white'
                                            }}
                                            InputLabelProps={{
                                                className: 'text-gray-300'
                                            }}
                                        />
                                    </Grid>
                                </Grid>

                                {error && (
                                    <Alert severity="error" className="mt-4">
                                        {error}
                                    </Alert>
                                )}

                                {success && (
                                    <Alert severity="success" className="mt-4">
                                        Pool data updated successfully!
                                    </Alert>
                                )}

                                <Box className="mt-6 flex justify-center">
                                    <Button
                                        type="submit"
                                        variant="contained"
                                        disabled={saving}
                                        className="bg-blue-600 hover:bg-blue-700 px-8 py-3"
                                    >
                                        {saving ? (
                                            <>
                                                <CircularProgress size={20} className="mr-2" />
                                                Updating...
                                            </>
                                        ) : (
                                            'Update Pool Data'
                                        )}
                                    </Button>
                                </Box>
                            </form>
                        </CardContent>
                    </Card>

                    <Box className="mt-6 text-center">
                        <Typography variant="body2" className="text-gray-400">
                            This page allows you to manually update the PayPal pool data.
                            <br />
                            Changes will be reflected immediately in the main application.
                        </Typography>
                    </Box>
                </Box>
            </motion.div>
        </Box>
    )
} 