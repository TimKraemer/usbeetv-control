export async function register() {
    if (process.env.NEXT_RUNTIME !== 'nodejs') return
    // Dev-mode reloads can call register() again in the same process; keep one set of timers
    if (globalThis.__usbeetvSchedulersStarted) return
    globalThis.__usbeetvSchedulersStarted = true

    const intervalMinutes = Number.parseInt(process.env.SUBSCRIPTION_CHECK_INTERVAL_MINUTES || '30', 10)
    if (intervalMinutes > 0) {
        const { checkAllSubscriptions } = await import('@/app/lib/subscriptionChecker')

        const runCheck = async () => {
            try {
                await checkAllSubscriptions()
            } catch (error) {
                console.error('[Subscriptions] Scheduled check failed:', error.message)
            }
        }

        console.log(`[Subscriptions] Scheduler started (every ${intervalMinutes} min)`)
        // First check shortly after startup, then on the configured interval
        setTimeout(runCheck, 30 * 1000)
        setInterval(runCheck, intervalMinutes * 60 * 1000)
    } else {
        console.log('[Subscriptions] Scheduler disabled (SUBSCRIPTION_CHECK_INTERVAL_MINUTES <= 0)')
    }

    const watchIntervalSeconds = Number.parseInt(process.env.DOWNLOAD_WATCH_INTERVAL_SECONDS || '60', 10)
    if (watchIntervalSeconds > 0) {
        const { watchPendingDownloads } = await import('@/app/lib/downloadWatcher')

        const runWatch = async () => {
            try {
                await watchPendingDownloads()
            } catch (error) {
                console.error('[DownloadWatch] Scheduled check failed:', error.message)
            }
        }

        console.log(`[DownloadWatch] Scheduler started (every ${watchIntervalSeconds}s)`)
        setTimeout(runWatch, 15 * 1000)
        setInterval(runWatch, watchIntervalSeconds * 1000)
    } else {
        console.log('[DownloadWatch] Scheduler disabled (DOWNLOAD_WATCH_INTERVAL_SECONDS <= 0)')
    }

    // Build the watch ranking once after startup so the first visitor does not wait for it
    setTimeout(async () => {
        try {
            const { getWatchRanking } = await import('@/app/lib/jellyfinApi')
            await getWatchRanking()
            console.log('[WatchRanking] Initial ranking built')
        } catch (error) {
            console.warn('[WatchRanking] Initial build failed:', error.message)
        }
    }, 45 * 1000)
}
