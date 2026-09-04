import { createHmac, timingSafeEqual } from 'node:crypto'

const TOKEN_PURPOSE = 'usbeetv-pool-edit'

function safeEqual(a, b) {
    const bufA = Buffer.from(String(a))
    const bufB = Buffer.from(String(b))
    if (bufA.length !== bufB.length) return false
    return timingSafeEqual(bufA, bufB)
}

export function isPoolEditPasswordValid(password) {
    const expected = process.env.POOL_EDIT_PASSWORD
    if (!expected || !password) return false
    return safeEqual(password, expected)
}

/** Opaque token derived from the configured password; changes when the password does. */
export function createPoolEditToken() {
    return createHmac('sha256', process.env.POOL_EDIT_PASSWORD).update(TOKEN_PURPOSE).digest('hex')
}

export function isPoolEditTokenValid(token) {
    if (!process.env.POOL_EDIT_PASSWORD || !token) return false
    return safeEqual(token, createPoolEditToken())
}
