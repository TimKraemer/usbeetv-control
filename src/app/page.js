'use client'

import SearchIcon from '@mui/icons-material/Search'
import { Alert, Button, Card, CardActionArea, CardContent, CardMedia, CircularProgress, Dialog, DialogActions, DialogContent, IconButton, InputAdornment, Menu, MenuItem, TextField, Typography } from '@mui/material'
import CssBaseline from '@mui/material/CssBaseline'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import { useCallback, useEffect, useState } from 'react'
import Flag from 'react-flagkit'

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
  },
})

const useFutureRelease = (result, type) => {
  const [futureRelease, setFutureRelease] = useState(false)

  useEffect(() => {
    const releaseDate = new Date(type === 'movie' ? result.release_date : result.first_air_date)
    const currentDate = new Date()
    if (releaseDate > currentDate) {
      setFutureRelease(true)
    }
  }, [result, type])

  return futureRelease
}

const DownloadDialog = ({ open, onClose, futureRelease, result, type }) => (
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

const ResultCard = ({ result, type }) => {
  const [open, setOpen] = useState(false)
  const futureRelease = useFutureRelease(result, type)

  const handleCardClick = async () => {
    try {
      const response = await fetch(`/api/download?tmdbId=${result.id}&type=${type}`)

      const data = await response.json()
      if (data.error) {
        setOpen(true)
      } else {
        console.log(data)
      }
    } catch (error) {
      console.error('Error fetching download:', error)
    }
  }

  return (
    <>
      <DownloadDialog open={open} onClose={() => setOpen(false)} futureRelease={futureRelease} result={result} type={type} />
      <Card key={result.id} className="rounded-lg min-w-[200px] aspect-square">
        <CardActionArea onClick={handleCardClick}>
          <CardMedia
            component="img"
            className="h-[30vh] !object-contain object-top"
            image={`https://image.tmdb.org/t/p/w500${result.poster_path}`}
            alt={`${type === 'movie' ? result.title : result.name} Poster`}
          />
          <CardContent className="flex flex-row gap-2">
            <Typography variant="body2" color="textSecondary">
              {new Date(type === 'movie' ? result.release_date : result.first_air_date).getFullYear() || '????'}
            </Typography>
            <Typography variant="h8">
              {type === 'movie'
                ? (result.title === result.original_title ? result.title : `${result.title} / ${result.original_title}`)
                : (result.name === result.original_name ? result.name : `${result.name} / ${result.original_name}`)}
            </Typography>
          </CardContent>
        </CardActionArea>
      </Card>
    </>
  )
}

const ResultsSection = ({ title, results, type }) => (
  <div className="flex-1 overflow-hidden">
    <Typography variant="h5" className="mb-4">{title}</Typography>
    <div className="flex overflow-x-auto gap-4 h-full">
      {results?.results?.map((result) => (
        <ResultCard key={result.id} result={result} type={type} />
      ))}
    </div>
  </div>
)

export default function Home() {
  const [searchString, setSearchString] = useState('')
  const [movieResults, setMovieResults] = useState([])
  const [tvResults, setTvResults] = useState([])
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [language, setLanguage] = useState('en-US')
  const [anchorEl, setAnchorEl] = useState(null)

  const fetchData = useCallback(async (query) => {
    setLoading(true)
    try {
      const responses = await Promise.all([
        fetch(`/api/search?searchstring=${query}&type=movie&language=${language}`),
        fetch(`/api/search?searchstring=${query}&type=tv&language=${language}`)
      ])
      const [movieData, tvData] = await Promise.all(responses.map(res => res.json()))

      setMovieResults(movieData.tmdbResults)
      setTvResults(tvData.tmdbResults)
    } catch (error) {
      setError('Failed to fetch data')
    } finally {
      setLoading(false)
    }
  }, [language])

  useEffect(() => {
    const trimmedSearchString = searchString.trim().replace(/[^a-zA-Z0-9äöüÄÖÜß ]/g, '')
    if (trimmedSearchString.length >= 3) {
      fetchData(trimmedSearchString)
    }
  }, [searchString, fetchData])

  const handleSearch = () => {
    fetchData(searchString)
  }

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget)
  }

  const handleMenuClose = () => {
    setAnchorEl(null)
  }

  const handleLanguageChange = (lang) => {
    setLanguage(lang)
    handleMenuClose()
  }

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <div className="min-h-screen p-4 sm:p-20 font-[family-name:var(--font-geist-sans)]">
        <main className="flex flex-col gap-4 items-center sm:items-start h-screen">
          <div className="flex gap-4 w-full sm:w-auto">
            <TextField
              label="Film oder Serie"
              variant="outlined"
              value={searchString}
              onChange={(e) => setSearchString(e.target.value)}
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={handleSearch}>
                        <SearchIcon />
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
              className="w-full sm:w-auto"
            />
            <Button onClick={handleMenuOpen} variant="outlined">
              <Flag country={language === 'en-US' ? 'US' : language === 'de-DE' ? 'DE' : 'FR'} />
            </Button>
            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleMenuClose}
            >
              <MenuItem onClick={() => handleLanguageChange('en-US')}>
                <Flag country="US" />
              </MenuItem>
              <MenuItem onClick={() => handleLanguageChange('de-DE')}>
                <Flag country="DE" />
              </MenuItem>
            </Menu>
          </div>
          {error && <p className="text-red-500">{error}</p>}
          {loading ? (
            <CircularProgress />
          ) : searchString.length < 3 ? (
            <div className="flex flex-col gap-4 w-full h-full">
              <p className="text-gray-500">Um dem USBee TV einen Film oder eine Serie hinzuzufügen, suche ihn zunächst mit der Suchbox und tippe dann auf den gewünschten Titel.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4 w-full h-full">
              <ResultsSection title="Filme" results={movieResults} type="movie" />
              <ResultsSection title="Serien" results={tvResults} type="tv" />
            </div>
          )}
        </main>
      </div>
    </ThemeProvider>
  )
}
