'use client'

import { JellyfinNotice } from '@/components/JellyfinNotice'
import { MobileWidgetsContainer } from '@/components/MobileWidgetsContainer'
import SearchContainer from '@/components/SearchContainer'
import { useState } from 'react'

export const ClientPageWrapper = () => {
    const [isCollapsed, setIsCollapsed] = useState(false)

    return (
        <>
            <MobileWidgetsContainer onCollapsedChange={setIsCollapsed} />
            <JellyfinNotice isCollapsed={isCollapsed} />
            <SearchContainer />
        </>
    )
} 