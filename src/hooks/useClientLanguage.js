'use client'

import { useEffect, useState } from 'react'

export const useClientLanguage = () => {
    // Start with a default language that will be consistent on server and client
    const [language, setLanguage] = useState('en-US')
    const [isClient, setIsClient] = useState(false)

    useEffect(() => {
        // Only run this effect on the client after hydration
        setIsClient(true)

        // Get browser language on client side only after hydration is complete
        const browserLang = navigator.language || navigator.userLanguage
        if (browserLang.startsWith('de')) {
            setLanguage('de-DE')
        }
        // If it's already 'en-US', no need to change it
    }, [])

    return { language, setLanguage, isClient }
} 