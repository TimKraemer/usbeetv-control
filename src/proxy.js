import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'

/** HTTP basic auth for the whole app; off unless APP_BASIC_AUTH="user:password" is set. */
export function proxy(request) {
    const expected = process.env.APP_BASIC_AUTH
    if (!expected) return NextResponse.next()

    const header = request.headers.get('authorization') || ''
    const given = Buffer.from(header.replace(/^Basic\s+/i, ''), 'base64')
    const wanted = Buffer.from(expected)
    if (given.length === wanted.length && timingSafeEqual(given, wanted)) {
        return NextResponse.next()
    }

    return new NextResponse('Authentication required', {
        status: 401,
        headers: { 'WWW-Authenticate': 'Basic realm="USBee TV Control", charset="UTF-8"' },
    })
}

export const config = {
    // Icons, manifest and build assets stay public so the browser can load them without credentials
    matcher: ['/((?!_next/static|_next/image|.*\\.(?:png|ico|svg|json|webmanifest|txt)$).*)'],
}
