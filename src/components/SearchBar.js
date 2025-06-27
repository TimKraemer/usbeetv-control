'use client'

import ClearIcon from '@mui/icons-material/Clear'
import LanguageIcon from '@mui/icons-material/Language'
import SearchIcon from '@mui/icons-material/Search'
import { Button, IconButton, InputAdornment, Menu, MenuItem, TextField } from '@mui/material'
import { AnimatePresence, motion } from 'framer-motion'
import { memo, useEffect, useRef, useState } from 'react'
import Flag from 'react-flagkit'

// Constants moved inline to prevent import issues
const LANGUAGE_OPTIONS = [
    { code: 'en-US', country: 'US', label: 'English' },
    { code: 'de-DE', country: 'DE', label: 'Deutsch' }
]

export const SearchBar = memo(({
    searchString,
    onSearchChange,
    onSearch,
    language,
    onLanguageChange,
    isClient = true
}) => {
    const [anchorEl, setAnchorEl] = useState(null)
    const inputRef = useRef(null)
    const wasFocusedRef = useRef(false)

    // Preserve focus across re-renders
    useEffect(() => {
        if (wasFocusedRef.current && inputRef.current) {
            // Small delay to ensure the DOM has updated
            const timeoutId = setTimeout(() => {
                if (inputRef.current) {
                    inputRef.current.focus()
                }
            }, 0)
            return () => clearTimeout(timeoutId)
        }
    })

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

    const handleClear = () => {
        onSearchChange('')
        // Maintain focus after clearing
        if (inputRef.current) {
            inputRef.current.focus()
        }
    }

    const handleInputFocus = () => {
        wasFocusedRef.current = true
    }

    const handleInputBlur = () => {
        wasFocusedRef.current = false
    }

    const currentLanguage = LANGUAGE_OPTIONS.find(lang => lang.code === language)

    return (
        <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="w-full max-w-2xl mx-auto px-4"
        >
            <div className="flex items-center bg-white bg-opacity-5 rounded-lg border border-gray-600 overflow-hidden">
                {/* Search Input */}
                <div className="flex-1">
                    <TextField
                        ref={inputRef}
                        fullWidth
                        value={searchString}
                        onChange={(e) => onSearchChange(e.target.value)}
                        onKeyPress={handleKeyPress}
                        onFocus={handleInputFocus}
                        onBlur={handleInputBlur}
                        placeholder="Suche nach Filmen und Serien..."
                        variant="standard"
                        size="large"
                        className="bg-transparent"
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start" className="pl-6">
                                    <motion.div
                                        animate={{ rotate: searchString ? 360 : 0 }}
                                        transition={{ duration: 0.3 }}
                                    >
                                        <SearchIcon className="text-gray-400" />
                                    </motion.div>
                                </InputAdornment>
                            ),
                            endAdornment: (
                                <InputAdornment position="end">
                                    <AnimatePresence>
                                        {searchString && (
                                            <motion.div
                                                initial={{ opacity: 0, scale: 0 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0 }}
                                                transition={{ duration: 0.2 }}
                                            >
                                                <IconButton
                                                    size="small"
                                                    onClick={handleClear}
                                                    className="text-gray-400 hover:text-white"
                                                >
                                                    <ClearIcon fontSize="small" />
                                                </IconButton>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </InputAdornment>
                            ),
                            sx: {
                                '& .MuiInput-root': {
                                    '&:before': {
                                        borderBottom: 'none',
                                    },
                                    '&:after': {
                                        borderBottom: 'none',
                                    },
                                    '&:hover:not(.Mui-disabled):before': {
                                        borderBottom: 'none',
                                    },
                                },
                                '& .MuiInput-input': {
                                    padding: '16px 0',
                                    color: 'white',
                                    '&::placeholder': {
                                        color: 'rgba(255, 255, 255, 0.6)',
                                        opacity: 1,
                                    },
                                },
                            }
                        }}
                    />
                </div>

                {/* Language Switch - Square Button */}
                <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="border-l border-gray-600"
                >
                    <Button
                        variant="text"
                        onClick={handleMenuOpen}
                        className="min-w-0 w-12 h-12 p-0 text-gray-300 hover:text-white hover:bg-white hover:bg-opacity-10 rounded-none"
                        sx={{
                            borderRadius: 0,
                            '&:hover': {
                                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                            }
                        }}
                    >
                        <Flag country={currentLanguage?.country} size={20} />
                    </Button>
                </motion.div>
            </div>

            <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleMenuClose}
                className="mt-2"
            >
                {LANGUAGE_OPTIONS.map((lang) => (
                    <MenuItem
                        key={lang.code}
                        onClick={() => handleLanguageSelect(lang.code)}
                        selected={lang.code === language}
                        className="flex items-center gap-3"
                    >
                        <Flag country={lang.country} size={20} />
                        <span>{lang.label}</span>
                    </MenuItem>
                ))}
            </Menu>
        </motion.div>
    )
})

SearchBar.displayName = 'SearchBar' 