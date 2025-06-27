'use client'

import SearchIcon from '@mui/icons-material/Search'
import { Button, IconButton, InputAdornment, Menu, MenuItem, TextField } from '@mui/material'
import { useState } from 'react'
import Flag from 'react-flagkit'

// Constants moved inline to prevent import issues
const LANGUAGE_OPTIONS = [
    { code: 'en-US', country: 'US', label: 'English' },
    { code: 'de-DE', country: 'DE', label: 'Deutsch' }
]

export const SearchBar = ({
    searchString,
    onSearchChange,
    onSearch,
    language,
    onLanguageChange,
    disabled = false,
    isClient = true
}) => {
    const [anchorEl, setAnchorEl] = useState(null)

    const handleMenuOpen = (event) => {
        setAnchorEl(event.currentTarget)
    }

    const handleMenuClose = () => {
        setAnchorEl(null)
    }

    const handleLanguageSelect = (lang) => {
        onLanguageChange(lang)
        handleMenuClose()
    }

    const handleKeyPress = (event) => {
        if (event.key === 'Enter') {
            onSearch()
        }
    }

    const currentLanguage = LANGUAGE_OPTIONS.find(lang => lang.code === language)

    // Show loading state until client is hydrated
    if (!isClient) {
        return (
            <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex flex-col sm:flex-row gap-4 w-full">
                    <div className="flex w-full gap-4">
                        <TextField
                            label="Film oder Serie"
                            variant="outlined"
                            disabled={true}
                            className="flex-1"
                        />
                        <Button
                            variant="outlined"
                            className="flex-none"
                            disabled={true}
                        >
                            <Flag country="US" />
                        </Button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row gap-4 w-full">
                <div className="flex w-full gap-4">
                    <TextField
                        label="Film oder Serie"
                        variant="outlined"
                        value={searchString}
                        onChange={(e) => onSearchChange(e.target.value)}
                        onKeyPress={handleKeyPress}
                        disabled={disabled}
                        slotProps={{
                            input: {
                                'aria-label': 'Search for movies or TV shows',
                                endAdornment: (
                                    <InputAdornment position="end">
                                        <IconButton
                                            onClick={onSearch}
                                            disabled={disabled}
                                            aria-label="Search"
                                        >
                                            <SearchIcon />
                                        </IconButton>
                                    </InputAdornment>
                                ),
                            },
                        }}
                        className="flex-1"
                    />
                    <Button
                        onClick={handleMenuOpen}
                        variant="outlined"
                        className="flex-none"
                        disabled={disabled}
                        aria-label={`Current language: ${currentLanguage?.label}`}
                    >
                        <Flag country={currentLanguage?.country || 'US'} />
                    </Button>
                </div>
                <Menu
                    anchorEl={anchorEl}
                    open={Boolean(anchorEl)}
                    onClose={handleMenuClose}
                >
                    {LANGUAGE_OPTIONS.map((lang) => (
                        <MenuItem
                            key={lang.code}
                            onClick={() => handleLanguageSelect(lang.code)}
                            selected={language === lang.code}
                        >
                            <Flag country={lang.country} />
                            <span className="ml-2">{lang.label}</span>
                        </MenuItem>
                    ))}
                </Menu>
            </div>
        </div>
    )
} 