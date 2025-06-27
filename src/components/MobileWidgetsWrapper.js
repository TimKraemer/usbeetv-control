'use client'

import { MobileWidgets } from './MobileWidgets'

export const MobileWidgetsWrapper = ({
    diskInfo,
    poolInfo,
    hasSearchResults = false,
    diskError,
    poolError,
    diskLoading,
    poolLoading
}) => {
    return (
        <MobileWidgets
            diskInfo={diskInfo}
            poolInfo={poolInfo}
            hasSearchResults={hasSearchResults}
            diskError={diskError}
            poolError={poolError}
            diskLoading={diskLoading}
            poolLoading={poolLoading}
        />
    )
} 