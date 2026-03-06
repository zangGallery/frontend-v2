const { verifyMessage } = require("viem");
const { pool } = require("./db.cjs");
const {
    publicClient,
    getNFTData,
    getBlockTimestamp,
    fetchNFTMetadata,
    isValidAddress,
} = require("./blockchain.cjs");
const {
    getSyncState,
    syncAllEvents,
    rebuildDerivedData,
    updateLeaderboards,
    buildHomePageCache,
    getTokenEvents,
    getRecentEvents,
} = require("./sync.cjs");

const SYNC_INTERVAL_MS = 30000;

function registerRoutes(app) {
    // API: Get NFT data (immutable, cached)
    app.get("/api/nft/:id", async (req, res) => {
        try {
            const tokenId = parseInt(req.params.id, 10);
            if (isNaN(tokenId) || tokenId < 1) {
                return res.status(400).json({ error: "Invalid token ID" });
            }

            const [nft, statsResult] = await Promise.all([
                getNFTData(tokenId),
                pool.query(
                    `SELECT total_supply, floor_price, listed_count, total_volume, royalty_recipient, royalty_bps
                     FROM token_stats WHERE token_id = $1`,
                    [tokenId]
                ),
            ]);

            const stats = statsResult.rows[0];
            if (stats) {
                nft._stats = {
                    totalSupply: stats.total_supply ? parseInt(stats.total_supply, 10) : null,
                    floorPrice: stats.floor_price,
                    listedCount: stats.listed_count || 0,
                    totalVolume: stats.total_volume || '0',
                    royaltyRecipient: stats.royalty_recipient || null,
                    royaltyBps: stats.royalty_bps !== null ? stats.royalty_bps : null,
                };
            }

            res.json(nft);
        } catch (error) {
            if (
                error.message?.includes("does not exist") ||
                error.message?.includes("reverted")
            ) {
                return res.status(404).json({ error: "NFT not found" });
            }
            res.status(500).json({ error: "Failed to fetch NFT" });
        }
    });

    // API: Batch get NFTs (for gallery)
    app.post("/api/nfts/batch", async (req, res) => {
        try {
            const { ids } = req.body;
            if (!Array.isArray(ids) || ids.length === 0) {
                return res.status(400).json({ error: "ids array required" });
            }

            const limitedIds = ids.slice(0, 50);

            const results = await Promise.allSettled(
                limitedIds.map((id) => getNFTData(parseInt(id, 10))),
            );

            const nfts = results.map((result, index) => ({
                id: limitedIds[index],
                ...(result.status === "fulfilled"
                    ? { data: result.value }
                    : { error: "Not found" }),
            }));

            res.json({ nfts });
        } catch (error) {
            res.status(500).json({ error: "Failed to fetch NFTs" });
        }
    });

    // API: Get block timestamp (immutable, cached)
    app.get("/api/block/:number", async (req, res) => {
        try {
            const blockNumber = parseInt(req.params.number, 10);
            if (isNaN(blockNumber) || blockNumber < 0) {
                return res.status(400).json({ error: "Invalid block number" });
            }

            const timestamp = await getBlockTimestamp(blockNumber);
            res.json({ blockNumber, timestamp });
        } catch (error) {
            res.status(500).json({ error: "Failed to fetch block" });
        }
    });

    // API: Trigger sync (for manual/cron use)
    app.post("/api/sync", async (req, res) => {
        try {
            const result = await syncAllEvents();
            if (result.eventsCount > 0) {
                await rebuildDerivedData();
            }
            res.json(result);
        } catch (error) {
            console.error("Sync failed:", error.message);
            res.status(500).json({ error: "Sync failed" });
        }
    });

    // API: Get sync status
    app.get("/api/sync/status", async (req, res) => {
        try {
            const result = await pool.query(
                "SELECT key, last_block, updated_at FROM sync_status ORDER BY key",
            );
            const eventCount = await pool.query(
                "SELECT COUNT(*) as count FROM events",
            );
            const nftCount = await pool.query("SELECT COUNT(*) as count FROM nfts");

            const currentBlock = Number(await publicClient.getBlockNumber());
            const globalSync = result.rows.find((r) => r.key === "global_events");
            const syncedBlock = globalSync ? Number(globalSync.last_block) : 0;
            const blocksRemaining = Math.max(0, currentBlock - syncedBlock);
            const isCatchingUp = blocksRemaining > 1000;
            const syncProgress = syncedBlock > 0
                ? Math.round((syncedBlock / currentBlock) * 100)
                : 0;

            res.json({
                syncStatus: result.rows,
                totalEvents: parseInt(eventCount.rows[0].count, 10),
                totalNfts: parseInt(nftCount.rows[0].count, 10),
                currentBlock,
                syncedBlock,
                blocksRemaining,
                isCatchingUp,
                syncProgress,
            });
        } catch (error) {
            res.status(500).json({ error: "Failed to get status" });
        }
    });

    // API: Get events for a specific NFT
    app.get("/api/events/:tokenId", async (req, res) => {
        try {
            const tokenId = parseInt(req.params.tokenId, 10);
            if (isNaN(tokenId) || tokenId < 1) {
                return res.status(400).json({ error: "Invalid token ID" });
            }
            const events = await getTokenEvents(tokenId);
            const { lastSyncBlock, lastSyncTime, isSyncing } = getSyncState();
            res.json({
                events,
                _meta: {
                    lastSyncBlock,
                    lastSyncTime: lastSyncTime?.toISOString() || null,
                    isSyncing,
                },
            });
        } catch (error) {
            console.error("Failed to fetch events:", error.message);
            res.status(500).json({ error: "Failed to fetch events" });
        }
    });

    // API: Get recent activity
    app.get("/api/activity", async (req, res) => {
        try {
            const events = await getRecentEvents();
            const { lastSyncBlock, lastSyncTime, isSyncing } = getSyncState();

            let syncProgress = 100;
            let blocksRemaining = 0;
            let isCatchingUp = false;

            try {
                const currentBlock = Number(await publicClient.getBlockNumber());
                blocksRemaining = Math.max(0, currentBlock - lastSyncBlock);
                isCatchingUp = blocksRemaining > 1000;
                syncProgress = lastSyncBlock > 0
                    ? Math.round((lastSyncBlock / currentBlock) * 100)
                    : 0;
            } catch (e) {
                // Ignore RPC errors for sync status
            }

            res.json({
                events,
                _meta: {
                    lastSyncBlock,
                    lastSyncTime: lastSyncTime?.toISOString() || null,
                    isSyncing,
                    syncIntervalSeconds: SYNC_INTERVAL_MS / 1000,
                    syncProgress,
                    blocksRemaining,
                    isCatchingUp,
                },
            });
        } catch (error) {
            console.error("Failed to fetch activity:", error.message);
            res.status(500).json({ error: "Failed to fetch activity" });
        }
    });

    // API: Get stats (unique artists count)
    app.get("/api/stats", async (req, res) => {
        try {
            const result = await pool.query(
                "SELECT COUNT(DISTINCT author) as artists FROM nfts",
            );
            const nftCount = await pool.query("SELECT COUNT(*) as count FROM nfts");
            const eventCount = await pool.query(
                "SELECT COUNT(*) as count FROM events",
            );

            const volumeResult = await pool.query(
                "SELECT data FROM events WHERE event_type = 'TokenPurchased'",
            );
            let totalVolumeWei = BigInt(0);
            for (const row of volumeResult.rows) {
                const price = BigInt(row.data._price || 0);
                const amount = BigInt(row.data._amount || 1);
                totalVolumeWei += price * amount;
            }
            const totalVolumeEth = Number(totalVolumeWei) / 1e18;

            res.json({
                uniqueArtists: parseInt(result.rows[0].artists, 10),
                totalNfts: parseInt(nftCount.rows[0].count, 10),
                totalEvents: parseInt(eventCount.rows[0].count, 10),
                totalVolumeEth,
            });
        } catch (error) {
            res.status(500).json({ error: "Failed to fetch stats" });
        }
    });

    // API: Get token stats
    app.get("/api/token/:id/stats", async (req, res) => {
        try {
            const tokenId = parseInt(req.params.id, 10);
            if (isNaN(tokenId) || tokenId < 1) {
                return res.status(400).json({ error: "Invalid token ID" });
            }

            const result = await pool.query(
                "SELECT * FROM token_stats WHERE token_id = $1",
                [tokenId],
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: "Token stats not found" });
            }

            res.json(result.rows[0]);
        } catch (error) {
            res.status(500).json({ error: "Failed to fetch token stats" });
        }
    });

    // API: Get author/address profile
    app.get("/api/author/:address", async (req, res) => {
        try {
            const address = req.params.address.toLowerCase();

            const [
                authorResult,
                profileResult,
                createdResult,
                receivedResult,
                sentResult,
                buyerVolumeResult,
                sellerVolumeResult,
                firstActivityResult,
            ] = await Promise.all([
                pool.query(
                    "SELECT * FROM authors WHERE LOWER(address) = $1",
                    [address],
                ),
                pool.query(
                    "SELECT name FROM profiles WHERE LOWER(address) = $1",
                    [address],
                ),
                pool.query(
                    `SELECT n.token_id, n.name, n.description, n.content_type, n.content, n.author,
                            ts.total_supply, ts.floor_price, ts.listed_count, ts.total_volume
                     FROM nfts n
                     LEFT JOIN token_stats ts ON n.token_id = ts.token_id
                     WHERE LOWER(n.author) = $1
                     ORDER BY n.token_id DESC`,
                    [address],
                ),
                pool.query(
                    `SELECT token_id, SUM((data->>'value')::bigint) as received
                     FROM events
                     WHERE event_type = 'TransferSingle'
                       AND LOWER(data->>'to') = $1
                     GROUP BY token_id`,
                    [address],
                ),
                pool.query(
                    `SELECT token_id, SUM((data->>'value')::bigint) as sent
                     FROM events
                     WHERE event_type = 'TransferSingle'
                       AND LOWER(data->>'from') = $1
                     GROUP BY token_id`,
                    [address],
                ),
                pool.query(
                    `SELECT COALESCE(SUM((data->>'_price')::numeric * (data->>'_amount')::numeric), 0) as volume
                     FROM events
                     WHERE event_type = 'TokenPurchased'
                       AND LOWER(data->>'_buyer') = $1`,
                    [address],
                ),
                pool.query(
                    `SELECT COALESCE(SUM((data->>'_price')::numeric * (data->>'_amount')::numeric), 0) as volume
                     FROM events
                     WHERE event_type = 'TokenPurchased'
                       AND LOWER(data->>'_seller') = $1`,
                    [address],
                ),
                pool.query(
                    `SELECT MIN(block_number) as first_block
                     FROM events
                     WHERE LOWER(data->>'from') = $1
                        OR LOWER(data->>'to') = $1
                        OR LOWER(data->>'_buyer') = $1
                        OR LOWER(data->>'_seller') = $1`,
                    [address],
                ),
            ]);

            const balanceMap = {};
            for (const row of receivedResult.rows) {
                balanceMap[row.token_id] = (balanceMap[row.token_id] || 0n) + BigInt(row.received);
            }
            for (const row of sentResult.rows) {
                balanceMap[row.token_id] = (balanceMap[row.token_id] || 0n) - BigInt(row.sent);
            }

            const createdTokenIds = new Set(createdResult.rows.map(r => r.token_id.toString()));
            const collectedTokenIds = Object.entries(balanceMap)
                .filter(([tokenId, balance]) => balance > 0n && !createdTokenIds.has(tokenId))
                .map(([tokenId]) => parseInt(tokenId, 10));

            let collectedNfts = [];
            if (collectedTokenIds.length > 0) {
                const collectedResult = await pool.query(
                    `SELECT n.token_id, n.name, n.description, n.content_type, n.content, n.author,
                            ts.total_supply, ts.floor_price, ts.listed_count, ts.total_volume
                     FROM nfts n
                     LEFT JOIN token_stats ts ON n.token_id = ts.token_id
                     WHERE n.token_id = ANY($1)
                     ORDER BY n.token_id DESC`,
                    [collectedTokenIds],
                );
                collectedNfts = collectedResult.rows;
            }

            let firstActivityTimestamp = null;
            if (firstActivityResult.rows[0]?.first_block) {
                firstActivityTimestamp = await getBlockTimestamp(firstActivityResult.rows[0].first_block);
            }

            const volumeAsBuyer = Number(buyerVolumeResult.rows[0].volume) / 1e18;
            const volumeAsSeller = Number(sellerVolumeResult.rows[0].volume) / 1e18;

            res.json({
                address,
                profileName: profileResult.rows[0]?.name || null,
                stats: {
                    totalCreated: createdResult.rows.length,
                    totalCollected: collectedNfts.length,
                    volumeAsBuyer: volumeAsBuyer.toFixed(4),
                    volumeAsSeller: volumeAsSeller.toFixed(4),
                    totalVolume: (volumeAsBuyer + volumeAsSeller).toFixed(4),
                    firstActivityBlock: firstActivityResult.rows[0]?.first_block || null,
                    firstActivityTimestamp,
                },
                created: createdResult.rows,
                collected: collectedNfts,
            });
        } catch (error) {
            console.error("Failed to fetch profile:", error.message);
            res.status(500).json({ error: "Failed to fetch profile" });
        }
    });

    // API: Get profile (custom display name, bio, social links)
    app.get("/api/profile/:address", async (req, res) => {
        try {
            const address = req.params.address.toLowerCase();
            const result = await pool.query(
                "SELECT name, bio, x_username, instagram_username, base_username, updated_at FROM profiles WHERE LOWER(address) = $1",
                [address],
            );
            if (result.rows.length > 0) {
                const row = result.rows[0];
                res.json({
                    address,
                    name: row.name,
                    bio: row.bio,
                    xUsername: row.x_username,
                    instagramUsername: row.instagram_username,
                    baseUsername: row.base_username,
                    updatedAt: row.updated_at,
                });
            } else {
                res.json({ address, name: null, bio: null, xUsername: null, instagramUsername: null, baseUsername: null });
            }
        } catch (error) {
            console.error("Failed to fetch profile:", error.message);
            res.status(500).json({ error: "Failed to fetch profile" });
        }
    });

    // API: Update profile with signature verification
    app.post("/api/profile", async (req, res) => {
        try {
            const { address, name, bio, xUsername, instagramUsername, baseUsername, signature, timestamp } = req.body;

            if (!address || !signature || timestamp === undefined) {
                return res.status(400).json({ error: "Missing required fields" });
            }

            const now = Date.now();
            if (Math.abs(now - timestamp) > 5 * 60 * 1000) {
                return res.status(400).json({ error: "Signature expired" });
            }

            const cleanName = name?.trim().slice(0, 50) || null;
            const cleanBio = bio?.trim().slice(0, 160) || null;
            const cleanX = xUsername?.trim().replace(/^@/, "").slice(0, 50) || null;
            const cleanInstagram = instagramUsername?.trim().replace(/^@/, "").slice(0, 50) || null;
            const cleanBase = baseUsername?.trim().slice(0, 50) || null;

            if (cleanName && !/^[a-zA-Z0-9\s._-]+$/.test(cleanName)) {
                return res.status(400).json({ error: "Name contains invalid characters" });
            }

            const usernameRegex = /^[a-zA-Z0-9_.]+$/;
            if (cleanX && !usernameRegex.test(cleanX)) {
                return res.status(400).json({ error: "Invalid X username" });
            }
            if (cleanInstagram && !usernameRegex.test(cleanInstagram)) {
                return res.status(400).json({ error: "Invalid Instagram username" });
            }
            if (cleanBase && !usernameRegex.test(cleanBase)) {
                return res.status(400).json({ error: "Invalid Base username" });
            }

            const profileData = JSON.stringify({
                name: cleanName,
                bio: cleanBio,
                xUsername: cleanX,
                instagramUsername: cleanInstagram,
                baseUsername: cleanBase,
            });
            const message = `Update my zang profile:\n\n${profileData}\n\nTimestamp: ${timestamp}`;

            const isValid = await verifyMessage({
                address,
                message,
                signature,
            });

            if (!isValid) {
                return res.status(401).json({ error: "Invalid signature" });
            }

            await pool.query(
                `INSERT INTO profiles (address, name, bio, x_username, instagram_username, base_username, updated_at)
                 VALUES ($1, $2, $3, $4, $5, $6, NOW())
                 ON CONFLICT (address)
                 DO UPDATE SET name = $2, bio = $3, x_username = $4, instagram_username = $5, base_username = $6, updated_at = NOW()`,
                [address.toLowerCase(), cleanName, cleanBio, cleanX, cleanInstagram, cleanBase],
            );

            res.json({
                success: true,
                name: cleanName,
                bio: cleanBio,
                xUsername: cleanX,
                instagramUsername: cleanInstagram,
                baseUsername: cleanBase,
            });
        } catch (error) {
            console.error("Failed to update profile:", error.message);
            res.status(500).json({ error: "Failed to update profile" });
        }
    });

    // API: Get user activity history (all events relevant to an address)
    app.get("/api/user-history/:address", async (req, res) => {
        try {
            const address = req.params.address.toLowerCase();
            const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);

            const result = await pool.query(
                `SELECT e.event_type, e.token_id, e.block_number, e.tx_hash, e.data, n.name as title
                 FROM events e
                 LEFT JOIN nfts n ON e.token_id = n.token_id
                 WHERE (
                     (e.event_type = 'TransferSingle' AND (LOWER(e.data->>'to') = $1 OR LOWER(e.data->>'from') = $1))
                     OR (e.event_type = 'TokenPurchased' AND (LOWER(e.data->>'_buyer') = $1 OR LOWER(e.data->>'_seller') = $1))
                     OR (e.event_type = 'TokenListed' AND LOWER(e.data->>'_seller') = $1)
                     OR (e.event_type = 'TokenDelisted' AND LOWER(e.data->>'_seller') = $1)
                 )
                 ORDER BY e.block_number DESC, e.log_index DESC
                 LIMIT $2`,
                [address, limit]
            );

            const purchaseTxHashes = new Set(
                result.rows
                    .filter(r => r.event_type === 'TokenPurchased')
                    .map(r => r.tx_hash)
            );

            const history = result.rows
                .filter(row => {
                    if (row.event_type === 'TransferSingle' && purchaseTxHashes.has(row.tx_hash)) {
                        return false;
                    }
                    return true;
                })
                .map(row => {
                    const data = row.data;
                    let type, counterparty, amount, price;

                    switch (row.event_type) {
                        case 'TransferSingle': {
                            const from = data.from?.toLowerCase();
                            const to = data.to?.toLowerCase();
                            const isFromZero = from === '0x0000000000000000000000000000000000000000';
                            const isToZero = to === '0x0000000000000000000000000000000000000000';

                            if (isFromZero && to === address) {
                                type = 'mint';
                                counterparty = null;
                            } else if (to === address) {
                                type = 'receive';
                                counterparty = from;
                            } else if (from === address) {
                                type = isToZero ? 'burn' : 'send';
                                counterparty = isToZero ? null : to;
                            } else {
                                type = 'transfer';
                                counterparty = null;
                            }
                            amount = parseInt(data.value || '1', 10);
                            break;
                        }
                        case 'TokenPurchased': {
                            const buyer = data._buyer?.toLowerCase();
                            const seller = data._seller?.toLowerCase();
                            if (buyer === address) {
                                type = 'purchase';
                                counterparty = seller;
                            } else {
                                type = 'sale';
                                counterparty = buyer;
                            }
                            amount = parseInt(data._amount || '1', 10);
                            price = data._price;
                            break;
                        }
                        case 'TokenListed':
                            type = 'list';
                            amount = parseInt(data._amount || '1', 10);
                            price = data._price;
                            break;

                        case 'TokenDelisted':
                            type = 'delist';
                            amount = parseInt(data._amount || '1', 10);
                            break;

                        default:
                            type = row.event_type;
                    }

                    return {
                        type,
                        tokenId: row.token_id,
                        title: row.title || `#${row.token_id}`,
                        blockNumber: row.block_number,
                        txHash: row.tx_hash,
                        counterparty,
                        amount,
                        price,
                    };
                });

            res.json({ history });
        } catch (error) {
            console.error("Failed to fetch user history:", error.message);
            res.status(500).json({ error: "Failed to fetch user history" });
        }
    });

    // API: Get all authors (leaderboard)
    app.get("/api/authors", async (req, res) => {
        try {
            const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
            const result = await pool.query(
                "SELECT * FROM authors ORDER BY total_minted DESC LIMIT $1",
                [limit],
            );
            res.json({ authors: result.rows });
        } catch (error) {
            res.status(500).json({ error: "Failed to fetch authors" });
        }
    });

    // API: Get top artists by volume (ties broken by total minted)
    app.get("/api/top-artists", async (req, res) => {
        try {
            const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);

            const artistsResult = await pool.query(
                `SELECT DISTINCT LOWER(author) as address FROM nfts`
            );

            const artists = [];

            for (const row of artistsResult.rows) {
                const address = row.address;

                const createdResult = await pool.query(
                    `SELECT COUNT(*) as count FROM nfts WHERE LOWER(author) = $1`,
                    [address]
                );
                const totalCreated = parseInt(createdResult.rows[0].count, 10);

                const volumeResult = await pool.query(
                    `SELECT COALESCE(SUM((data->>'_price')::numeric * (data->>'_amount')::numeric), 0) as volume
                     FROM events
                     WHERE event_type = 'TokenPurchased'
                       AND LOWER(data->>'_seller') = $1`,
                    [address]
                );
                const volumeWei = BigInt(volumeResult.rows[0].volume || 0);
                const volumeEth = Number(volumeWei) / 1e18;

                artists.push({
                    address,
                    totalCreated,
                    volumeEth,
                });
            }

            artists.sort((a, b) => {
                if (b.volumeEth !== a.volumeEth) {
                    return b.volumeEth - a.volumeEth;
                }
                return b.totalCreated - a.totalCreated;
            });

            res.json({ artists: artists.slice(0, limit) });
        } catch (error) {
            console.error("Failed to fetch top artists:", error.message);
            res.status(500).json({ error: "Failed to fetch top artists" });
        }
    });

    // API: Get top collectors by volume (ties broken by total collected)
    app.get("/api/top-collectors", async (req, res) => {
        try {
            const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);

            const collectorsResult = await pool.query(
                `SELECT DISTINCT LOWER(data->>'to') as address
                 FROM events
                 WHERE event_type = 'TransferSingle'
                   AND data->>'to' != '0x0000000000000000000000000000000000000000'`
            );

            const collectors = [];

            for (const row of collectorsResult.rows) {
                const address = row.address;
                if (!address) continue;

                const receivedResult = await pool.query(
                    `SELECT token_id, SUM((data->>'value')::bigint) as received
                     FROM events
                     WHERE event_type = 'TransferSingle'
                       AND LOWER(data->>'to') = $1
                     GROUP BY token_id`,
                    [address]
                );

                const sentResult = await pool.query(
                    `SELECT token_id, SUM((data->>'value')::bigint) as sent
                     FROM events
                     WHERE event_type = 'TransferSingle'
                       AND LOWER(data->>'from') = $1
                     GROUP BY token_id`,
                    [address]
                );

                const authoredResult = await pool.query(
                    `SELECT token_id FROM nfts WHERE LOWER(author) = $1`,
                    [address]
                );
                const authoredTokenIds = new Set(authoredResult.rows.map(r => r.token_id.toString()));

                const balanceMap = {};
                for (const r of receivedResult.rows) {
                    balanceMap[r.token_id] = (balanceMap[r.token_id] || 0n) + BigInt(r.received);
                }
                for (const r of sentResult.rows) {
                    balanceMap[r.token_id] = (balanceMap[r.token_id] || 0n) - BigInt(r.sent);
                }

                const totalCollected = Object.entries(balanceMap)
                    .filter(([tokenId, balance]) => balance > 0n && !authoredTokenIds.has(tokenId))
                    .length;

                const volumeResult = await pool.query(
                    `SELECT COALESCE(SUM((data->>'_price')::numeric * (data->>'_amount')::numeric), 0) as volume
                     FROM events
                     WHERE event_type = 'TokenPurchased'
                       AND LOWER(data->>'_buyer') = $1`,
                    [address]
                );
                const volumeWei = BigInt(volumeResult.rows[0].volume || 0);
                const volumeEth = Number(volumeWei) / 1e18;

                if (volumeEth > 0 || totalCollected > 0) {
                    collectors.push({
                        address,
                        totalCollected,
                        volumeEth,
                    });
                }
            }

            collectors.sort((a, b) => {
                if (b.volumeEth !== a.volumeEth) {
                    return b.volumeEth - a.volumeEth;
                }
                return b.totalCollected - a.totalCollected;
            });

            res.json({ collectors: collectors.slice(0, limit) });
        } catch (error) {
            console.error("Failed to fetch top collectors:", error.message);
            res.status(500).json({ error: "Failed to fetch top collectors" });
        }
    });

    // API: Paginated gallery endpoint
    app.get("/api/gallery", async (req, res) => {
        try {
            const limit = Math.min(parseInt(req.query.limit, 10) || 12, 50);
            const offset = parseInt(req.query.offset, 10) || 0;
            const sort = req.query.sort || "newest";
            const contentType = req.query.type || "all";
            const listedOnly = req.query.listed === "yes";

            const conditions = ["n.content IS NOT NULL"];
            const params = [];
            let paramIndex = 1;

            if (contentType === "html") {
                conditions.push(`n.content_type = $${paramIndex++}`);
                params.push("text/html");
            } else if (contentType === "markdown") {
                conditions.push(`n.content_type = $${paramIndex++}`);
                params.push("text/markdown");
            } else if (contentType === "plain") {
                conditions.push(`n.content_type = $${paramIndex++}`);
                params.push("text/plain");
            }

            if (listedOnly) {
                conditions.push(`COALESCE(ts.listed_count, 0) > 0`);
            }

            const whereClause = conditions.join(" AND ");

            let orderBy;
            switch (sort) {
                case "oldest":
                    orderBy = "n.token_id ASC";
                    break;
                case "price_low":
                    orderBy = "CASE WHEN ts.floor_price IS NULL THEN 1 ELSE 0 END, ts.floor_price::numeric ASC, n.token_id DESC";
                    break;
                case "price_high":
                    orderBy = "CASE WHEN ts.floor_price IS NULL THEN 1 ELSE 0 END, ts.floor_price::numeric DESC, n.token_id DESC";
                    break;
                case "editions":
                    orderBy = "COALESCE(ts.total_supply, 0) DESC, n.token_id DESC";
                    break;
                default:
                    orderBy = "n.token_id DESC";
            }

            const countResult = await pool.query(
                `SELECT COUNT(*) as total FROM nfts n
                 LEFT JOIN token_stats ts ON n.token_id = ts.token_id
                 WHERE ${whereClause}`,
                params
            );
            const totalCount = parseInt(countResult.rows[0]?.total || 0, 10);

            const nftsResult = await pool.query(
                `SELECT n.token_id, n.name, n.description, n.author, n.content_type, n.content,
                        ts.total_supply, ts.floor_price, ts.listed_count, ts.total_volume
                 FROM nfts n
                 LEFT JOIN token_stats ts ON n.token_id = ts.token_id
                 WHERE ${whereClause}
                 ORDER BY ${orderBy}
                 LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
                [...params, limit, offset]
            );

            const nfts = nftsResult.rows.map(r => ({
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
            }));

            res.set("Cache-Control", "public, max-age=10, stale-while-revalidate=30");
            res.json({
                totalCount,
                nfts,
                hasMore: offset + nfts.length < totalCount,
                offset,
                limit,
            });
        } catch (error) {
            console.error("Failed to fetch gallery:", error.message);
            res.status(500).json({ error: "Failed to fetch gallery" });
        }
    });

    // API: Unified home page endpoint
    app.get("/api/home", async (req, res) => {
        try {
            const cacheResult = await pool.query(
                "SELECT data, updated_at FROM home_page_cache WHERE id = 1"
            );

            let data;
            let cachedAt;

            if (cacheResult.rows.length > 0) {
                data = cacheResult.rows[0].data;
                cachedAt = cacheResult.rows[0].updated_at;
            } else {
                await updateLeaderboards();
                data = await buildHomePageCache();
                cachedAt = new Date();
            }

            const { lastSyncBlock, lastSyncTime, isSyncing } = getSyncState();

            res.set("Cache-Control", "public, max-age=5, stale-while-revalidate=30");
            res.json({
                ...data,
                _meta: {
                    cachedAt: cachedAt?.toISOString() || new Date().toISOString(),
                    lastSyncBlock,
                    lastSyncTime: lastSyncTime?.toISOString() || null,
                    isSyncing,
                },
            });
        } catch (error) {
            console.error("Failed to get home data:", error.message);
            res.status(500).json({ error: "Failed to fetch home data" });
        }
    });

    // API: Manually trigger prewarm (admin use)
    app.post("/api/prewarm", async (req, res) => {
        try {
            const { prewarmNftCache } = require("./sync.cjs");
            const result = await prewarmNftCache();
            res.json(result);
        } catch (error) {
            res.status(500).json({ error: "Prewarm failed" });
        }
    });

    // API: Force refresh NFT cache (invalidate and re-fetch)
    app.post("/api/nft/:id/refresh", async (req, res) => {
        try {
            const tokenId = parseInt(req.params.id, 10);
            if (isNaN(tokenId) || tokenId < 1) {
                return res.status(400).json({ error: "Invalid token ID" });
            }

            await pool.query("DELETE FROM nfts WHERE token_id = $1", [tokenId]);
            const nft = await getNFTData(tokenId);
            res.json(nft);
        } catch (error) {
            console.error("Failed to refresh NFT:", error.message);
            res.status(500).json({ error: "Failed to refresh NFT" });
        }
    });

    // API: Force sync events
    app.post("/api/sync/force", async (req, res) => {
        try {
            const result = await syncAllEvents();

            if (result.synced) {
                await rebuildDerivedData();
            }

            const { lastSyncBlock, lastSyncTime } = getSyncState();
            res.json({
                ...result,
                lastSyncBlock,
                lastSyncTime: lastSyncTime?.toISOString() || null,
            });
        } catch (error) {
            console.error("Force sync failed:", error.message);
            res.status(500).json({ error: "Sync failed" });
        }
    });

    // API: Full reset and resync from beginning (protected)
    app.post("/api/sync/reset", async (req, res) => {
        const adminSecret = process.env.ADMIN_SECRET;
        const providedSecret = req.headers["x-admin-secret"] || req.query.secret;

        if (!adminSecret || providedSecret !== adminSecret) {
            return res.status(403).json({ error: "Unauthorized" });
        }

        try {
            console.log("Full sync reset requested...");

            await pool.query("DELETE FROM events");
            await pool.query("DELETE FROM sync_status");
            await pool.query("DELETE FROM token_stats");
            await pool.query("DELETE FROM authors");

            console.log("All sync data cleared. Starting fresh sync...");

            const result = await syncAllEvents();

            if (result.synced) {
                await rebuildDerivedData({ skipLeaderboards: true });
            }

            res.json({
                reset: true,
                ...result,
                message: "Sync reset complete. Will continue syncing in background.",
            });
        } catch (error) {
            console.error("Sync reset failed:", error.message);
            res.status(500).json({ error: "Reset failed", message: error.message });
        }
    });

    // API: Batch get block timestamps
    app.post("/api/blocks/batch", async (req, res) => {
        try {
            const { blockNumbers } = req.body;
            if (!Array.isArray(blockNumbers) || blockNumbers.length === 0) {
                return res
                    .status(400)
                    .json({ error: "blockNumbers array required" });
            }

            const limitedNumbers = blockNumbers.slice(0, 100);

            const results = await Promise.allSettled(
                limitedNumbers.map((num) => getBlockTimestamp(parseInt(num, 10))),
            );

            const blocks = results.map((result, index) => ({
                blockNumber: limitedNumbers[index],
                timestamp: result.status === "fulfilled" ? result.value : null,
            }));

            res.json({ blocks });
        } catch (error) {
            res.status(500).json({ error: "Failed to fetch blocks" });
        }
    });
}

module.exports = { registerRoutes };
