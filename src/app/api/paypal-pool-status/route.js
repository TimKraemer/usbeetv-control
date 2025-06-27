import { NextResponse } from 'next/server'

export async function GET() {
    try {
        // Get pool data from environment variables
        const poolData = {
            currentAmount: Number.parseFloat(process.env.PAYPAL_POOL_CURRENT_AMOUNT || '125.50'),
            targetAmount: Number.parseFloat(process.env.PAYPAL_POOL_TARGET_AMOUNT || '500.00'),
            contributors: Number.parseInt(process.env.PAYPAL_POOL_CONTRIBUTORS || '8'),
            lastUpdated: process.env.PAYPAL_POOL_LAST_UPDATED || new Date().toISOString(),
            source: 'env'
        }

        return NextResponse.json(poolData)

    } catch (error) {
        console.error('Error in PayPal pool status API:', error)

        // Return fallback data if env vars are missing
        const fallbackData = {
            currentAmount: 125.50,
            targetAmount: 500.00,
            contributors: 8,
            lastUpdated: new Date().toISOString(),
            source: 'fallback'
        }

        return NextResponse.json(fallbackData)
    }
} 