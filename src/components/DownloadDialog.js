'use client'
import { Alert, Button, Dialog, DialogActions, DialogContent } from "@mui/material"


export const DownloadDialog = ({ open, onClose, futureRelease, result, type }) => (
    <Dialog open={open} onClose={onClose}>
        <DialogContent>
            {futureRelease ? (
                <Alert severity="info">
                    Das kommt erst im {new Date(type === 'movie' ? result.release_date : result.first_air_date).toLocaleString('de-DE', { month: 'long' })} {new Date(type === 'movie' ? result.release_date : result.first_air_date).getFullYear()} raus. Versuch es dann nochmal!
                </Alert>
            ) : (
                <Alert severity="warning">
                    Es wurde leider kein geeigneter Download gefunden. Versuch's in ein paar Tagen nochmal oder frag' Tim, ob er es finden kann.
                </Alert>
            )}
        </DialogContent>
        <DialogActions>
            <Button onClick={onClose} color="primary">OK</Button>
        </DialogActions>
    </Dialog>
)
