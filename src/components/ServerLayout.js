import SynologyAPI from '@/app/lib/synologyApi'
import ClientWrapper from '@/components/ClientWrapper'
import { DiskSpaceWidgetSSR } from '@/components/DiskSpaceWidgetSSR'
import { PayPalPoolWidgetSSR } from '@/components/PayPalPoolWidgetSSR'

async function fetchDiskSpaceData() {
    try {
        if (!process.env.SYNOLOGY_HOST || !process.env.SYNOLOGY_USERNAME || !process.env.SYNOLOGY_PASSWORD) {
            return { error: 'Synology NAS configuration is missing' }
        }

        const synologyApi = new SynologyAPI()
        const volumeName = process.env.SYNOLOGY_VOLUME || 'volume_3'
        const diskInfo = await synologyApi.getVolumeInfo(volumeName)
        return diskInfo
    } catch (error) {
        console.error('Server-side disk space fetch error:', error)
        return { error: `Failed to get disk space: ${error.message}` }
    }
}

async function fetchPayPalPoolData() {
    try {
        return {
            currentAmount: Number.parseFloat(process.env.PAYPAL_POOL_CURRENT_AMOUNT || '125.50'),
            targetAmount: Number.parseFloat(process.env.PAYPAL_POOL_TARGET_AMOUNT || '500.00'),
            contributors: Number.parseInt(process.env.PAYPAL_POOL_CONTRIBUTORS || '8'),
            lastUpdated: process.env.PAYPAL_POOL_LAST_UPDATED || new Date().toISOString(),
            source: 'env'
        }
    } catch (error) {
        console.error('Server-side PayPal pool fetch error:', error)
        return {
            currentAmount: 125.50,
            targetAmount: 500.00,
            contributors: 8,
            lastUpdated: new Date().toISOString(),
            source: 'fallback'
        }
    }
}

export default async function ServerLayout({ children }) {
    // Fetch data server-side in parallel
    const [diskSpaceData, paypalPoolData] = await Promise.all([
        fetchDiskSpaceData(),
        fetchPayPalPoolData()
    ])

    return (
        <ClientWrapper>
            {/* Header with Disk Space Widget and PayPal Pool Widget */}
            <div className="flex flex-col sm:flex-row justify-center sm:justify-start items-stretch">
                <div className="m-2 flex-1 h-full flex flex-col">
                    <DiskSpaceWidgetSSR initialData={diskSpaceData} />
                </div>
                <div className="m-2 flex-1 h-full flex flex-col">
                    <PayPalPoolWidgetSSR initialData={paypalPoolData} />
                </div>
            </div>

            {children}
        </ClientWrapper>
    )
} 