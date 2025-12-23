require("dotenv").config();
const express = require("express");
const path = require("path");
const compression = require("compression");
const http = require("http");
const { Server } = require("socket.io");
const { createPublicClient, http: viemHttp } = require("viem");
const { base } = require("viem/chains");
const { Pool } = require("pg");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" },
    transports: ["websocket", "polling"],
});
const PORT = process.env.PORT || 3000;

// Track sync state for freshness metadata
let lastSyncBlock = 0;
let lastSyncTime = null;
let isSyncing = false;

// Database connection pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes("railway")
        ? { rejectUnauthorized: false }
        : false,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
});

// Initialize database tables
async function initializeDatabase() {
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS nfts (
                token_id BIGINT PRIMARY KEY,
                uri TEXT NOT NULL,
                author VARCHAR(42) NOT NULL,
                name TEXT,
                description TEXT,
                text_uri TEXT,
                content_type VARCHAR(50),
                content TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_nfts_author ON nfts(author);

            CREATE TABLE IF NOT EXISTS blocks (
                block_number BIGINT PRIMARY KEY,
                timestamp BIGINT NOT NULL,
                created_at TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS events (
                id SERIAL PRIMARY KEY,
                tx_hash VARCHAR(66) NOT NULL,
                log_index INTEGER NOT NULL,
                block_number BIGINT NOT NULL,
                event_type VARCHAR(50) NOT NULL,
                token_id BIGINT NOT NULL,
                data JSONB NOT NULL,
                created_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(tx_hash, log_index)
            );
            CREATE INDEX IF NOT EXISTS idx_events_token_id ON events(token_id);
            CREATE INDEX IF NOT EXISTS idx_events_block ON events(block_number);
            CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);

            CREATE TABLE IF NOT EXISTS sync_status (
                key VARCHAR(50) PRIMARY KEY,
                last_block BIGINT NOT NULL,
                updated_at TIMESTAMP DEFAULT NOW()
            );

            -- Derived data: token stats (computed from events)
            CREATE TABLE IF NOT EXISTS token_stats (
                token_id BIGINT PRIMARY KEY,
                mint_block BIGINT,
                mint_timestamp BIGINT,
                transfer_count INT DEFAULT 0,
                last_sale_price TEXT,
                last_sale_block BIGINT,
                updated_at TIMESTAMP DEFAULT NOW()
            );

            -- Derived data: author profiles
            CREATE TABLE IF NOT EXISTS authors (
                address VARCHAR(42) PRIMARY KEY,
                total_minted INT DEFAULT 0,
                first_mint_block BIGINT,
                first_mint_timestamp BIGINT,
                updated_at TIMESTAMP DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_authors_minted ON authors(total_minted DESC);
        `);
        console.log("Database tables initialized");
    } catch (error) {
        console.error("Failed to initialize database:", error.message);
    } finally {
        client.release();
    }
}

// Bot user-agents for social media crawlers
const BOT_USER_AGENTS = [
    "Twitterbot",
    "facebookexternalhit",
    "LinkedInBot",
    "Slackbot",
    "TelegramBot",
    "WhatsApp",
    "Discordbot",
    "Googlebot",
    "bingbot",
    "Embedly",
    "Quora Link Preview",
    "Showyoubot",
    "outbrain",
    "pinterest",
    "applebot",
    "redditbot",
];

// Minimal ABI for uri() and authorOf() functions
const ZANG_ABI = [
    {
        type: "function",
        name: "uri",
        inputs: [{ type: "uint256", name: "tokenId" }],
        outputs: [{ type: "string", name: "" }],
        stateMutability: "view",
    },
    {
        type: "function",
        name: "authorOf",
        inputs: [{ type: "uint256", name: "_tokenId" }],
        outputs: [{ type: "address", name: "" }],
        stateMutability: "view",
    },
];

const ZANG_CONTRACT = "0x5541ff300e9b01176b953EA3153006e36D4BA273";
const ALCHEMY_KEY =
    process.env.ALCHEMY_BASE_API_KEY || process.env.VITE_ALCHEMY_BASE_API_KEY;
const BASE_RPC = ALCHEMY_KEY
    ? `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`
    : "https://mainnet.base.org";
const SITE_URL = process.env.SITE_URL || "https://zang.gallery";

// Create viem public client for Base
const publicClient = createPublicClient({
    chain: base,
    transport: viemHttp(BASE_RPC),
});

// Check if request is from a bot
function isBot(userAgent) {
    if (!userAgent) return false;
    return BOT_USER_AGENTS.some((bot) =>
        userAgent.toLowerCase().includes(bot.toLowerCase()),
    );
}

// Fetch NFT metadata from blockchain
async function fetchNFTMetadata(tokenId) {
    try {
        const uri = await publicClient.readContract({
            address: ZANG_CONTRACT,
            abi: ZANG_ABI,
            functionName: "uri",
            args: [BigInt(tokenId)],
        });

        // Handle data URIs or HTTP URIs
        let metadata;
        if (uri.startsWith("data:")) {
            // Parse data URI (format: data:application/json;base64,... or data:application/json,...)
            const commaIndex = uri.indexOf(",");
            const header = uri.substring(0, commaIndex);
            const data = uri.substring(commaIndex + 1);

            if (header.includes("base64")) {
                metadata = JSON.parse(Buffer.from(data, "base64").toString());
            } else {
                metadata = JSON.parse(decodeURIComponent(data));
            }
        } else {
            // Fetch from HTTP URL
            const response = await fetch(uri);
            metadata = await response.json();
        }

        return metadata;
    } catch (error) {
        console.error(`Failed to fetch NFT ${tokenId}:`, error.message);
        return null;
    }
}

// Generate HTML with OpenGraph tags
function generateOGPage(tokenId, metadata) {
    const title = metadata?.name || `NFT #${tokenId}`;
    const description =
        metadata?.description || "A text-based NFT on zang.gallery";
    const image = metadata?.image || `${SITE_URL}/logo_white.png`;
    const url = `${SITE_URL}/nft?id=${tokenId}`;

    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>${escapeHtml(title)} | zang.gallery</title>

    <!-- OpenGraph -->
    <meta property="og:type" content="website">
    <meta property="og:url" content="${url}">
    <meta property="og:title" content="${escapeHtml(title)}">
    <meta property="og:description" content="${escapeHtml(description)}">
    <meta property="og:image" content="${escapeHtml(image)}">
    <meta property="og:site_name" content="zang.gallery">

    <!-- Twitter -->
    <meta name="twitter:card" content="summary">
    <meta name="twitter:url" content="${url}">
    <meta name="twitter:title" content="${escapeHtml(title)}">
    <meta name="twitter:description" content="${escapeHtml(description)}">
    <meta name="twitter:image" content="${escapeHtml(image)}">

    <!-- Redirect browsers to actual page -->
    <meta http-equiv="refresh" content="0;url=${url}">
</head>
<body>
    <p>Redirecting to <a href="${url}">${escapeHtml(title)}</a>...</p>
</body>
</html>`;
}

function escapeHtml(text) {
    if (!text) return "";
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Fetch NFT content from text_uri
async function fetchNFTContent(textUri) {
    try {
        if (!textUri) return { content: null, contentType: null };

        // Handle data URIs
        if (textUri.startsWith("data:")) {
            const commaIndex = textUri.indexOf(",");
            const header = textUri.substring(0, commaIndex);
            const data = textUri.substring(commaIndex + 1);

            // Extract content type
            const contentType = header.split(";")[0].replace("data:", "");

            // Handle encoding
            let content;
            if (header.includes("base64")) {
                content = Buffer.from(data, "base64").toString("utf-8");
            } else {
                content = decodeURIComponent(
                    data.replace("charset=UTF-8,", ""),
                );
            }

            return { content, contentType };
        }

        // Fetch from HTTP URL
        const response = await fetch(textUri);
        const content = await response.text();
        const contentType =
            response.headers.get("content-type")?.split(";")[0] || "text/plain";

        return { content, contentType };
    } catch (error) {
        console.error("Failed to fetch NFT content:", error.message);
        return { content: null, contentType: null };
    }
}

// Validate Ethereum address format
function isValidAddress(address) {
    return (
        typeof address === "string" &&
        address.length === 42 &&
        address.startsWith("0x") &&
        /^0x[a-fA-F0-9]{40}$/.test(address)
    );
}

// Validate NFT data before caching
function validateNftData(data) {
    const errors = [];

    if (!isValidAddress(data.author)) {
        errors.push(`Invalid author address: ${data.author}`);
    }

    if (!data.uri || typeof data.uri !== "string") {
        errors.push("Missing or invalid URI");
    }

    // Content size limit (10MB)
    if (data.content && data.content.length > 10 * 1024 * 1024) {
        errors.push("Content exceeds 10MB limit");
    }

    return errors;
}

// Get NFT from DB or fetch from blockchain and cache
async function getNFTData(tokenId) {
    // Check cache first
    const cached = await pool.query("SELECT * FROM nfts WHERE token_id = $1", [
        tokenId,
    ]);

    // Return cached data only if it's complete (has content)
    // Incomplete entries (from failed fetches) are treated as cache misses
    if (cached.rows.length > 0 && cached.rows[0].content !== null) {
        return cached.rows[0];
    }

    // Delete incomplete entry if exists (will be replaced with fresh data)
    if (cached.rows.length > 0) {
        await pool.query("DELETE FROM nfts WHERE token_id = $1", [tokenId]);
    }

    // Fetch from blockchain
    try {
        const [uri, author] = await Promise.all([
            publicClient.readContract({
                address: ZANG_CONTRACT,
                abi: ZANG_ABI,
                functionName: "uri",
                args: [BigInt(tokenId)],
            }),
            publicClient.readContract({
                address: ZANG_CONTRACT,
                abi: ZANG_ABI,
                functionName: "authorOf",
                args: [BigInt(tokenId)],
            }),
        ]);

        // Fetch metadata
        const metadata = await fetchNFTMetadata(tokenId);

        // Fetch content
        const textUri = metadata?.text_uri;
        const { content, contentType } = await fetchNFTContent(textUri);

        // Validate data before caching
        const validationErrors = validateNftData({ uri, author, content });
        if (validationErrors.length > 0) {
            console.error(
                `NFT ${tokenId} validation failed:`,
                validationErrors.join(", "),
            );
            throw new Error(
                `Validation failed: ${validationErrors.join(", ")}`,
            );
        }

        // Only cache if we have complete data (content is required)
        if (content === null) {
            // Return partial data without caching - next request will retry
            return {
                token_id: tokenId.toString(),
                uri,
                author,
                name: metadata?.name || null,
                description: metadata?.description || null,
                text_uri: textUri || null,
                content_type: contentType,
                content: null,
            };
        }

        // Cache complete data in database
        const result = await pool.query(
            `INSERT INTO nfts (token_id, uri, author, name, description, text_uri, content_type, content)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (token_id) DO UPDATE SET
                uri = EXCLUDED.uri,
                author = EXCLUDED.author,
                name = EXCLUDED.name,
                description = EXCLUDED.description,
                text_uri = EXCLUDED.text_uri,
                content_type = EXCLUDED.content_type,
                content = EXCLUDED.content
             RETURNING *`,
            [
                tokenId,
                uri,
                author,
                metadata?.name || null,
                metadata?.description || null,
                textUri || null,
                contentType,
                content,
            ],
        );

        return result.rows[0];
    } catch (error) {
        console.error(`Failed to fetch NFT ${tokenId}:`, error.message);
        throw error;
    }
}

// Get block timestamp from DB or fetch from RPC
async function getBlockTimestamp(blockNumber) {
    // Check cache first
    const cached = await pool.query(
        "SELECT timestamp FROM blocks WHERE block_number = $1",
        [blockNumber],
    );

    if (cached.rows.length > 0) {
        return cached.rows[0].timestamp;
    }

    // Fetch from RPC
    try {
        const block = await publicClient.getBlock({
            blockNumber: BigInt(blockNumber),
        });
        const timestamp = Number(block.timestamp);

        // Cache in database
        await pool.query(
            `INSERT INTO blocks (block_number, timestamp)
             VALUES ($1, $2)
             ON CONFLICT (block_number) DO NOTHING`,
            [blockNumber, timestamp],
        );

        return timestamp;
    } catch (error) {
        console.error(`Failed to fetch block ${blockNumber}:`, error.message);
        throw error;
    }
}

// Enable compression
app.use(compression());

// JSON parsing for API routes
app.use(express.json());

// API: Get NFT data (immutable, cached)
app.get("/api/nft/:id", async (req, res) => {
    try {
        const tokenId = parseInt(req.params.id, 10);
        if (isNaN(tokenId) || tokenId < 1) {
            return res.status(400).json({ error: "Invalid token ID" });
        }

        const nft = await getNFTData(tokenId);
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

        // Limit batch size
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

// Contract addresses and ABIs for event fetching
const MARKETPLACE_ADDRESS = "0xbD5C4612084eA90847DeB475529aC74B3521498d";
const FIRST_ZANG_BLOCK = 5300011;
const FIRST_MARKETPLACE_BLOCK = 5300368;

const MARKETPLACE_ABI = [
    {
        type: "event",
        name: "TokenListed",
        inputs: [
            { name: "_tokenId", type: "uint256", indexed: true },
            { name: "_seller", type: "address", indexed: true },
            { name: "_listingId", type: "uint256", indexed: false },
            { name: "amount", type: "uint256", indexed: false },
            { name: "_price", type: "uint256", indexed: false },
        ],
    },
    {
        type: "event",
        name: "TokenDelisted",
        inputs: [
            { name: "_tokenId", type: "uint256", indexed: true },
            { name: "_seller", type: "address", indexed: true },
            { name: "_listingId", type: "uint256", indexed: false },
        ],
    },
    {
        type: "event",
        name: "TokenPurchased",
        inputs: [
            { name: "_tokenId", type: "uint256", indexed: true },
            { name: "_buyer", type: "address", indexed: true },
            { name: "_seller", type: "address", indexed: true },
            { name: "_listingId", type: "uint256", indexed: false },
            { name: "_amount", type: "uint256", indexed: false },
            { name: "_price", type: "uint256", indexed: false },
        ],
    },
];

const ZANG_TRANSFER_ABI = [
    {
        type: "event",
        name: "TransferSingle",
        inputs: [
            { name: "operator", type: "address", indexed: true },
            { name: "from", type: "address", indexed: true },
            { name: "to", type: "address", indexed: true },
            { name: "id", type: "uint256", indexed: false },
            { name: "value", type: "uint256", indexed: false },
        ],
    },
];

// Sync all events globally (efficient - only incremental)
async function syncAllEvents() {
    if (isSyncing) {
        return { synced: false, reason: "already syncing" };
    }
    isSyncing = true;

    try {
        const syncKey = "global_events";

        // Get last synced block
        const syncResult = await pool.query(
            "SELECT last_block FROM sync_status WHERE key = $1",
            [syncKey],
        );

        const currentBlock = Number(await publicClient.getBlockNumber());
        const lastSyncedBlock = syncResult.rows.length > 0
            ? Number(syncResult.rows[0].last_block)
            : FIRST_ZANG_BLOCK - 1;

        // Only sync if there are new blocks
        if (currentBlock <= lastSyncedBlock) {
            lastSyncBlock = lastSyncedBlock;
            lastSyncTime = lastSyncTime || new Date();
            return { synced: false, lastBlock: lastSyncedBlock };
        }

        // Limit batch size to avoid RPC limits (500k blocks max)
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

        // Fetch ALL events in parallel (efficient - one RPC call per event type)
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

        // Debug: log event counts by type
        console.log(`Event counts: TransferSingle=${transferEvents.length}, TokenListed=${listEvents.length}, TokenDelisted=${delistEvents.length}, TokenPurchased=${purchaseEvents.length}`);

        // Prepare all events with their token IDs
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

        // Batch insert events
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

        // Update sync status
        await pool.query(
            `INSERT INTO sync_status (key, last_block) VALUES ($1, $2)
             ON CONFLICT (key) DO UPDATE SET last_block = $2, updated_at = NOW()`,
            [syncKey, toBlockNum],
        );

        console.log(
            `Synced ${allEvents.length} events up to block ${toBlockNum}`,
        );

        // Update global sync state
        lastSyncBlock = toBlockNum;
        lastSyncTime = new Date();

        // Emit new events via WebSocket
        if (allEvents.length > 0) {
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

    // Get mint events (TransferSingle from 0x0 address)
    const mints = await pool.query(`
        SELECT token_id, block_number, data
        FROM events
        WHERE event_type = 'TransferSingle'
          AND data->>'from' = '0x0000000000000000000000000000000000000000'
        ORDER BY block_number ASC
    `);

    // Get transfer counts per token
    const transferCounts = await pool.query(`
        SELECT token_id, COUNT(*) as count
        FROM events
        WHERE event_type = 'TransferSingle'
        GROUP BY token_id
    `);
    const countMap = new Map(
        transferCounts.rows.map((r) => [r.token_id, parseInt(r.count, 10)]),
    );

    // Get last sale per token
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

    // Upsert token stats
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

    // Get author stats from nfts table
    const authorStats = await pool.query(`
        SELECT
            author as address,
            COUNT(*) as total_minted,
            MIN(created_at) as first_mint
        FROM nfts
        GROUP BY author
    `);

    // Get first mint blocks from events
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

// Pre-warm NFT cache by fetching all known tokens
async function prewarmNftCache() {
    console.log("Pre-warming NFT cache...");

    // Get all token IDs from mint events
    const mints = await pool.query(`
        SELECT DISTINCT token_id
        FROM events
        WHERE event_type = 'TransferSingle'
          AND data->>'from' = '0x0000000000000000000000000000000000000000'
        ORDER BY token_id
    `);

    // Check which tokens are not yet cached
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

    // Fetch in batches to avoid overwhelming the RPC
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

        // Small delay between batches to avoid rate limits
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

    // Get all unique block numbers from events
    const uniqueBlocks = await pool.query(`
        SELECT DISTINCT block_number FROM events ORDER BY block_number
    `);

    // Check which blocks are not yet cached
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

    // Fetch in batches
    const BATCH_SIZE = 10;
    let fetched = 0;

    for (let i = 0; i < uncachedBlocks.length; i += BATCH_SIZE) {
        const batch = uncachedBlocks.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(
            batch.map((bn) => getBlockTimestamp(parseInt(bn, 10))),
        );

        fetched += results.filter((r) => r.status === "fulfilled").length;

        // Small delay between batches
        if (i + BATCH_SIZE < uncachedBlocks.length) {
            await new Promise((resolve) => setTimeout(resolve, 200));
        }
    }

    console.log(`Block pre-warm complete: ${fetched} cached`);
    return { fetched, total: uncachedBlocks.length };
}

// Get events for a specific token (DB query only - fast!)
// NOTE: Does NOT trigger sync - reads from DB only for speed
async function getTokenEvents(tokenId) {
    const result = await pool.query(
        `SELECT event_type, block_number, tx_hash, log_index, data
         FROM events WHERE token_id = $1 ORDER BY block_number, log_index`,
        [tokenId],
    );

    return result.rows;
}

// Get recent events for activity page (DB query only - fast!)
// NOTE: Does NOT trigger sync - reads from DB only for speed
async function getRecentEvents(limit = 500) {
    const result = await pool.query(
        `SELECT event_type, block_number, tx_hash, log_index, token_id, data
         FROM events
         ORDER BY block_number DESC, log_index DESC LIMIT $1`,
        [limit],
    );

    return result.rows;
}

// API: Trigger sync (for manual/cron use)
app.post("/api/sync", async (req, res) => {
    try {
        const result = await syncAllEvents();
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

        // Calculate sync progress
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
        // Include freshness metadata
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

        // Calculate sync progress
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

        // Include freshness metadata so frontend knows how current data is
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
        res.json({
            uniqueArtists: parseInt(result.rows[0].artists, 10),
            totalNfts: parseInt(nftCount.rows[0].count, 10),
            totalEvents: parseInt(eventCount.rows[0].count, 10),
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

// API: Get author profile
app.get("/api/author/:address", async (req, res) => {
    try {
        const address = req.params.address.toLowerCase();

        // Get author stats
        const authorResult = await pool.query(
            "SELECT * FROM authors WHERE LOWER(address) = $1",
            [address],
        );

        // Get their NFTs
        const nftsResult = await pool.query(
            "SELECT token_id, name, description, content_type FROM nfts WHERE LOWER(author) = $1 ORDER BY token_id",
            [address],
        );

        res.json({
            author: authorResult.rows[0] || {
                address,
                total_minted: nftsResult.rows.length,
            },
            nfts: nftsResult.rows,
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch author" });
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

// API: Manually trigger prewarm (admin use)
app.post("/api/prewarm", async (req, res) => {
    try {
        const result = await prewarmNftCache();
        await updateAuthorStats();
        res.json(result);
    } catch (error) {
        console.error("Prewarm failed:", error.message);
        res.status(500).json({ error: "Prewarm failed" });
    }
});

// API: Force refresh NFT cache (invalidate and re-fetch)
// Use this after user performs an action (mint, transfer, etc.)
app.post("/api/nft/:id/refresh", async (req, res) => {
    try {
        const tokenId = parseInt(req.params.id, 10);
        if (isNaN(tokenId) || tokenId < 1) {
            return res.status(400).json({ error: "Invalid token ID" });
        }

        // Delete from cache to force re-fetch
        await pool.query("DELETE FROM nfts WHERE token_id = $1", [tokenId]);

        // Re-fetch fresh data
        const nft = await getNFTData(tokenId);

        res.json({ success: true, nft });
    } catch (error) {
        console.error(`Refresh NFT ${req.params.id} failed:`, error.message);
        res.status(500).json({ error: "Failed to refresh NFT" });
    }
});

// API: Force sync events (use after user performs blockchain action)
app.post("/api/sync/force", async (req, res) => {
    try {
        // Run sync immediately
        const result = await syncAllEvents();

        // Update derived data
        if (result.synced) {
            await updateTokenStats().catch(() => {});
            await updateAuthorStats().catch(() => {});
        }

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

// API: Full reset and resync from beginning (protected - requires ADMIN_SECRET)
app.post("/api/sync/reset", async (req, res) => {
    // Require admin secret for destructive operation
    const adminSecret = process.env.ADMIN_SECRET;
    const providedSecret = req.headers["x-admin-secret"] || req.query.secret;

    if (!adminSecret || providedSecret !== adminSecret) {
        return res.status(403).json({ error: "Unauthorized" });
    }

    try {
        console.log("Full sync reset requested...");

        // Clear all events and sync status
        await pool.query("DELETE FROM events");
        await pool.query("DELETE FROM sync_status");
        await pool.query("DELETE FROM token_stats");
        await pool.query("DELETE FROM authors");

        // Reset in-memory state
        lastSyncBlock = 0;
        lastSyncTime = null;
        isSyncing = false;

        console.log("All sync data cleared. Starting fresh sync...");

        // Run initial sync
        const result = await syncAllEvents();

        if (result.synced) {
            await updateTokenStats().catch(() => {});
            await updateAuthorStats().catch(() => {});
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

// WebSocket connection handling
io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    socket.on("disconnect", () => {
        console.log("Client disconnected:", socket.id);
    });

    // Allow clients to subscribe to specific token updates
    socket.on("subscribe", (tokenId) => {
        socket.join(`token:${tokenId}`);
    });

    socket.on("unsubscribe", (tokenId) => {
        socket.leave(`token:${tokenId}`);
    });
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

        // Limit batch size
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

// Handle /nft route for bots
app.get("/nft", async (req, res, next) => {
    const userAgent = req.headers["user-agent"];
    const tokenId = req.query.id;

    // Only intercept for bots with valid token ID
    if (isBot(userAgent) && tokenId) {
        const metadata = await fetchNFTMetadata(tokenId);
        const html = generateOGPage(tokenId, metadata);
        return res.type("html").send(html);
    }

    // For regular users, serve the static file
    next();
});

// Serve static files from Vite build
app.use(express.static(path.join(__dirname, "dist")));

// Handle client-side routing - serve index.html for non-file requests
app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "dist", "index.html"));
});

// Periodic background sync
let syncInterval = null;
const SYNC_INTERVAL_MS = 30000; // 30 seconds for normal sync
const HISTORICAL_SYNC_INTERVAL_MS = 5000; // 5 seconds during historical sync

async function startBackgroundSync() {
    // Initial sync
    console.log("Starting initial event sync...");
    try {
        const result = await syncAllEvents();
        console.log("Initial sync complete:", result);

        // Update derived data after sync
        await updateTokenStats().catch((e) =>
            console.error("Token stats update failed:", e.message),
        );
        await updateAuthorStats().catch((e) =>
            console.error("Author stats update failed:", e.message),
        );

        // Pre-warm block timestamps first (needed for history display)
        console.log("Starting block timestamp pre-warm...");
        await prewarmBlockTimestamps().catch((e) =>
            console.error("Block pre-warm failed:", e.message),
        );

        // Pre-warm NFT cache in background
        console.log("Starting NFT cache pre-warm...");
        prewarmNftCache()
            .then(async (warmResult) => {
                console.log("NFT pre-warm complete:", warmResult);
                await updateAuthorStats().catch((e) =>
                    console.error("Author stats update failed:", e.message),
                );
            })
            .catch((err) => console.error("NFT pre-warm failed:", err.message));
    } catch (err) {
        console.error("Initial sync failed:", err.message);
    }

    // Start periodic sync with dynamic interval
    const runSync = async () => {
        try {
            const result = await syncAllEvents();
            if (result.eventsCount > 0) {
                console.log(
                    `Background sync: ${result.eventsCount} new events`,
                );
                // Update derived data if new events
                await updateTokenStats().catch((e) => {});
                await updateAuthorStats().catch((e) => {});
            }
            // Use shorter interval during historical sync
            const nextInterval = result.needsMoreSync ? HISTORICAL_SYNC_INTERVAL_MS : SYNC_INTERVAL_MS;
            syncInterval = setTimeout(runSync, nextInterval);
        } catch (err) {
            console.error("Background sync error:", err.message);
            syncInterval = setTimeout(runSync, SYNC_INTERVAL_MS);
        }
    };
    syncInterval = setTimeout(runSync, SYNC_INTERVAL_MS);

    console.log("Background sync started (30s normal, 5s during historical catch-up)");
}

// Start server
async function startServer() {
    // Initialize database if DATABASE_URL is set
    if (process.env.DATABASE_URL) {
        await initializeDatabase();
    } else {
        console.log("DATABASE_URL not set - running without caching");
    }

    server.listen(PORT, async () => {
        console.log(`Server running on port ${PORT}`);
        console.log(
            `Serving static files from: ${path.join(__dirname, "dist")}`,
        );
        console.log(`WebSocket enabled`);

        if (process.env.DATABASE_URL) {
            console.log("Database caching enabled");
            startBackgroundSync();
        }
    });
}

startServer().catch(console.error);
