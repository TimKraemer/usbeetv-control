# USBee TV Control

A Next.js application for managing movie and TV show downloads to USBee TV, with automatic Jellyfin library scanning.

## Features

- **Search & Download**: Search for movies and TV shows using TMDB API
- **Automatic Library Scanning**: Automatically triggers Jellyfin library scans when downloads complete
- **Manual Library Scanning**: Manual trigger for Jellyfin library scans via UI
- **Progress Tracking**: Real-time download progress monitoring
- **Multi-language Support**: German and English interface
- **Disk Space Monitoring**: Real-time storage space monitoring
- **PayPal Pool Integration**: Track contribution progress for new SSD

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Environment Variables

Create a `.env.local` file with the following variables:

```env
# Torrent Syndikat API
TS_API_URL=
TS_API_BACKUP_URL=
TS_API_KEY=

# TMDB API
TMDB_API_KEY=

# Deluge Configuration
DELUGE_HOST=
DELUGE_PORT="8112"
DELUGE_PASSWORD=

# Download Paths
MOVIE_DOWNLOAD_PATH=
TV_DOWNLOAD_PATH=

# Jellyfin Configuration
JELLYFIN_API_KEY=
JELLYFIN_HOST=
JELLYFIN_PORT=

# Synology Configuration
SYNOLOGY_HOST="192.168.80.4"
SYNOLOGY_PORT="5001"
SYNOLOGY_USERNAME="tk"
SYNOLOGY_PASSWORD=
SYNOLOGY_VOLUME="volume_3"

# PayPal Pool Configuration
PAYPAL_POOL_URL="https://www.paypal.com/pool/9g4yQj1qn7"
PAYPAL_POOL_CURRENT_AMOUNT="125.50"
PAYPAL_POOL_TARGET_AMOUNT="500.00"
PAYPAL_POOL_CONTRIBUTORS="8"
PAYPAL_POOL_LAST_UPDATED="2025-06-27T15:30:00.000Z"
```

## Jellyfin Library Scanning

The application automatically triggers Jellyfin library scans when downloads complete. This ensures that newly downloaded content is immediately available in Jellyfin.

### Automatic Scanning
- Triggered automatically when a torrent download reaches 100% completion
- Scans all Jellyfin libraries to detect new content
- No user intervention required

### Manual Scanning
- Use the "Bibliothek scannen" button in the mobile widgets section
- Useful for forcing a scan when automatic scanning fails
- Provides feedback on scan success/failure

## API Endpoints

- `/api/search` - Search for movies and TV shows
- `/api/download` - Download torrents
- `/api/progress` - Get download progress (triggers auto-scan on completion)
- `/api/library/scan` - Manual library scan trigger
- `/api/library/movies` - Check if movie exists in Jellyfin
- `/api/library/tvshows` - Check if TV show exists in Jellyfin
- `/api/disk-space` - Get storage information
- `/api/paypal-pool-status` - Get PayPal pool status

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
