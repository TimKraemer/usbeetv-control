import { NextResponse } from 'next/server'
import { createPoolEditToken, isPoolEditPasswordValid } from '@/app/lib/poolEditAuth'

/** Exchange the pool editor password for a session token (never exposes the password). */
export async function POST(request) {
    try {
        if (!process.env.POOL_EDIT_PASSWORD) {
            return NextResponse.json({ error: 'Pool editor password not configured' }, { status: 500 })
        }

        const body = await request.json().catch(() => ({}))
        const password = typeof body?.password === 'string' ? body.password : ''

        if (!isPoolEditPasswordValid(password)) {
            return NextResponse.json({ error: 'Incorrect password' }, { status: 401 })
        }

        return NextResponse.json({ ok: true, token: createPoolEditToken() })
    } catch (error) {
        return NextResponse.json({ error: `Authentication failed: ${error.message}` }, { status: 500 })
    }
}
