const { pool } = require("./db.cjs");
const {
    publicClient,
    ZANG_CONTRACT,
    MARKETPLACE_ADDRESS,
    FIRST_ZANG_BLOCK,
    ZANG_TRANSFER_ABI,
    MARKETPLACE_ABI,
    MARKETPLACE_READ_ABI,
    ZANG_READ_ABI,
    getNFTData,
    getBlockTimestamp,
} = require("./blockchain.cjs");

// Sync state (shared via getter/setter for use across modules)
let lastSyncBlock = 0;
let lastSyncTime = null;
let isSyncing = false;

function getSyncState() {
    return { lastSyncBlock, lastSyncTime, isSyncing };
}

// Sync all events globally (efficient - only incremental)
async function syncAllEvents(io) {
    if (isSyncing) {
        return { synced: false, reason: "already syncing" };
    }
    isSyncing = true;

    try {
        const syncKey = "global_events";

        const syncResult = await pool.query(
            "SELECT last_block FROM sync_status WHERE key = $1",
            [syncKey],
        );

        const currentBlock = Number(await publicClient.getBlockNumber());
        const lastSyncedBlock = syncResult.rows.length > 0
            ? Number(syncResult.rows[0].last_block)
            : FIRST_ZANG_BLOCK - 1;

        if (currentBlock <= lastSyncedBlock) {
            lastSyncBlock = lastSyncedBlock;
            lastSyncTime = lastSyncTime || new Date();
            return { synced: false, lastBlock: lastSyncedBlock };
        }

        const MAX_BLOCK_RANGE = 500000;
        const toBlockNum = Math.min(lastSyncedBlock + MAX_BLOCK_RANGE, currentBlock);
        const blocksToSync = toBlockNum - lastSyncedBlock;
        const isCatchingUp = blocksToSync >= MAX_BLOCK_RANGE;

        if (isCatchingUp) {
            console.log(`Catching up: blocks ${lastSyncedBlock + 1} to ${toBlockNum} (${blocksToSync} blocks)`);
        }

        const fromBlock = BigInt(lastSyncedBlock + 1);
        const toBlock = BigInt(toBlockNum);

        console.log(`Syncing events from block ${fromBlock} to ${toBlock}...`);

        const [transferEvents, listEvents, delistEvents, purchaseEvents] =
            await Promise.all([
                publicClient
                    .getContractEvents({
                        address: ZANG_CONTRACT,
                        abi: ZANG_TRANSFER_ABI,
                        eventName: "TransferSingle",
                        fromBlock,
                        toBlock,
                    })
                    .catch((e) => {
                        console.error("Transfer fetch error:", e.message);
                        return [];
                    }),
                publicClient
                    .getContractEvents({
                        address: MARKETPLACE_ADDRESS,
                        abi: MARKETPLACE_ABI,
                        eventName: "TokenListed",
                        fromBlock,
                        toBlock,
                    })
                    .catch((e) => {
                        console.error("List fetch error:", e.message);
                        return [];
                    }),
                publicClient
                    .getContractEvents({
                        address: MARKETPLACE_ADDRESS,
                        abi: MARKETPLACE_ABI,
                        eventName: "TokenDelisted",
                        fromBlock,
                        toBlock,
                    })
                    .catch((e) => {
                        console.error("Delist fetch error:", e.message);
                        return [];
                    }),
                publicClient
                    .getContractEvents({
                        address: MARKETPLACE_ADDRESS,
                        abi: MARKETPLACE_ABI,
                        eventName: "TokenPurchased",
                        fromBlock,
                        toBlock,
                    })
                    .catch((e) => {
                        console.error("Purchase fetch error:", e.message);
                        return [];
                    }),
            ]);

        console.log(`Event counts: TransferSingle=${transferEvents.length}, TokenListed=${listEvents.length}, TokenDelisted=${delistEvents.length}, TokenPurchased=${purchaseEvents.length}`);

        const allEvents = [
            ...transferEvents.map((e) => ({
                type: "TransferSingle",
                event: e,
                tokenId: Number(e.args.id),
            })),
            ...listEvents.map((e) => ({
                type: "TokenListed",
                event: e,
                tokenId: Number(e.args._tokenId),
            })),
            ...delistEvents.map((e) => ({
                type: "TokenDelisted",
                event: e,
                tokenId: Number(e.args._tokenId),
            })),
            ...purchaseEvents.map((e) => ({
                type: "TokenPurchased",
                event: e,
                tokenId: Number(e.args._tokenId),
            })),
        ];

        for (const { type, event, tokenId } of allEvents) {
            const data = {};
            for (const [key, value] of Object.entries(event.args)) {
                data[key] =
                    typeof value === "bigint" ? value.toString() : value;
            }

            await pool.query(
                `INSERT INTO events (tx_hash, log_index, block_number, event_type, token_id, data)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (tx_hash, log_index) DO NOTHING`,
                [
                    event.transactionHash,
                    event.logIndex,
                    Number(event.blockNumber),
                    type,
                    tokenId,
                    JSON.stringify(data),
                ],
            );
        }

        await pool.query(
            `INSERT INTO sync_status (key, last_block) VALUES ($1, $2)
             ON CONFLICT (key) DO UPDATE SET last_block = $2, updated_at = NOW()`,
            [syncKey, toBlockNum],
        );

        console.log(
            `Synced ${allEvents.length} events up to block ${toBlockNum}`,
        );

        lastSyncBlock = toBlockNum;
        lastSyncTime = new Date();

        // Emit new events via WebSocket
        if (allEvents.length > 0 && io) {
            io.emit(
                "newEvents",
                allEvents.map(({ type, event, tokenId }) => ({
                    type,
                    tokenId,
                    blockNumber: Number(event.blockNumber),
                    txHash: event.transactionHash,
                })),
            );
        }

        // Emit sync status update via WebSocket
        if (io) {
            io.emit("syncStatus", {
                lastSyncBlock: toBlockNum,
                lastSyncTime: lastSyncTime.toISOString(),
                isSyncing: false,
                syncProgress: Math.round((toBlockNum / currentBlock) * 100),
                blocksRemaining: Math.max(0, currentBlock - toBlockNum),
                isCatchingUp,
            });
        }

        return {
            synced: true,
            eventsCount: allEvents.length,
            lastBlock: toBlockNum,
            isCatchingUp,
            needsMoreSync: isCatchingUp && toBlockNum < currentBlock,
        };
    } finally {
        isSyncing = false;
    }
}

// Update derived token_stats table from events
async function updateTokenStats() {
    console.log("Updating token stats...");

    const mints = await pool.query(`
        SELECT token_id, block_number, data
        FROM events
        WHERE event_type = 'TransferSingle'
          AND data->>'from' = '0x0000000000000000000000000000000000000000'
        ORDER BY block_number ASC
    `);

    const transferCounts = await pool.query(`
        SELECT token_id, COUNT(*) as count
        FROM events
        WHERE event_type = 'TransferSingle'
        GROUP BY token_id
    `);
    const countMap = new Map(
        transferCounts.rows.map((r) => [r.token_id, parseInt(r.count, 10)]),
    );

    const lastSales = await pool.query(`
        SELECT DISTINCT ON (token_id) token_id, block_number, data->>'_price' as price
        FROM events
        WHERE event_type = 'TokenPurchased'
        ORDER BY token_id, block_number DESC
    `);
    const saleMap = new Map(
        lastSales.rows.map((r) => [
            r.token_id,
            { block: r.block_number, price: r.price },
        ]),
    );

    for (const mint of mints.rows) {
        const tokenId = mint.token_id;
        const sale = saleMap.get(tokenId);

        await pool.query(
            `
            INSERT INTO token_stats (token_id, mint_block, transfer_count, last_sale_price, last_sale_block)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (token_id) DO UPDATE SET
                transfer_count = $3,
                last_sale_price = $4,
                last_sale_block = $5,
                updated_at = NOW()
        `,
            [
                tokenId,
                mint.block_number,
                countMap.get(tokenId) || 0,
                sale?.price || null,
                sale?.block || null,
            ],
        );
    }

    console.log(`Updated stats for ${mints.rows.length} tokens`);
}

// Update derived authors table
async function updateAuthorStats() {
    console.log("Updating author stats...");

    const authorStats = await pool.query(`
        SELECT
            author as address,
            COUNT(*) as total_minted,
            MIN(created_at) as first_mint
        FROM nfts
        GROUP BY author
    `);

    const firstMints = await pool.query(`
        SELECT DISTINCT ON (data->>'to')
            data->>'to' as address,
            block_number
        FROM events
        WHERE event_type = 'TransferSingle'
          AND data->>'from' = '0x0000000000000000000000000000000000000000'
        ORDER BY data->>'to', block_number ASC
    `);
    const mintBlockMap = new Map(
        firstMints.rows.map((r) => [r.address?.toLowerCase(), r.block_number]),
    );

    for (const author of authorStats.rows) {
        const firstMintBlock = mintBlockMap.get(author.address?.toLowerCase());

        await pool.query(
            `
            INSERT INTO authors (address, total_minted, first_mint_block)
            VALUES ($1, $2, $3)
            ON CONFLICT (address) DO UPDATE SET
                total_minted = $2,
                first_mint_block = COALESCE(authors.first_mint_block, $3),
                updated_at = NOW()
        `,
            [
                author.address,
                parseInt(author.total_minted, 10),
                firstMintBlock ? Number(firstMintBlock) : null,
            ],
        );
    }

    console.log(`Updated stats for ${authorStats.rows.length} authors`);
}

// Build pre-computed leaderboards (top artists and collectors)
async function updateLeaderboards() {
    try {
        const artistsResult = await pool.query(`
            WITH artist_volumes AS (
                SELECT
                    LOWER(data->>'_seller') as address,
                    SUM((data->>'_price')::numeric * (data->>'_amount')::numeric) as volume_wei
                FROM events
                WHERE event_type = 'TokenPurchased'
                GROUP BY LOWER(data->>'_seller')
            ),
            artist_stats AS (
                SELECT
                    LOWER(n.author) as address,
                    COUNT(*) as total_created,
                    COALESCE(av.volume_wei, 0) as volume_wei
                FROM nfts n
                LEFT JOIN artist_volumes av ON LOWER(n.author) = av.address
                GROUP BY LOWER(n.author), av.volume_wei
            )
            SELECT
                address,
                total_created::int,
                (volume_wei / 1e18)::numeric as volume_eth
            FROM artist_stats
            ORDER BY volume_wei DESC, total_created DESC
            LIMIT 10
        `);

        await pool.query(`
            INSERT INTO leaderboards (type, data, updated_at)
            VALUES ('artists', $1, NOW())
            ON CONFLICT (type) DO UPDATE SET data = $1, updated_at = NOW()
        `, [JSON.stringify(artistsResult.rows.map(r => ({
            address: r.address,
            totalCreated: r.total_created,
            volumeEth: parseFloat(r.volume_eth) || 0,
        })))]);

        const collectorsResult = await pool.query(`
            WITH collector_volumes AS (
                SELECT
                    LOWER(data->>'_buyer') as address,
                    SUM((data->>'_price')::numeric * (data->>'_amount')::numeric) as volume_wei
                FROM events
                WHERE event_type = 'TokenPurchased'
                GROUP BY LOWER(data->>'_buyer')
            ),
            received_tokens AS (
                SELECT
                    LOWER(data->>'to') as address,
                    token_id,
                    SUM((data->>'value')::bigint) as received
                FROM events
                WHERE event_type = 'TransferSingle'
                  AND data->>'to' != '0x0000000000000000000000000000000000000000'
                GROUP BY LOWER(data->>'to'), token_id
            ),
            sent_tokens AS (
                SELECT
                    LOWER(data->>'from') as address,
                    token_id,
                    SUM((data->>'value')::bigint) as sent
                FROM events
                WHERE event_type = 'TransferSingle'
                GROUP BY LOWER(data->>'from'), token_id
            ),
            token_balances AS (
                SELECT
                    COALESCE(r.address, s.address) as address,
                    COALESCE(r.token_id, s.token_id) as token_id,
                    COALESCE(r.received, 0) - COALESCE(s.sent, 0) as balance
                FROM received_tokens r
                FULL OUTER JOIN sent_tokens s
                    ON r.address = s.address AND r.token_id = s.token_id
            ),
            authored_tokens AS (
                SELECT LOWER(author) as address, token_id
                FROM nfts
            ),
            collector_counts AS (
                SELECT
                    tb.address,
                    COUNT(DISTINCT tb.token_id) as total_collected
                FROM token_balances tb
                LEFT JOIN authored_tokens at ON tb.address = at.address AND tb.token_id = at.token_id
                WHERE tb.balance > 0 AND at.token_id IS NULL
                GROUP BY tb.address
            )
            SELECT
                COALESCE(cv.address, cc.address) as address,
                COALESCE(cc.total_collected, 0)::int as total_collected,
                (COALESCE(cv.volume_wei, 0) / 1e18)::numeric as volume_eth
            FROM collector_volumes cv
            FULL OUTER JOIN collector_counts cc ON cv.address = cc.address
            WHERE COALESCE(cv.volume_wei, 0) > 0 OR COALESCE(cc.total_collected, 0) > 0
            ORDER BY COALESCE(cv.volume_wei, 0) DESC, COALESCE(cc.total_collected, 0) DESC
            LIMIT 10
        `);

        await pool.query(`
            INSERT INTO leaderboards (type, data, updated_at)
            VALUES ('collectors', $1, NOW())
            ON CONFLICT (type) DO UPDATE SET data = $1, updated_at = NOW()
        `, [JSON.stringify(collectorsResult.rows.map(r => ({
            address: r.address,
            totalCollected: r.total_collected,
            volumeEth: parseFloat(r.volume_eth) || 0,
        })))]);

        return { artists: artistsResult.rows.length, collectors: collectorsResult.rows.length };
    } catch (error) {
        console.error("Failed to update leaderboards:", error.message);
        throw error;
    }
}

// Build complete home page cache
async function buildHomePageCache() {
    try {
        const nftsResult = await pool.query(`
            SELECT
                n.token_id, n.name, n.description, n.author, n.content_type, n.content,
                ts.total_supply, ts.floor_price, ts.listed_count, ts.total_volume,
                ts.transfer_count, ts.last_sale_price
            FROM nfts n
            LEFT JOIN token_stats ts ON n.token_id = ts.token_id
            WHERE n.content IS NOT NULL
            ORDER BY n.token_id DESC
            LIMIT 12
        `);

        const statsResult = await pool.query(`
            SELECT
                COUNT(*) as total_texts,
                COUNT(DISTINCT author) as unique_artists
            FROM nfts
            WHERE content IS NOT NULL
        `);

        const volumeResult = await pool.query(`
            SELECT COALESCE(SUM((data->>'_price')::numeric * (data->>'_amount')::numeric), 0) as total_volume
            FROM events WHERE event_type = 'TokenPurchased'
        `);

        const topArtistsResult = await pool.query(
            "SELECT data FROM leaderboards WHERE type = 'artists'"
        );
        const topCollectorsResult = await pool.query(
            "SELECT data FROM leaderboards WHERE type = 'collectors'"
        );

        const lastNftResult = await pool.query(
            "SELECT MAX(token_id) as last_id FROM nfts WHERE content IS NOT NULL"
        );

        const data = {
            lastNftId: lastNftResult.rows[0]?.last_id || 0,
            nfts: nftsResult.rows.map(r => ({
                id: r.token_id,
                name: r.name,
                description: r.description,
                author: r.author,
                contentType: r.content_type,
                content: r.content,
                totalSupply: r.total_supply ? parseInt(r.total_supply, 10) : null,
                floorPrice: r.floor_price,
                listedCount: r.listed_count || 0,
                totalVolume: r.total_volume || '0',
                transferCount: r.transfer_count || 0,
                lastSalePrice: r.last_sale_price,
            })),
            stats: {
                totalTexts: parseInt(statsResult.rows[0]?.total_texts || 0, 10),
                uniqueArtists: parseInt(statsResult.rows[0]?.unique_artists || 0, 10),
                totalVolumeEth: Number(volumeResult.rows[0]?.total_volume || 0) / 1e18,
            },
            topArtists: topArtistsResult.rows[0]?.data || [],
            topCollectors: topCollectorsResult.rows[0]?.data || [],
        };

        await pool.query(`
            INSERT INTO home_page_cache (id, data, last_nft_id, updated_at)
            VALUES (1, $1, $2, NOW())
            ON CONFLICT (id) DO UPDATE SET data = $1, last_nft_id = $2, updated_at = NOW()
        `, [JSON.stringify(data), data.lastNftId]);

        return data;
    } catch (error) {
        console.error("Failed to build home page cache:", error.message);
        throw error;
    }
}

// Unified function to rebuild all derived data — eliminates duplication
async function rebuildDerivedData({ skipLeaderboards = false } = {}) {
    await updateTokenStats().catch(e =>
        console.error("Token stats update failed:", e.message));
    await updateAuthorStats().catch(e =>
        console.error("Author stats update failed:", e.message));
    if (!skipLeaderboards) {
        await updateLeaderboards().catch(e =>
            console.error("Leaderboard update failed:", e.message));
    }
    await buildHomePageCache().catch(e =>
        console.error("Home page cache build failed:", e.message));
}

// Sync marketplace listings (floor prices, listing counts, total supply)
async function syncMarketplaceListings() {
    console.log("Syncing marketplace listings...");

    try {
        const tokens = await pool.query(
            "SELECT token_id FROM nfts WHERE content IS NOT NULL ORDER BY token_id DESC"
        );

        if (tokens.rows.length === 0) {
            console.log("No tokens to sync");
            return { synced: 0 };
        }

        const zeroAddress = "0x0000000000000000000000000000000000000000";
        let synced = 0;

        const BATCH_SIZE = 5;
        for (let i = 0; i < tokens.rows.length; i += BATCH_SIZE) {
            const batch = tokens.rows.slice(i, i + BATCH_SIZE);

            await Promise.all(batch.map(async ({ token_id }) => {
                try {
                    const [totalSupply, listingCount, royaltyResult] = await Promise.all([
                        publicClient.readContract({
                            address: ZANG_CONTRACT,
                            abi: ZANG_READ_ABI,
                            functionName: "totalSupply",
                            args: [BigInt(token_id)],
                        }),
                        publicClient.readContract({
                            address: MARKETPLACE_ADDRESS,
                            abi: MARKETPLACE_READ_ABI,
                            functionName: "listingCount",
                            args: [BigInt(token_id)],
                        }),
                        publicClient.readContract({
                            address: ZANG_CONTRACT,
                            abi: ZANG_READ_ABI,
                            functionName: "royaltyInfo",
                            args: [BigInt(token_id), 10000n],
                        }),
                    ]);

                    const royaltyRecipient = royaltyResult[0];
                    const royaltyBps = Number(royaltyResult[1]);

                    const count = Number(listingCount);
                    let floorPrice = null;
                    let listedCount = 0;

                    if (count > 0) {
                        const listingPromises = [];
                        for (let j = 0; j < Math.min(count, 10); j++) {
                            listingPromises.push(
                                publicClient.readContract({
                                    address: MARKETPLACE_ADDRESS,
                                    abi: MARKETPLACE_READ_ABI,
                                    functionName: "listings",
                                    args: [BigInt(token_id), BigInt(j)],
                                })
                            );
                        }

                        const listings = await Promise.all(listingPromises);
                        const activeListings = listings
                            .map(([price, seller, amount]) => ({ price, seller, amount }))
                            .filter(l => l.seller !== zeroAddress && Number(l.amount) > 0);

                        listedCount = activeListings.reduce((sum, l) => sum + Number(l.amount), 0);

                        if (activeListings.length > 0) {
                            const prices = activeListings.map(l => l.price);
                            const minPrice = prices.reduce((min, p) => p < min ? p : min, prices[0]);
                            floorPrice = minPrice.toString();
                        }
                    }

                    const volumeResult = await pool.query(`
                        SELECT COALESCE(SUM((data->>'_price')::numeric * (data->>'_amount')::numeric), 0) as volume_wei
                        FROM events
                        WHERE event_type = 'TokenPurchased' AND token_id = $1
                    `, [token_id]);
                    const totalVolume = volumeResult.rows[0].volume_wei || '0';

                    await pool.query(`
                        INSERT INTO token_stats (token_id, total_supply, floor_price, listed_count, total_volume, royalty_recipient, royalty_bps, updated_at)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
                        ON CONFLICT (token_id) DO UPDATE SET
                            total_supply = $2,
                            floor_price = $3,
                            listed_count = $4,
                            total_volume = $5,
                            royalty_recipient = $6,
                            royalty_bps = $7,
                            updated_at = NOW()
                    `, [token_id, Number(totalSupply), floorPrice, listedCount, totalVolume, royaltyRecipient, royaltyBps]);

                    synced++;
                } catch (e) {
                    console.error(`Failed to sync token ${token_id}:`, e.message);
                }
            }));

            if (i + BATCH_SIZE < tokens.rows.length) {
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        }

        console.log(`Synced marketplace data for ${synced}/${tokens.rows.length} tokens`);
        return { synced };
    } catch (error) {
        console.error("Marketplace sync failed:", error.message);
        return { synced: 0, error: error.message };
    }
}

// Pre-warm NFT cache by fetching all known tokens
async function prewarmNftCache() {
    console.log("Pre-warming NFT cache...");

    const mints = await pool.query(`
        SELECT DISTINCT token_id
        FROM events
        WHERE event_type = 'TransferSingle'
          AND data->>'from' = '0x0000000000000000000000000000000000000000'
        ORDER BY token_id
    `);

    const cached = await pool.query(
        "SELECT token_id FROM nfts WHERE content IS NOT NULL",
    );
    const cachedSet = new Set(cached.rows.map((r) => r.token_id.toString()));

    const uncachedTokens = mints.rows
        .map((r) => r.token_id.toString())
        .filter((id) => !cachedSet.has(id));

    console.log(
        `Found ${uncachedTokens.length} uncached NFTs out of ${mints.rows.length} total`,
    );

    const BATCH_SIZE = 5;
    let fetched = 0;
    let failed = 0;

    for (let i = 0; i < uncachedTokens.length; i += BATCH_SIZE) {
        const batch = uncachedTokens.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(
            batch.map((id) => getNFTData(parseInt(id, 10))),
        );

        fetched += results.filter((r) => r.status === "fulfilled").length;
        failed += results.filter((r) => r.status === "rejected").length;

        if (i + BATCH_SIZE < uncachedTokens.length) {
            await new Promise((resolve) => setTimeout(resolve, 500));
        }
    }

    console.log(`Pre-warm complete: ${fetched} cached, ${failed} failed`);
    return { fetched, failed, total: uncachedTokens.length };
}

// Pre-warm block timestamps from events
async function prewarmBlockTimestamps() {
    console.log("Pre-warming block timestamps...");

    const uniqueBlocks = await pool.query(`
        SELECT DISTINCT block_number FROM events ORDER BY block_number
    `);

    const cached = await pool.query("SELECT block_number FROM blocks");
    const cachedSet = new Set(
        cached.rows.map((r) => r.block_number.toString()),
    );

    const uncachedBlocks = uniqueBlocks.rows
        .map((r) => r.block_number.toString())
        .filter((bn) => !cachedSet.has(bn));

    console.log(
        `Found ${uncachedBlocks.length} uncached blocks out of ${uniqueBlocks.rows.length} total`,
    );

    if (uncachedBlocks.length === 0) return { fetched: 0, total: 0 };

    const BATCH_SIZE = 10;
    let fetched = 0;

    for (let i = 0; i < uncachedBlocks.length; i += BATCH_SIZE) {
        const batch = uncachedBlocks.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(
            batch.map((bn) => getBlockTimestamp(parseInt(bn, 10))),
        );

        fetched += results.filter((r) => r.status === "fulfilled").length;

        if (i + BATCH_SIZE < uncachedBlocks.length) {
            await new Promise((resolve) => setTimeout(resolve, 200));
        }
    }

    console.log(`Block pre-warm complete: ${fetched} cached`);
    return { fetched, total: uncachedBlocks.length };
}

// DB query helpers for routes
async function getTokenEvents(tokenId) {
    const result = await pool.query(
        `SELECT event_type, block_number, tx_hash, log_index, data
         FROM events WHERE token_id = $1 ORDER BY block_number, log_index`,
        [tokenId],
    );
    return result.rows;
}

async function getRecentEvents(limit = 500) {
    const result = await pool.query(
        `SELECT event_type, block_number, tx_hash, log_index, token_id, data
         FROM events
         ORDER BY block_number DESC, log_index DESC LIMIT $1`,
        [limit],
    );
    return result.rows;
}

module.exports = {
    getSyncState,
    syncAllEvents,
    updateTokenStats,
    updateAuthorStats,
    updateLeaderboards,
    buildHomePageCache,
    rebuildDerivedData,
    syncMarketplaceListings,
    prewarmNftCache,
    prewarmBlockTimestamps,
    getTokenEvents,
    getRecentEvents,
};
