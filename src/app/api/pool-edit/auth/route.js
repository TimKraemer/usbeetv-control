import { NextResponse } from 'next/server'

export async function GET() {
    try {
        const password = process.env.POOL_EDIT_PASSWORD

        if (!password) {
            return NextResponse.json({
                error: 'Pool editor password not configured'
            }, { status: 500 })
        }

        return NextResponse.json({
            password: password
        })
    } catch (error) {
        return NextResponse.json({
            error: 'Failed to get password'
        }, { status: 500 })
    }
} 