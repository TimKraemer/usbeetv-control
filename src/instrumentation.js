export async function register() {
    if (process.env.NEXT_RUNTIME !== 'nodejs') return

    const intervalMinutes = Number.parseInt(process.env.SUBSCRIPTION_CHECK_INTERVAL_MINUTES || '30', 10)
    if (!intervalMinutes || intervalMinutes <= 0) {
        console.log('[Subscriptions] Scheduler disabled (SUBSCRIPTION_CHECK_INTERVAL_MINUTES <= 0)')
        return
    }

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
}
