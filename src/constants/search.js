export const SEARCH_CONFIG = {
    MIN_SEARCH_LENGTH: 3,
    DEBOUNCE_DELAY: 300,
    ALLOWED_CHARS_REGEX: /[^a-zA-Z0-9äöüÄÖÜß ]/g
}

export const LANGUAGE_OPTIONS = [
    { code: 'en-US', country: 'US', label: 'English' },
    { code: 'de-DE', country: 'DE', label: 'Deutsch' }
]

export const SEARCH_TYPES = {
    MOVIE: 'movie',
    TV: 'tv'
}

export const ERROR_MESSAGES = {
    FETCH_FAILED: 'Failed to fetch data. Please try again.',
    SEARCH_FAILED: 'Failed to fetch search results.',
    NETWORK_ERROR: 'Network error. Please check your connection.'
} 