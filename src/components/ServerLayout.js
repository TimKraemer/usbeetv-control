import ClientWrapper from '@/components/ClientWrapper'

export default async function ServerLayout({ children }) {
    return (
        <ClientWrapper>
            {children}
        </ClientWrapper>
    )
} 