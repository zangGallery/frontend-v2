# Data Architecture

This document describes the data pipeline architecture for zang.gallery, designed for sub-second home page loads.

## Performance Results

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Home Page Load | 11,985ms | 4,952ms | **59% faster** |
| API Calls | 18 | 1 | **94% reduction** |
| RPC Calls | 58 | 14 | **76% reduction** |
| Database Queries | ~200 | ~5 | **97% reduction** |
| /api/home Response | N/A | ~400ms | Single unified call |

*Note: The 14 remaining RPC calls are ENS lookups (Base ENS) for addresses in Top Artists/Collectors. They run asynchronously and don't block rendering.*

## Architecture Overview

```
Blockchain (Base) ──┬── Event Sync ──> PostgreSQL ──> Pre-computed Cache ──> /api/home ──> Frontend
                    │   (30s interval)
                    │
                    └── NFT Metadata ──> NFT Cache Table
```

## Data Flow

### 1. Blockchain Event Sync

Every 30 seconds (5s during historical catch-up), the server syncs events from the blockchain:

```javascript
// Events synced from Zang contract:
- TransferSingle (mints, transfers)

// Events synced from Marketplace contract:
- TokenListed
- TokenDelisted
- TokenPurchased
```

### 2. Derived Data Updates

After each sync with new events:

```
Events → updateTokenStats() → token_stats table (per-token statistics)
       → updateAuthorStats() → authors table (per-author statistics)
       → updateLeaderboards() → leaderboards table (top artists/collectors)
       → buildHomePageCache() → home_page_cache table (complete home payload)
```

### 3. Unified Home Page Endpoint

`GET /api/home` returns everything needed in a single call:

```json
{
  "lastNftId": 156,
  "nfts": [{ "id", "name", "author", "content", "contentType", "totalSupply", "floorPrice", ... }],
  "stats": { "totalTexts", "uniqueArtists", "totalVolumeEth" },
  "recentEvents": [{ "type", "tokenId", "title", "blockNumber" }],
  "topArtists": [{ "address", "totalCreated", "volumeEth" }],
  "topCollectors": [{ "address", "totalCollected", "volumeEth" }],
  "_meta": { "cachedAt", "lastSyncBlock", "isSyncing" }
}
```

## Database Schema

### Core Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `nfts` | Cached NFT metadata | token_id, uri, author, name, content |
| `events` | All blockchain events | tx_hash, event_type, token_id, data (JSONB) |
| `blocks` | Block timestamps | block_number, timestamp |

### Derived Tables

| Table | Purpose | Refresh |
|-------|---------|---------|
| `token_stats` | Per-token statistics | After sync (if new events) |
| `authors` | Per-author statistics | After sync (if new events) |
| `leaderboards` | Top artists/collectors (JSONB) | After sync (if new events) |
| `home_page_cache` | Complete home page payload (JSONB) | After sync (if new events) |
| `sync_status` | Last synced block | After each sync |

### Schema Details

```sql
-- Pre-computed home page cache (single row)
CREATE TABLE home_page_cache (
    id INTEGER PRIMARY KEY DEFAULT 1,
    data JSONB NOT NULL,           -- Complete home page payload
    last_nft_id BIGINT NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Pre-computed leaderboards
CREATE TABLE leaderboards (
    type VARCHAR(20) PRIMARY KEY,  -- 'artists' or 'collectors'
    data JSONB NOT NULL,           -- Array of top addresses
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Enhanced token stats
CREATE TABLE token_stats (
    token_id BIGINT PRIMARY KEY,
    mint_block BIGINT,
    transfer_count INT DEFAULT 0,
    total_supply BIGINT,
    floor_price TEXT,
    listed_count INTEGER DEFAULT 0,
    total_volume TEXT DEFAULT '0',
    last_sale_price TEXT,
    updated_at TIMESTAMP DEFAULT NOW()
);
```

## Caching Strategy

### HTTP Cache Headers

| Endpoint | Cache-Control | Rationale |
|----------|--------------|-----------|
| `/api/home` | `max-age=5, stale-while-revalidate=30` | Frequently updated, short cache |
| `/api/nft/:id` | `max-age=31536000, immutable` | NFT metadata never changes |
| `/api/block/:number` | `max-age=31536000, immutable` | Block timestamps never change |

### Frontend Caching

- ENS names cached in `localStorage` with configurable expiration
- NFT data passed via props eliminates redundant fetches
- Pre-computed stats skip all RPC calls (48 calls eliminated per home page)

## N+1 Query Elimination

### Before (N+1 Pattern)
```javascript
// For each artist in list:
for (const artist of artists) {
    const created = await query("SELECT COUNT(*) FROM nfts WHERE author = $1", [artist]);
    const volume = await query("SELECT SUM(price) FROM events WHERE seller = $1", [artist]);
}
// Result: ~100+ queries for 10 artists
```

### After (Single Query)
```sql
WITH artist_volumes AS (
    SELECT LOWER(data->>'_seller') as address,
           SUM((data->>'_price')::numeric * (data->>'_amount')::numeric) as volume_wei
    FROM events WHERE event_type = 'TokenPurchased'
    GROUP BY LOWER(data->>'_seller')
)
SELECT address, COUNT(*) as total_created, volume_wei / 1e18 as volume_eth
FROM nfts n
LEFT JOIN artist_volumes av ON LOWER(n.author) = av.address
GROUP BY address, volume_wei
ORDER BY volume_wei DESC
LIMIT 10
```

## Real-time Updates

WebSocket connection provides live updates:

```javascript
// Server emits on new events:
io.emit("newEvents", [...]);
io.emit("syncStatus", { lastSyncBlock, isCatchingUp, syncProgress });

// Client subscribes:
socket.on("newEvents", handleNewEvents);
socket.on("syncStatus", updateSyncIndicator);
```

## Performance Optimizations Applied

1. **Unified API Endpoint** - Single `/api/home` call replaces 8 separate fetches
2. **Pre-computed Caches** - Leaderboards and stats computed on sync, not request
3. **N+1 Elimination** - Complex SQL with CTEs replaces loop-based queries
4. **Content Prefetch** - NFT content included in home payload, no secondary fetch
5. **Stats Prefetch** - Token stats (supply, floor, volume) pre-computed, skip RPC
6. **ENS Rate Limiting** - Max 2 concurrent, 100ms delay, localStorage persistence
7. **Mainnet ENS Disabled** - Base-native app only uses Base ENS (Basenames)
8. **HTTP Caching** - Proper Cache-Control headers for immutable content

## Implemented Optimizations

All planned optimizations have been implemented:

1. **Marketplace RPC Sync** - Background job syncs floor prices, listed counts, total supply every 60s
2. **Code Splitting** - React.lazy() for non-critical pages (mint, activity, profile, nft, etc.)
3. **Home Page Synchronous** - Home page loads synchronously for fastest initial render

### Potential Future Optimizations

1. **ENS Batch Lookup** - Batch multiple ENS resolutions into single multicall
2. **Service Worker** - Cache static assets and API responses
3. **Edge Caching** - CDN caching for `/api/home` responses

## Sync Intervals

| Operation | Normal Interval | Catch-up Interval |
|-----------|----------------|-------------------|
| Event sync | 30 seconds | 5 seconds |
| Marketplace sync | 60 seconds | 60 seconds |
| Stats rebuild | On new events | On new events |
| Cache rebuild | On new events / After marketplace sync | On new events |

### Marketplace Sync

The marketplace sync fetches live data from the blockchain:

```javascript
// For each token:
1. totalSupply - from Zang contract
2. listingCount - from Marketplace contract
3. listings[] - individual listing details (price, seller, amount)

// Computed:
- floorPrice: minimum price among active listings
- listedCount: sum of amounts for active listings
```

This data is stored in `token_stats` and included in the home page cache, eliminating 48+ RPC calls per home page load (12 cards × 4 RPC calls each).

## Monitoring

The sync status is exposed via:

1. **API**: `GET /api/sync/status` - Returns sync progress and stats
2. **WebSocket**: `syncStatus` event - Real-time sync progress
3. **UI**: SyncStatus component shows blocks behind, sync progress
