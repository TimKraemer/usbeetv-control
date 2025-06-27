'use client'

import { DownloadStateProvider } from '@/hooks/useDownloadState'
import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter'
import CssBaseline from '@mui/material/CssBaseline'
import { ThemeProvider, createTheme } from '@mui/material/styles'

// Create theme outside component to prevent recreation on every render
const darkTheme = createTheme({
    palette: {
        mode: 'dark',
    },
})

export default function ClientWrapper({ children }) {
    return (
        <AppRouterCacheProvider>
            <ThemeProvider theme={darkTheme}>
                <CssBaseline />
                <DownloadStateProvider>
                    <div className="bg-black min-h-screen">
                        <div className="max-w-[1200px] mx-auto">
                            <main className="flex flex-col gap-6 sm:gap-8">
                                {children}
                            </main>
                        </div>
                    </div>
                </DownloadStateProvider>
            </ThemeProvider>
        </AppRouterCacheProvider>
    )
} 