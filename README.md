# zang

[zang](https://zang.gallery) is an onchain text NFT platform on Base.

## Tech Stack

- **Frontend**: React 18 + Vite
- **Wallet**: wagmi v2 + RainbowKit
- **Blockchain**: viem (Base network)
- **Styling**: Tailwind CSS
- **Database**: PostgreSQL (for caching immutable blockchain data)
- **Server**: Express.js + Socket.IO (real-time updates)

## Development

### Prerequisites

- Node.js 18+
- npm

### Setup

```bash
git clone https://github.com/zangGallery/frontend
cd frontend
npm install
```

### Environment Variables

Create a `.env` file:

```
VITE_ALCHEMY_BASE_API_KEY=your_alchemy_key
VITE_ALCHEMY_MAINNET_API_KEY=your_alchemy_key
DATABASE_URL=postgresql://user:pass@host:port/db  # Optional for local dev
```

### Running Locally

**Development (uses production build + Express server):**

```bash
npm run build
npm start
```

Server runs at http://localhost:3000

### Testing RPC Performance

Run the automated RPC call analysis:

```bash
node scripts/test-rpc.mjs
```

This uses Playwright to load pages and measure RPC calls, identifying any duplicates.

**Manual testing in browser:**

1. Open browser console
2. Run `rpcTracker.enable()` then refresh the page
3. Run `rpcTracker.summary()` to see call counts

## Deployment (Railway)

The app is deployed on Railway. The Express server (`server.cjs`) handles:
- Static file serving from `dist/`
- Server-side rendering of Open Graph tags for social sharing
- PostgreSQL database for caching (Railway Postgres plugin)
- WebSocket connections for real-time updates

### Required Environment Variables on Railway

```
VITE_ALCHEMY_BASE_API_KEY=your_alchemy_key    # For client-side RPC
VITE_ALCHEMY_MAINNET_API_KEY=your_alchemy_key # For ENS resolution
ALCHEMY_BASE_API_KEY=your_alchemy_key         # For server-side OG tags (optional, falls back to public RPC)
DATABASE_URL=postgresql://...                  # PostgreSQL connection string
```

### Deploy Commands (configured in railway.json)

- **Build**: `npm run build`
- **Start**: `node server.cjs`

## Project Structure

```
src/
  common/           # Shared utilities
    abi.js          # Contract ABIs
    ens.js          # ENS resolution
    prefetch.js     # Hover prefetch cache
    provider.js     # viem client setup
    socket.js       # WebSocket hooks
  components/       # React components
  pages/            # Page components (index, nft, mint, profile, etc.)
  styles/           # CSS/Tailwind styles
scripts/
  test-rpc.mjs      # Playwright RPC performance tests
server.cjs          # Express production server with DB caching
vite.config.js      # Vite configuration
```

## Database Caching Layer

The server uses PostgreSQL to cache immutable blockchain data, reducing RPC calls and improving load times by ~10x.

### What Gets Cached

| Data Type | Cache Strategy | Why |
|-----------|---------------|-----|
| NFT metadata (uri, author, name, content) | Permanent | Immutable after mint |
| Block timestamps | Permanent | Historical blocks never change |
| Contract events (transfers, listings, purchases) | Append-only sync | Events are immutable, new ones added |

### What's NOT Cached (Always Live RPC)

- `lastTokenId` - Changes with each mint
- `balanceOf` - Changes with transfers
- `totalSupply` - Changes with burns
- Active listings - Marketplace state changes
- ETH price - External API

### API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/nft/:id` | Cached NFT data (cache-through) |
| `GET /api/nfts/batch` | Batch fetch multiple NFTs |
| `GET /api/block/:number` | Cached block timestamp |
| `GET /api/events/:tokenId` | Token event history |
| `GET /api/activity` | Recent activity feed |
| `GET /api/stats` | Aggregate stats (NFT count, artists) |
| `GET /api/sync/status` | Current sync status |
| `POST /api/sync/force` | Force immediate sync |
| `POST /api/nft/:id/refresh` | Invalidate and re-fetch NFT |

### Data Integrity

- **Freshness metadata**: All responses include `_meta` with `lastSyncBlock`, `lastSyncTime`, `isSyncing`
- **Validation**: Addresses, URIs, and content sizes are validated before caching
- **Staleness indicators**: Frontend shows when data was last synced with color-coded status
- **Manual refresh**: Users can force-sync if data appears stale

### Background Sync

The server syncs new blockchain events every 30 seconds. On startup:
1. Tables are auto-created if missing
2. Initial event sync runs
3. NFT cache is pre-warmed
4. Block timestamps are pre-warmed

### WebSocket (Socket.IO)

Real-time updates are pushed to connected clients:
- `newEvents` - New blockchain events as they're synced
- `syncComplete` - Sync finished notification

## Performance Optimizations

### Hover Prefetching

Inspired by [McMaster-Carr's instant page loads](https://dev.to/svsharma/the-surprising-tech-behind-mcmaster-carrs-blazing-fast-website-speed-bfc), the app prefetches NFT data on hover:

1. **NFT Card Hover**: When hovering over an NFT card, `/api/nft/:id` is fetched in the background
2. **Instant Navigation**: By the time user clicks, data is already cached in memory
3. **Adjacent NFT Prefetch**: On NFT pages, prev/next NFTs are prefetched automatically

This creates a perception of instant page loads. See `src/common/prefetch.js` for implementation.

### Vite Configuration

The project uses several Vite plugins to handle complex dependencies:

- **vite-plugin-commonjs**: Converts CJS modules to ESM (required for @metamask packages)
- **vite-plugin-node-polyfills**: Provides Node.js polyfills for browser environment
- **Manual chunks**: Code splitting for optimal loading (react-vendor, web3-core, rainbowkit, md-editor)
