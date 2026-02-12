export async function authenticateDeluge() {
    const response = await fetch(`http://${process.env.DELUGE_HOST}:${process.env.DELUGE_PORT}/json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: 'auth.login', params: [process.env.DELUGE_PASSWORD], id: 1 })
    })
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    const data = await response.json()
    if (!data.result) throw new Error('Authentication failed — check DELUGE_PASSWORD')
    const sessionId = response.headers.get("set-cookie") ?? response.headers.getSetCookie?.()?.join('; ')
    if (!sessionId) throw new Error('Authentication succeeded but no session cookie returned')
    return sessionId
}
