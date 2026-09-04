import { Agent, fetch as undiciFetch } from 'undici'

const SYNOLOGY_TIMEOUT_MS = 8000
// DSM error codes that mean "log in again"
const SESSION_ERROR_CODES = new Set([105, 106, 107, 119])

// The NAS uses a self-signed certificate; only this agent skips verification
const synologyAgent = new Agent({
    connect: { rejectUnauthorized: false },
})

class SynologyAPI {
    constructor() {
        this.baseUrl = `https://${process.env.SYNOLOGY_HOST}:${process.env.SYNOLOGY_PORT}`
        this.sessionId = null
    }

    async request(path, params) {
        const url = new URL(`${this.baseUrl}${path}`)
        for (const [key, value] of Object.entries(params)) {
            url.searchParams.set(key, value)
        }
        const response = await undiciFetch(url, {
            method: 'GET',
            headers: { Accept: 'application/json' },
            signal: AbortSignal.timeout(SYNOLOGY_TIMEOUT_MS),
            dispatcher: synologyAgent,
        })
        if (!response.ok) {
            throw new Error(`Request failed: ${response.status} ${response.statusText}`)
        }
        return response.json()
    }

    async authenticate() {
        try {
            const data = await this.request('/webapi/auth.cgi', {
                api: 'SYNO.API.Auth',
                version: '3',
                method: 'login',
                account: process.env.SYNOLOGY_USERNAME,
                passwd: process.env.SYNOLOGY_PASSWORD,
                session: 'FileStation',
                format: 'sid'
            })

            if (data.success !== true) {
                const errorCode = data.error?.code
                const errorMsg = data.error?.errors?.[0] || 'Unknown error'
                throw new Error(`Authentication failed (${errorCode}): ${errorMsg}`)
            }

            this.sessionId = data.data.sid
            return this.sessionId
        } catch (error) {
            this.sessionId = null
            throw new Error(`Synology authentication error: ${error.message}`)
        }
    }

    async getStorageInfo() {
        try {
            if (!this.sessionId) {
                await this.authenticate()
            }

            let data = await this.request('/webapi/entry.cgi', {
                api: 'SYNO.Storage.CGI.Storage',
                version: '1',
                method: 'load_info',
                _sid: this.sessionId
            })

            // Session expired or was revoked: log in once more and retry
            if (data.success !== true && SESSION_ERROR_CODES.has(data.error?.code)) {
                await this.authenticate()
                data = await this.request('/webapi/entry.cgi', {
                    api: 'SYNO.Storage.CGI.Storage',
                    version: '1',
                    method: 'load_info',
                    _sid: this.sessionId
                })
            }

            if (data.success !== true) {
                const errorCode = data.error?.code
                const errorMsg = data.error?.errors?.[0] || 'Unknown error'
                throw new Error(`Storage info failed (${errorCode}): ${errorMsg}`)
            }

            return data.data
        } catch (error) {
            throw new Error(`Synology storage info error: ${error.message}`)
        }
    }

    async getVolumeInfo(volumeName) {
        try {
            const storageData = await this.getStorageInfo()

            // Find the specific volume by name or description
            const volume = storageData.volumes?.find(vol =>
                vol.id === volumeName ||
                vol.vol_desc === volumeName ||
                vol.vol_path === volumeName
            )

            if (!volume) {
                // If not found by exact match, try to find by partial match in vol_desc
                const partialMatch = storageData.volumes?.find(vol =>
                    vol.vol_desc?.toLowerCase().includes(volumeName.toLowerCase())
                )

                if (partialMatch) {
                    return this.formatVolumeInfo(partialMatch)
                }

                throw new Error(`Volume "${volumeName}" not found. Available volumes: ${storageData.volumes?.map(v => v.vol_desc || v.id).join(', ')}`)
            }

            return this.formatVolumeInfo(volume)
        } catch (error) {
            throw new Error(`Volume info error: ${error.message}`)
        }
    }

    formatVolumeInfo(volume) {
        const totalSize = Number.parseInt(volume.size.total)
        const usedSize = Number.parseInt(volume.size.used)
        const availableSize = totalSize - usedSize
        const usePercent = totalSize > 0 ? Math.round((usedSize / totalSize) * 100) : 0

        return {
            filesystem: volume.id,
            size: this.formatBytes(totalSize),
            used: this.formatBytes(usedSize),
            available: this.formatBytes(availableSize),
            usePercent: `${usePercent}%`,
            mounted: volume.vol_path || '/',
            path: volume.vol_desc || volume.id,
            totalBytes: totalSize,
            usedBytes: usedSize,
            availableBytes: availableSize,
            status: volume.status,
            spaceStatus: volume.space_status?.status
        }
    }

    formatBytes(bytes) {
        if (!bytes || bytes <= 0) return '0 B'
        const k = 1024
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
        const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1)
        return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`
    }
}

let sharedInstance = null

/** Process-wide instance so the DSM session is reused between polls. */
export function getSynologyApi() {
    if (!sharedInstance) sharedInstance = new SynologyAPI()
    return sharedInstance
}

export default SynologyAPI
