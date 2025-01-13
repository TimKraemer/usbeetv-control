'use client'
import { Alert, Button, Dialog, DialogActions, DialogContent } from "@mui/material"
import { useEffect, useState } from 'react'
import Providers from './Providers'

export const DownloadDialog = ({ open, onClose, futureRelease, result, type }) => {
    const [providers, setProviders] = useState(null)

    useEffect(() => {
        if (!futureRelease && open) {
            const fetchProviders = async () => {
                try {
                    const response = await fetch(`/api/providers?movie_id=${result.id}`)
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`)
                    }
                    const data = await response.json()
                    setProviders(data.providers)
                } catch (error) {
                    console.error('Error fetching providers:', error)
                }
            }

            fetchProviders()
        }
    }, [futureRelease, open, result.id])

    return (
        <Dialog open={open} onClose={onClose}>
            <DialogContent>
                {futureRelease ? (
                    <Alert severity="info">
                        Das kommt erst im {new Date(type === 'movie' ? result.release_date : result.first_air_date).toLocaleString('de-DE', { month: 'long' })} {new Date(type === 'movie' ? result.release_date : result.first_air_date).getFullYear()} raus. Versuch es dann nochmal!
                    </Alert>
                ) : (
                    <>
                        <Alert severity="warning">
                            Es wurde leider kein geeigneter Download gefunden. Versuch's in ein paar Tagen nochmal oder frag' Tim, ob er es finden kann.
                        </Alert>
                        {providers && <Providers providers={providers} />}
                    </>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} color="primary">OK</Button>
            </DialogActions>
        </Dialog>
    )
}
