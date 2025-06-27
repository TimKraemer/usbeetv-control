// Search Configuration
export const SEARCH_CONFIG = {
    MIN_SEARCH_LENGTH: 3,
    DEBOUNCE_DELAY: 300,
}

// Search Types
export const SEARCH_TYPES = {
    MOVIE: 'movie',
    TV: 'tv'
}

// Error Messages
export const ERROR_MESSAGES = {
    FETCH_FAILED: 'Failed to fetch data. Please try again.',
    SEARCH_FAILED: 'Failed to fetch search results.',
    NETWORK_ERROR: 'Network error. Please check your connection.',
    DISK_SPACE_ERROR: 'Failed to load disk space',
    POOL_STATUS_ERROR: 'Failed to load pool status'
}

// Language Options
export const LANGUAGE_OPTIONS = [
    { code: 'en-US', country: 'US', label: 'English' },
    { code: 'de-DE', country: 'DE', label: 'Deutsch' }
]

// Polling Intervals (in milliseconds)
export const POLLING_INTERVALS = {
    DISK_SPACE: 30000, // 30 seconds
    PAYPAL_POOL: 300000, // 5 minutes
    DOWNLOAD_PROGRESS: 5000, // 5 seconds
}

// API Endpoints
export const API_ENDPOINTS = {
    SEARCH: '/api/search',
    DISK_SPACE: '/api/disk-space',
    PAYPAL_POOL_STATUS: '/api/paypal-pool-status',
    DOWNLOAD: '/api/download',
    PROGRESS: '/api/progress',
    PROVIDERS: '/api/providers',
    LIBRARY_MOVIES: '/api/library/movies',
    LIBRARY_TVSHOWS: '/api/library/tvshows',
}

// UI Constants
export const UI_CONSTANTS = {
    CARD_MIN_WIDTH: 200,
    CARD_ASPECT_RATIO: 'aspect-square',
    ANIMATION_DURATION: 0.3,
    STAGGER_DELAY: 0.1,
}

// Colors
export const COLORS = {
    SUCCESS: '#10b981',
    WARNING: '#f59e0b',
    ERROR: '#ef4444',
    PAYPAL: '#0070ba',
    PRIMARY: '#3b82f6',
}

// PayPal Pool Configuration
export const PAYPAL_CONFIG = {
    POOL_URL: process.env.NEXT_PUBLIC_PAYPAL_POOL_URL || "__PAYPAL_POOL_URL_NOT_SET__",
}

// TMDB Configuration
export const TMDB_CONFIG = {
    IMAGE_BASE_URL: 'https://image.tmdb.org/t/p/w500',
    ORIGINAL_IMAGE_URL: 'https://media.themoviedb.org/t/p/original',
} 