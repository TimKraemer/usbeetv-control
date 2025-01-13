export async function connectToWebUI(sessionId) {
    // Check if the Deluge WebUI is connected
    const connectionResponse = await fetch(`http://${process.env.DELUGE_HOST}:${process.env.DELUGE_PORT}/json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': sessionId },
        body: JSON.stringify({ method: 'web.connected', params: [], id: 2 })
    })
    const connectionResult = await connectionResponse.json()

    if (!connectionResult.result) {
        // Get available hosts
        const hostsResponse = await fetch(`http://${process.env.DELUGE_HOST}:${process.env.DELUGE_PORT}/json`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': sessionId },
            body: JSON.stringify({ method: 'web.get_hosts', params: [], id: 3 })
        })
        const hostsResult = await hostsResponse.json()
        const hosts = hostsResult.result

        if (hosts.length === 0) {
            throw new Error('No available hosts to connect to Deluge')
        }

        // Connect to the first host
        const hostId = hosts[0][0]
        const connectResponse = await fetch(`http://${process.env.DELUGE_HOST}:${process.env.DELUGE_PORT}/json`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': sessionId },
            body: JSON.stringify({ method: 'web.connect', params: [hostId], id: 4 })
        })
        const connectResult = await connectResponse.json()

        if (!connectResult.result) {
            throw new Error('Failed to connect to Deluge host')
        }
    }
}
