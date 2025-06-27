'use client'

import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter'
import CssBaseline from '@mui/material/CssBaseline'
import { ThemeProvider, createTheme } from '@mui/material/styles'

// Create theme outside component to prevent recreation on every render
const darkTheme = createTheme({
    palette: {
        mode: 'dark',
    },
})

export default function ServerLayout({ children }) {
    return (
        <AppRouterCacheProvider>
            <ThemeProvider theme={darkTheme}>
                <CssBaseline />
                <div className="bg-gray-900 min-h-screen">
                    <div className="max-w-[1200px] mx-auto">
                        <main className="flex flex-col gap-6 sm:gap-8">
                            {children}
                        </main>
                    </div>
                </div>
            </ThemeProvider>
        </AppRouterCacheProvider>
    )
} 