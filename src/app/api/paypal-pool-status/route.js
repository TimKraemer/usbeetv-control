import fs from 'node:fs/promises'
import path from 'node:path'
import { NextResponse } from 'next/server'

// Function to read .env file and parse specific variables
async function readEnvFile() {
    try {
        const envPath = path.join(process.cwd(), '.env')
        const envContent = await fs.readFile(envPath, 'utf8')

        const envVars = {}
        const lines = envContent.split('\n')

        for (const line of lines) {
            const trimmedLine = line.trim()
            if (trimmedLine && !trimmedLine.startsWith('#')) {
                const [key, ...valueParts] = trimmedLine.split('=')
                if (key && valueParts.length > 0) {
                    // Remove quotes from value
                    const value = valueParts.join('=').replace(/^["']|["']$/g, '')
                    envVars[key] = value
                }
            }
        }

        return envVars
    } catch (error) {
        console.error('Error reading .env file:', error)
        return {}
    }
}

export async function GET() {
    try {
        // Read environment variables directly from .env file
        const envVars = await readEnvFile()

        // Get pool data from environment variables
        const poolData = {
            currentAmount: Number.parseFloat(envVars.PAYPAL_POOL_CURRENT_AMOUNT || process.env.PAYPAL_POOL_CURRENT_AMOUNT || '125.50'),
            targetAmount: Number.parseFloat(envVars.PAYPAL_POOL_TARGET_AMOUNT || process.env.PAYPAL_POOL_TARGET_AMOUNT || '500.00'),
            contributors: Number.parseInt(envVars.PAYPAL_POOL_CONTRIBUTORS || process.env.PAYPAL_POOL_CONTRIBUTORS || '8'),
            lastUpdated: envVars.PAYPAL_POOL_LAST_UPDATED || process.env.PAYPAL_POOL_LAST_UPDATED || new Date().toISOString(),
            source: 'env-file'
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