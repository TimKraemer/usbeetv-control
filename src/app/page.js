import { MobileWidgetsContainer } from '@/components/MobileWidgetsContainer'
import SearchContainer from '@/components/SearchContainer'
import ServerLayout from '@/components/ServerLayout'

export default function Page() {
  return (
    <ServerLayout>
      <MobileWidgetsContainer />
      <SearchContainer />
    </ServerLayout>
  )
}
