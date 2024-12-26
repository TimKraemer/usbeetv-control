'use client'

import { ResultCard } from '@/components/ResultCard'
import SearchIcon from '@mui/icons-material/Search'
import { Button, CircularProgress, IconButton, InputAdornment, Menu, MenuItem, TextField, Typography } from '@mui/material'
import CssBaseline from '@mui/material/CssBaseline'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import { useCallback, useEffect, useState } from 'react'
import Flag from 'react-flagkit'

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
  },
})

const ResultsSection = ({ title, results, type }) => (
  <div className="flex-1 overflow-hidden flex flex-col items-stretch">
    <Typography variant="h5" className="mb-4">{title}</Typography>
    <div className="flex overflow-x-auto gap-4 h-full flex-1">
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
      <div className="p-4 sm:p-10 font-[family-name:var(--font-geist-sans)] min-h-screen flex flex-col">
        <main className="flex flex-col gap-4 items-center sm:items-start w-full flex-1">
          <div className="flex flex-col sm:flex-row gap-4 w-full">
            <div className="flex w-full gap-4">
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
                className="flex-1"
              />
              <Button onClick={handleMenuOpen} variant="outlined" className="flex-none">
                <Flag country={language === 'en-US' ? 'US' : language === 'de-DE' ? 'DE' : 'FR'} />
              </Button>
            </div>
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
            <div className="flex flex-col gap-4 w-full">
              <p className="text-gray-500">Um dem USBee TV einen Film oder eine Serie hinzuzufügen, suche ihn zunächst mit der Suchbox und tippe dann auf den gewünschten Titel.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4 w-full h-full flex-1 items-stretch">
              <ResultsSection title="Filme" results={movieResults} type="movie" />
              <ResultsSection title="Serien" results={tvResults} type="tv" />
            </div>
          )}
        </main>
      </div>
    </ThemeProvider>
  )
}
