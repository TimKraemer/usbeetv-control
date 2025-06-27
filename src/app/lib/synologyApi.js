import https from 'node:https'
import fetch from 'node-fetch'

const httpsAgent = new https.Agent({ rejectUnauthorized: false })

class SynologyAPI {
    constructor() {
        this.baseUrl = `https://${process.env.SYNOLOGY_HOST}:${process.env.SYNOLOGY_PORT}`
        this.sessionId = null
    }

    async authenticate() {
        try {
            const authUrl = `${this.baseUrl}/webapi/auth.cgi`
            const params = new URLSearchParams({
                api: 'SYNO.API.Auth',
                version: '3',
                method: 'login',
                account: process.env.SYNOLOGY_USERNAME,
                passwd: process.env.SYNOLOGY_PASSWORD,
                session: 'FileStation',
                format: 'sid'
            })

            const response = await fetch(`${authUrl}?${params}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                },
                agent: httpsAgent,
            })

            if (!response.ok) {
                throw new Error(`Authentication failed: ${response.status} ${response.statusText}`)
            }

            const data = await response.json()

            if (data.success !== true) {
                const errorCode = data.error?.code
                const errorMsg = data.error?.errors?.[0] || 'Unknown error'
                throw new Error(`Authentication failed (${errorCode}): ${errorMsg}`)
            }

            this.sessionId = data.data.sid
            return this.sessionId
        } catch (error) {
            throw new Error(`Synology authentication error: ${error.message}`)
        }
    }

    async getStorageInfo() {
        try {
            if (!this.sessionId) {
                await this.authenticate()
            }

            const storageUrl = `${this.baseUrl}/webapi/entry.cgi`
            const params = new URLSearchParams({
                api: 'SYNO.Storage.CGI.Storage',
                version: '1',
                method: 'load_info',
                _sid: this.sessionId
            })

            const response = await fetch(`${storageUrl}?${params}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                },
                agent: httpsAgent,
            })

            if (!response.ok) {
                throw new Error(`Storage info request failed: ${response.status} ${response.statusText}`)
            }

            const data = await response.json()

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
        // Calculate disk space information using the correct field names
        const totalSize = Number.parseInt(volume.size.total)
        const usedSize = Number.parseInt(volume.size.used)
        const availableSize = totalSize - usedSize
        const usePercent = Math.round((usedSize / totalSize) * 100)

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
        if (bytes === 0) return '0 B'
        const k = 1024
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`
    }
}

export default SynologyAPI 