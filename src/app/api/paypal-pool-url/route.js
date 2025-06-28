export async function GET() {
    try {
        const poolUrl = process.env.PAYPAL_POOL_URL || "__PAYPAL_POOL_URL_NOT_SET__"

        return Response.json({
            url: poolUrl
        })
    } catch (error) {
        return Response.json({
            error: 'Failed to get PayPal pool URL'
        }, { status: 500 })
    }
} 