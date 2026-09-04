import { delugeRpc } from '@/app/lib/delugeTorrent'

/** Make sure the Deluge web UI is connected to a daemon. */
export async function connectToWebUI(sessionId) {
    const connected = await delugeRpc(sessionId, 'web.connected', [])
    if (connected) return

    const hosts = await delugeRpc(sessionId, 'web.get_hosts', [])
    if (!hosts || hosts.length === 0) {
        throw new Error('No available hosts to connect to Deluge')
    }

    // Connect to the first host; web.connect returns the list of available
    // methods on success and null on failure
    const hostId = hosts[0][0]
    const result = await delugeRpc(sessionId, 'web.connect', [hostId])
    if (!result) {
        throw new Error('Failed to connect to Deluge host')
    }
}
