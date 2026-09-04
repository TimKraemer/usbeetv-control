const DELUGE_AUTH_TIMEOUT_MS = 15000
// Deluge's web session lives for an hour by default; re-login well before that
const SESSION_TTL_MS = 10 * 60 * 1000

let cachedSession = null // { sessionId, expiresAt }
let inflightLogin = null

function getDelugeUrl() {
    if (!process.env.DELUGE_HOST || !process.env.DELUGE_PORT) {
        throw new Error('DELUGE_HOST / DELUGE_PORT environment variables are not set')
    }
    return `http://${process.env.DELUGE_HOST}:${process.env.DELUGE_PORT}/json`
}

/** Extract "name=value" from the Set-Cookie header(s); attributes are not sent back. */
function extractSessionCookie(response) {
    const cookies = response.headers.getSetCookie?.() ?? []
    const raw = cookies.length > 0 ? cookies : [response.headers.get('set-cookie')].filter(Boolean)
    for (const cookie of raw) {
        const pair = cookie.split(';')[0]?.trim()
        if (pair?.includes('=')) return pair
    }
    return null
}

async function login() {
    const response = await fetch(getDelugeUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: 'auth.login', params: [process.env.DELUGE_PASSWORD], id: 1 }),
        signal: AbortSignal.timeout(DELUGE_AUTH_TIMEOUT_MS),
    })
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    const data = await response.json()
    if (!data.result) throw new Error('Authentication failed — check DELUGE_PASSWORD')
    const sessionId = extractSessionCookie(response)
    if (!sessionId) throw new Error('Authentication succeeded but no session cookie returned')
    return sessionId
}

/** Drop the cached session (e.g. after Deluge reported "Not authenticated"). */
export function invalidateDelugeSession() {
    cachedSession = null
}

/**
 * Returns a valid Deluge web session cookie. Sessions are cached so the
 * progress polling and schedulers don't log in on every single request.
 */
export async function authenticateDeluge({ force = false } = {}) {
    if (!force && cachedSession && cachedSession.expiresAt > Date.now()) {
        return cachedSession.sessionId
    }
    if (inflightLogin) return inflightLogin

    inflightLogin = login()
        .then(sessionId => {
            cachedSession = { sessionId, expiresAt: Date.now() + SESSION_TTL_MS }
            return sessionId
        })
        .finally(() => {
            inflightLogin = null
        })
    return inflightLogin
}
