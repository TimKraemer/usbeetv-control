'use client'

import { useEffect, useState } from 'react'

export const useClientLanguage = () => {
    const [language, setLanguage] = useState('en-US')
    const [isClient, setIsClient] = useState(false)

    useEffect(() => {
        setIsClient(true)
        // Get browser language on client side
        const browserLang = navigator.language || navigator.userLanguage
        if (browserLang.startsWith('de')) {
            setLanguage('de-DE')
        } else {
            setLanguage('en-US')
        }
    }, [])

    return { language, setLanguage, isClient }
} 