import fs from 'node:fs/promises'
import path from 'node:path'
import { NextResponse } from 'next/server'

export async function POST(request) {
    try {
        const body = await request.json()
        const { currentAmount, targetAmount, contributors, lastUpdated } = body

        // Validate input
        if (typeof currentAmount !== 'number' || currentAmount < 0) {
            return NextResponse.json({ error: 'Invalid current amount' }, { status: 400 })
        }
        if (typeof targetAmount !== 'number' || targetAmount <= 0) {
            return NextResponse.json({ error: 'Invalid target amount' }, { status: 400 })
        }
        if (typeof contributors !== 'number' || contributors < 0) {
            return NextResponse.json({ error: 'Invalid contributors count' }, { status: 400 })
        }
        if (!lastUpdated || Number.isNaN(new Date(lastUpdated).getTime())) {
            return NextResponse.json({ error: 'Invalid last updated date' }, { status: 400 })
        }

        // Update environment variables
        const envPath = path.join(process.cwd(), '.env')

        try {
            let envContent = await fs.readFile(envPath, 'utf8')

            // Update or add the pool variables
            const updates = {
                'PAYPAL_POOL_CURRENT_AMOUNT': currentAmount.toFixed(2),
                'PAYPAL_POOL_TARGET_AMOUNT': targetAmount.toFixed(2),
                'PAYPAL_POOL_CONTRIBUTORS': contributors.toString(),
                'PAYPAL_POOL_LAST_UPDATED': lastUpdated
            }

            for (const [key, value] of Object.entries(updates)) {
                const regex = new RegExp(`^${key}=.*$`, 'm')
                if (regex.test(envContent)) {
                    envContent = envContent.replace(regex, `${key}="${value}"`)
                } else {
                    envContent += `\n${key}="${value}"`
                }
            }

            await fs.writeFile(envPath, envContent, 'utf8')

            return NextResponse.json({
                success: true,
                message: 'Pool data updated successfully',
                data: {
                    currentAmount,
                    targetAmount,
                    contributors,
                    lastUpdated
                }
            })
        } catch (fileError) {
            console.error('Error updating .env.local file:', fileError)
            return NextResponse.json({
                error: 'Failed to update environment file'
            }, { status: 500 })
        }

    } catch (error) {
        console.error('Error in pool-edit API:', error)
        return NextResponse.json({
            error: 'Internal server error'
        }, { status: 500 })
    }
} 