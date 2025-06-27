import { ClientPageWrapper } from '@/components/ClientPageWrapper'
import ServerLayout from '@/components/ServerLayout'

export default function Page() {
  return (
    <ServerLayout>
      <ClientPageWrapper />
    </ServerLayout>
  )
}
