'use client'

import { Box, Typography } from '@mui/material'
import { AnimatePresence, motion } from 'framer-motion'

export const JellyfinNotice = ({ isCollapsed = false }) => {
    return (
        <AnimatePresence>
            {!isCollapsed && (
                <motion.div
                    initial={{ opacity: 0, y: 20, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                    exit={{ opacity: 0, y: -20, height: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="px-4 sm:px-6 lg:px-8"
                >
                    <Box className="bg-blue-500 bg-opacity-10 border border-blue-500 border-opacity-30 rounded-lg p-3 text-center">
                        <Typography variant="body2" className="text-blue-300">
                            Jellyfin ist unter Port <strong>8920</strong> erreichbar -{' '}
                            <a
                                href="https://usbeetv.tk22.de:8920/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-400 hover:text-blue-300 underline transition-colors duration-200"
                            >
                                Direktlink
                            </a>
                        </Typography>
                    </Box>
                </motion.div>
            )}
        </AnimatePresence>
    )
} 