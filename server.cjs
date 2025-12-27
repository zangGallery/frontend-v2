require("dotenv").config();
const express = require("express");
const path = require("path");
const fs = require("fs").promises;
const compression = require("compression");
const http = require("http");
const { Server } = require("socket.io");
const { createPublicClient, http: viemHttp, verifyMessage } = require("viem");
const { base } = require("viem/chains");
const { Pool } = require("pg");
const ogGenerator = require("./og-generator.cjs");

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

            -- Pre-computed home page cache (single row with complete JSON payload)
            CREATE TABLE IF NOT EXISTS home_page_cache (
                id INTEGER PRIMARY KEY DEFAULT 1,
                data JSONB NOT NULL,
                last_nft_id BIGINT NOT NULL,
                updated_at TIMESTAMP DEFAULT NOW()
            );

            -- Pre-computed leaderboards
            CREATE TABLE IF NOT EXISTS leaderboards (
                type VARCHAR(20) PRIMARY KEY,
                data JSONB NOT NULL,
                updated_at TIMESTAMP DEFAULT NOW()
            );

            -- User profiles (custom display names, bio, social links)
            CREATE TABLE IF NOT EXISTS profiles (
                address VARCHAR(42) PRIMARY KEY,
                name VARCHAR(50),
                bio VARCHAR(160),
                x_username VARCHAR(50),
                instagram_username VARCHAR(50),
                base_username VARCHAR(50),
                updated_at TIMESTAMP DEFAULT NOW()
            );

            -- OG image generation tracking
            CREATE TABLE IF NOT EXISTS og_images (
                token_id BIGINT PRIMARY KEY,
                status VARCHAR(20) DEFAULT 'pending',
                file_path TEXT,
                error TEXT,
                created_at TIMESTAMP DEFAULT NOW(),
                generated_at TIMESTAMP
            );

            -- Enhanced index for recent events
            CREATE INDEX IF NOT EXISTS idx_events_recent ON events(block_number DESC, log_index DESC);
            CREATE INDEX IF NOT EXISTS idx_og_status ON og_images(status);

            -- Indexes on JSON fields for fast user lookups (address queries)
            CREATE INDEX IF NOT EXISTS idx_events_to ON events ((LOWER(data->>'to'))) WHERE event_type = 'TransferSingle';
            CREATE INDEX IF NOT EXISTS idx_events_from ON events ((LOWER(data->>'from'))) WHERE event_type = 'TransferSingle';
            CREATE INDEX IF NOT EXISTS idx_events_buyer ON events ((LOWER(data->>'_buyer'))) WHERE event_type = 'TokenPurchased';
            CREATE INDEX IF NOT EXISTS idx_events_seller ON events ((LOWER(data->>'_seller'))) WHERE event_type = 'TokenPurchased';
            CREATE INDEX IF NOT EXISTS idx_events_lister ON events ((LOWER(data->>'_seller'))) WHERE event_type = 'TokenListed';
            CREATE INDEX IF NOT EXISTS idx_events_delister ON events ((LOWER(data->>'_seller'))) WHERE event_type = 'TokenDelisted';
        `);

        // Add new columns to token_stats if they don't exist
        await client.query(`
            DO $$ BEGIN
                ALTER TABLE token_stats ADD COLUMN IF NOT EXISTS total_supply BIGINT;
                ALTER TABLE token_stats ADD COLUMN IF NOT EXISTS floor_price TEXT;
                ALTER TABLE token_stats ADD COLUMN IF NOT EXISTS listed_count INTEGER DEFAULT 0;
                ALTER TABLE token_stats ADD COLUMN IF NOT EXISTS total_volume TEXT DEFAULT '0';
                ALTER TABLE token_stats ADD COLUMN IF NOT EXISTS royalty_recipient VARCHAR(42);
                ALTER TABLE token_stats ADD COLUMN IF NOT EXISTS royalty_bps INTEGER;
            EXCEPTION WHEN others THEN NULL;
            END $$;
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
const SITE_URL = process.env.SITE_URL || "https://www.zang.gallery";

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
    // Use generated OG image instead of metadata.image
    const image = `${SITE_URL}/og/${tokenId}.png`;
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
    <meta property="og:image" content="${image}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:site_name" content="zang.gallery">

    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:url" content="${url}">
    <meta name="twitter:title" content="${escapeHtml(title)}">
    <meta name="twitter:description" content="${escapeHtml(description)}">
    <meta name="twitter:image" content="${image}">

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

        // Fetch NFT data and stats in parallel
        const [nft, statsResult] = await Promise.all([
            getNFTData(tokenId),
            pool.query(
                `SELECT total_supply, floor_price, listed_count, total_volume, royalty_recipient, royalty_bps
                 FROM token_stats WHERE token_id = $1`,
                [tokenId]
            ),
        ]);

        // Merge stats into response
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

// Marketplace read functions for listing sync
const MARKETPLACE_READ_ABI = [
    {
        type: "function",
        name: "listingCount",
        inputs: [{ name: "_tokenId", type: "uint256" }],
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
    },
    {
        type: "function",
        name: "listings",
        inputs: [
            { name: "_tokenId", type: "uint256" },
            { name: "_index", type: "uint256" },
        ],
        outputs: [
            { name: "price", type: "uint256" },
            { name: "seller", type: "address" },
            { name: "amount", type: "uint256" },
        ],
        stateMutability: "view",
    },
];

// Zang totalSupply function
const ZANG_READ_ABI = [
    {
        type: "function",
        name: "totalSupply",
        inputs: [{ name: "_tokenId", type: "uint256" }],
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
    },
    {
        type: "function",
        name: "royaltyInfo",
        inputs: [
            { name: "_tokenId", type: "uint256" },
            { name: "_salePrice", type: "uint256" },
        ],
        outputs: [
            { name: "", type: "address" },
            { name: "", type: "uint256" },
        ],
        stateMutability: "view",
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

        // Always emit sync status update via WebSocket
        io.emit("syncStatus", {
            lastSyncBlock: toBlockNum,
            lastSyncTime: lastSyncTime.toISOString(),
            isSyncing: false,
            syncProgress: Math.round((toBlockNum / currentBlock) * 100),
            blocksRemaining: Math.max(0, currentBlock - toBlockNum),
            isCatchingUp,
        });

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

// Queue NFTs for OG image generation
async function queueMissingOGImages() {
    // Find NFTs that don't have OG images yet
    const missing = await pool.query(`
        SELECT n.token_id FROM nfts n
        LEFT JOIN og_images o ON n.token_id = o.token_id
        WHERE o.token_id IS NULL
          AND n.content IS NOT NULL
    `);

    if (missing.rows.length === 0) {
        return { queued: 0 };
    }

    // Queue them for generation
    for (const { token_id } of missing.rows) {
        await pool.query(
            `INSERT INTO og_images (token_id, status) VALUES ($1, 'pending')
             ON CONFLICT (token_id) DO NOTHING`,
            [token_id]
        );
    }

    console.log(`Queued ${missing.rows.length} NFTs for OG image generation`);
    return { queued: missing.rows.length };
}

// Process pending OG image generation queue
let isProcessingOGQueue = false;
async function processOGQueue() {
    if (isProcessingOGQueue) {
        return { processed: 0, reason: "already processing" };
    }
    isProcessingOGQueue = true;

    try {
        // Get pending items (limit to 5 per batch to avoid memory issues)
        const pending = await pool.query(
            `SELECT token_id FROM og_images WHERE status = 'pending' LIMIT 5`
        );

        if (pending.rows.length === 0) {
            return { processed: 0 };
        }

        console.log(`Processing ${pending.rows.length} OG images...`);
        let processed = 0;

        for (const { token_id } of pending.rows) {
            try {
                // Mark as generating
                await pool.query(
                    `UPDATE og_images SET status = 'generating' WHERE token_id = $1`,
                    [token_id]
                );

                // Get NFT data
                const nft = await pool.query(
                    `SELECT name, description, content, content_type FROM nfts WHERE token_id = $1`,
                    [token_id]
                );

                if (nft.rows.length === 0) {
                    await pool.query(
                        `UPDATE og_images SET status = 'failed', error = 'NFT not found' WHERE token_id = $1`,
                        [token_id]
                    );
                    continue;
                }

                const { name, description, content, content_type } = nft.rows[0];

                // Generate OG image
                const filePath = await ogGenerator.generateOGImage(
                    token_id,
                    content,
                    content_type,
                    { name, description }
                );

                // Mark as completed
                await pool.query(
                    `UPDATE og_images SET status = 'completed', file_path = $1, generated_at = NOW()
                     WHERE token_id = $2`,
                    [filePath, token_id]
                );

                processed++;
                console.log(`Generated OG image for token ${token_id}`);
            } catch (err) {
                console.error(`OG generation failed for token ${token_id}:`, err.message);
                await pool.query(
                    `UPDATE og_images SET status = 'failed', error = $1 WHERE token_id = $2`,
                    [err.message, token_id]
                );
            }
        }

        console.log(`Processed ${processed}/${pending.rows.length} OG images`);

        // If there are more pending, schedule another batch
        const remaining = await pool.query(
            `SELECT COUNT(*) as count FROM og_images WHERE status = 'pending'`
        );
        if (parseInt(remaining.rows[0].count, 10) > 0) {
            setTimeout(() => processOGQueue().catch(() => {}), 2000);
        }

        return { processed };
    } finally {
        isProcessingOGQueue = false;
    }
}

// Sync marketplace listings (floor prices, listing counts, total supply)
// This runs periodically to keep listing data fresh
async function syncMarketplaceListings() {
    console.log("Syncing marketplace listings...");

    try {
        // Get all token IDs from nfts table
        const tokens = await pool.query(
            "SELECT token_id FROM nfts WHERE content IS NOT NULL ORDER BY token_id DESC"
        );

        if (tokens.rows.length === 0) {
            console.log("No tokens to sync");
            return { synced: 0 };
        }

        const zeroAddress = "0x0000000000000000000000000000000000000000";
        let synced = 0;

        // Process in batches of 5 to avoid RPC rate limits
        const BATCH_SIZE = 5;
        for (let i = 0; i < tokens.rows.length; i += BATCH_SIZE) {
            const batch = tokens.rows.slice(i, i + BATCH_SIZE);

            await Promise.all(batch.map(async ({ token_id }) => {
                try {
                    // Get total supply, listing count, and royalty info in parallel
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
                            args: [BigInt(token_id), 10000n], // 10000 basis = 100%
                        }),
                    ]);

                    // Extract royalty info: [recipient, amount in basis points]
                    const royaltyRecipient = royaltyResult[0];
                    const royaltyBps = Number(royaltyResult[1]);

                    const count = Number(listingCount);
                    let floorPrice = null;
                    let listedCount = 0;

                    // If there are listings, find the floor price
                    if (count > 0) {
                        const listingPromises = [];
                        for (let j = 0; j < Math.min(count, 10); j++) { // Limit to first 10 listings
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

                    // Calculate total volume from purchase events in database
                    const volumeResult = await pool.query(`
                        SELECT COALESCE(SUM((data->>'_price')::numeric * (data->>'_amount')::numeric), 0) as volume_wei
                        FROM events
                        WHERE event_type = 'TokenPurchased' AND token_id = $1
                    `, [token_id]);
                    const totalVolume = volumeResult.rows[0].volume_wei || '0';

                    // Update token_stats
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

            // Small delay between batches to avoid rate limits
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

        // Calculate total volume from all purchase events
        const volumeResult = await pool.query(
            "SELECT data FROM events WHERE event_type = 'TokenPurchased'",
        );
        let totalVolumeWei = BigInt(0);
        for (const row of volumeResult.rows) {
            const price = BigInt(row.data._price || 0);
            const amount = BigInt(row.data._amount || 1);
            totalVolumeWei += price * amount;
        }
        // Convert to ETH string (18 decimals)
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

        // Run all independent queries in parallel for speed
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
            // Get author stats from authors table
            pool.query(
                "SELECT * FROM authors WHERE LOWER(address) = $1",
                [address],
            ),
            // Get custom profile name
            pool.query(
                "SELECT name FROM profiles WHERE LOWER(address) = $1",
                [address],
            ),
            // Get NFTs they created (with content and stats)
            pool.query(
                `SELECT n.token_id, n.name, n.description, n.content_type, n.content, n.author,
                        ts.total_supply, ts.floor_price, ts.listed_count, ts.total_volume
                 FROM nfts n
                 LEFT JOIN token_stats ts ON n.token_id = ts.token_id
                 WHERE LOWER(n.author) = $1
                 ORDER BY n.token_id DESC`,
                [address],
            ),
            // Get all tokens received (to = address)
            pool.query(
                `SELECT token_id, SUM((data->>'value')::bigint) as received
                 FROM events
                 WHERE event_type = 'TransferSingle'
                   AND LOWER(data->>'to') = $1
                 GROUP BY token_id`,
                [address],
            ),
            // Get all tokens sent (from = address)
            pool.query(
                `SELECT token_id, SUM((data->>'value')::bigint) as sent
                 FROM events
                 WHERE event_type = 'TransferSingle'
                   AND LOWER(data->>'from') = $1
                 GROUP BY token_id`,
                [address],
            ),
            // Calculate volume as buyer
            pool.query(
                `SELECT COALESCE(SUM((data->>'_price')::numeric * (data->>'_amount')::numeric), 0) as volume
                 FROM events
                 WHERE event_type = 'TokenPurchased'
                   AND LOWER(data->>'_buyer') = $1`,
                [address],
            ),
            // Calculate volume as seller
            pool.query(
                `SELECT COALESCE(SUM((data->>'_price')::numeric * (data->>'_amount')::numeric), 0) as volume
                 FROM events
                 WHERE event_type = 'TokenPurchased'
                   AND LOWER(data->>'_seller') = $1`,
                [address],
            ),
            // Get first activity (earliest event involving this address)
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

        // Calculate net balance per token
        const balanceMap = {};
        for (const row of receivedResult.rows) {
            balanceMap[row.token_id] = (balanceMap[row.token_id] || 0n) + BigInt(row.received);
        }
        for (const row of sentResult.rows) {
            balanceMap[row.token_id] = (balanceMap[row.token_id] || 0n) - BigInt(row.sent);
        }

        // Get token IDs with positive balance (excluding ones they authored)
        const createdTokenIds = new Set(createdResult.rows.map(r => r.token_id.toString()));
        const collectedTokenIds = Object.entries(balanceMap)
            .filter(([tokenId, balance]) => balance > 0n && !createdTokenIds.has(tokenId))
            .map(([tokenId]) => parseInt(tokenId, 10));

        // Fetch NFT data for collected tokens (with content and stats) - only if needed
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

        // Get timestamp for first activity block
        let firstActivityTimestamp = null;
        if (firstActivityResult.rows[0]?.first_block) {
            firstActivityTimestamp = await getBlockTimestamp(firstActivityResult.rows[0].first_block);
        }

        // Convert volumes from wei to ETH
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

        // Validate timestamp (within 5 minutes)
        const now = Date.now();
        if (Math.abs(now - timestamp) > 5 * 60 * 1000) {
            return res.status(400).json({ error: "Signature expired" });
        }

        // Sanitize and validate fields
        const cleanName = name?.trim().slice(0, 50) || null;
        const cleanBio = bio?.trim().slice(0, 160) || null;
        const cleanX = xUsername?.trim().replace(/^@/, "").slice(0, 50) || null;
        const cleanInstagram = instagramUsername?.trim().replace(/^@/, "").slice(0, 50) || null;
        const cleanBase = baseUsername?.trim().slice(0, 50) || null;

        // Validate name characters (alphanumeric + spaces + basic punctuation)
        if (cleanName && !/^[a-zA-Z0-9\s._-]+$/.test(cleanName)) {
            return res.status(400).json({ error: "Name contains invalid characters" });
        }

        // Validate usernames (alphanumeric + underscores + dots)
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

        // Construct the message that was signed (includes all fields for integrity)
        const profileData = JSON.stringify({
            name: cleanName,
            bio: cleanBio,
            xUsername: cleanX,
            instagramUsername: cleanInstagram,
            baseUsername: cleanBase,
        });
        const message = `Update my zang profile:\n\n${profileData}\n\nTimestamp: ${timestamp}`;

        // Verify the signature
        const isValid = await verifyMessage({
            address,
            message,
            signature,
        });

        if (!isValid) {
            return res.status(401).json({ error: "Invalid signature" });
        }

        // Update or insert the profile
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

        // Single query to get all events where user is involved
        // Uses existing indexes on to, from, _buyer, _seller
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

        // Get tx hashes that have purchases (to filter out redundant transfers)
        const purchaseTxHashes = new Set(
            result.rows
                .filter(r => r.event_type === 'TokenPurchased')
                .map(r => r.tx_hash)
        );

        // Transform events into user-friendly format
        const history = result.rows
            .filter(row => {
                // Filter out TransferSingle events that are part of a purchase
                if (row.event_type === 'TransferSingle' && purchaseTxHashes.has(row.tx_hash)) {
                    return false;
                }
                return true;
            })
            .map(row => {
                const data = row.data;
                let type, counterparty, amount, price;

                switch (row.event_type) {
                    case 'TransferSingle':
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

                    case 'TokenPurchased':
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

        // Get all unique artists (authors of NFTs)
        const artistsResult = await pool.query(
            `SELECT DISTINCT LOWER(author) as address FROM nfts`
        );

        const artists = [];

        for (const row of artistsResult.rows) {
            const address = row.address;

            // Count NFTs created
            const createdResult = await pool.query(
                `SELECT COUNT(*) as count FROM nfts WHERE LOWER(author) = $1`,
                [address]
            );
            const totalCreated = parseInt(createdResult.rows[0].count, 10);

            // Calculate volume as seller
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

        // Sort by volume (desc), then by totalCreated (desc)
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

        // Get all unique addresses that have received tokens (buyers/collectors)
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

            // Calculate net balance of collected tokens (excluding ones they authored)
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

            // Get tokens they authored (to exclude)
            const authoredResult = await pool.query(
                `SELECT token_id FROM nfts WHERE LOWER(author) = $1`,
                [address]
            );
            const authoredTokens = new Set(authoredResult.rows.map(r => r.token_id.toString()));

            // Calculate net balance
            const balanceMap = {};
            for (const r of receivedResult.rows) {
                balanceMap[r.token_id] = (balanceMap[r.token_id] || 0n) + BigInt(r.received);
            }
            for (const r of sentResult.rows) {
                balanceMap[r.token_id] = (balanceMap[r.token_id] || 0n) - BigInt(r.sent);
            }

            // Count collected tokens (positive balance, not authored by them)
            let totalCollected = 0;
            for (const [tokenId, balance] of Object.entries(balanceMap)) {
                if (balance > 0n && !authoredTokens.has(tokenId)) {
                    totalCollected++;
                }
            }

            // Calculate volume as buyer
            const volumeResult = await pool.query(
                `SELECT COALESCE(SUM((data->>'_price')::numeric * (data->>'_amount')::numeric), 0) as volume
                 FROM events
                 WHERE event_type = 'TokenPurchased'
                   AND LOWER(data->>'_buyer') = $1`,
                [address]
            );
            const volumeWei = BigInt(volumeResult.rows[0].volume || 0);
            const volumeEth = Number(volumeWei) / 1e18;

            // Only include if they have volume or collected something
            if (volumeEth > 0 || totalCollected > 0) {
                collectors.push({
                    address,
                    totalCollected,
                    volumeEth,
                });
            }
        }

        // Sort by volume (desc), then by totalCollected (desc)
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

// ============================================================
// HOME PAGE CACHE - Pre-computed unified endpoint
// ============================================================

// Build pre-computed leaderboards (top artists and collectors)
async function updateLeaderboards() {
    try {
        // Top Artists - single efficient SQL query (eliminates N+1)
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

        // Top Collectors - single efficient SQL query (eliminates N+1)
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
        // Get latest 12 NFTs with their stats (including content for preview)
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

        // Get last NFT ID
        const lastNftResult = await pool.query(
            "SELECT MAX(token_id) as last_id FROM nfts WHERE content IS NOT NULL"
        );
        const lastNftId = parseInt(lastNftResult.rows[0]?.last_id, 10) || 0;

        // Get stats
        const statsResult = await pool.query(`
            SELECT
                COUNT(*) as total_nfts,
                COUNT(DISTINCT author) as unique_artists
            FROM nfts
        `);

        // Get total volume
        const volumeResult = await pool.query(`
            SELECT COALESCE(SUM((data->>'_price')::numeric * (data->>'_amount')::numeric), 0) as volume_wei
            FROM events
            WHERE event_type = 'TokenPurchased'
        `);
        const totalVolumeEth = parseFloat(volumeResult.rows[0].volume_wei) / 1e18 || 0;

        // Get recent events (last 10)
        const eventsResult = await pool.query(`
            SELECT e.event_type, e.token_id, e.block_number, e.tx_hash, e.data, n.name as title, n.content_type
            FROM events e
            LEFT JOIN nfts n ON e.token_id = n.token_id
            ORDER BY e.block_number DESC, e.log_index DESC
            LIMIT 10
        `);

        // Get pre-computed leaderboards
        const artistsResult = await pool.query(
            "SELECT data FROM leaderboards WHERE type = 'artists'"
        );
        const collectorsResult = await pool.query(
            "SELECT data FROM leaderboards WHERE type = 'collectors'"
        );

        const cacheData = {
            lastNftId,
            nfts: nftsResult.rows.map(r => ({
                id: r.token_id,
                name: r.name,
                description: r.description,
                author: r.author,
                contentType: r.content_type,
                content: r.content, // Include content for immediate preview rendering
                totalSupply: r.total_supply ? parseInt(r.total_supply, 10) : null,
                floorPrice: r.floor_price,
                listedCount: r.listed_count || 0,
                totalVolume: r.total_volume || '0',
                transferCount: r.transfer_count || 0,
                lastSalePrice: r.last_sale_price,
            })),
            stats: {
                totalTexts: parseInt(statsResult.rows[0].total_nfts, 10),
                uniqueArtists: parseInt(statsResult.rows[0].unique_artists, 10),
                totalVolumeEth,
            },
            recentEvents: eventsResult.rows.map(r => {
                // Extract price from event data and convert wei to ETH
                let price = null;
                if (r.data && (r.event_type === 'TokenListed' || r.event_type === 'TokenPurchased')) {
                    const priceWei = r.data._price;
                    if (priceWei) {
                        price = (parseFloat(priceWei) / 1e18).toFixed(4);
                    }
                }
                return {
                    type: r.event_type,
                    tokenId: r.token_id,
                    title: r.title || `#${r.token_id}`,
                    blockNumber: r.block_number,
                    txHash: r.tx_hash,
                    price,
                    contentType: r.content_type,
                };
            }),
            topArtists: artistsResult.rows[0]?.data || [],
            topCollectors: collectorsResult.rows[0]?.data || [],
        };

        // Store in cache table
        await pool.query(`
            INSERT INTO home_page_cache (id, data, last_nft_id, updated_at)
            VALUES (1, $1, $2, NOW())
            ON CONFLICT (id) DO UPDATE SET data = $1, last_nft_id = $2, updated_at = NOW()
        `, [JSON.stringify(cacheData), lastNftId]);

        return cacheData;
    } catch (error) {
        console.error("Failed to build home page cache:", error.message);
        throw error;
    }
}

// API: Paginated gallery endpoint - returns NFTs with content and stats
app.get("/api/gallery", async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit, 10) || 12, 50);
        const offset = parseInt(req.query.offset, 10) || 0;
        const sort = req.query.sort || "newest";
        const contentType = req.query.type || "all";
        const listedOnly = req.query.listed === "yes";

        // Build WHERE conditions
        const conditions = ["n.content IS NOT NULL"];
        const params = [];
        let paramIndex = 1;

        // Content type filter
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

        // Listed filter
        if (listedOnly) {
            conditions.push(`COALESCE(ts.listed_count, 0) > 0`);
        }

        const whereClause = conditions.join(" AND ");

        // Build ORDER BY
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
            default: // newest
                orderBy = "n.token_id DESC";
        }

        // Get total count for filtered results
        const countResult = await pool.query(
            `SELECT COUNT(*) as total FROM nfts n
             LEFT JOIN token_stats ts ON n.token_id = ts.token_id
             WHERE ${whereClause}`,
            params
        );
        const totalCount = parseInt(countResult.rows[0]?.total || 0, 10);

        // Get NFTs with content and stats, paginated
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

// API: Unified home page endpoint - single call for all home data
app.get("/api/home", async (req, res) => {
    try {
        // Try to get from cache first
        const cacheResult = await pool.query(
            "SELECT data, updated_at FROM home_page_cache WHERE id = 1"
        );

        let data;
        let cachedAt;

        if (cacheResult.rows.length > 0) {
            data = cacheResult.rows[0].data;
            cachedAt = cacheResult.rows[0].updated_at;
        } else {
            // Cache miss - build it now (first request)
            await updateLeaderboards();
            data = await buildHomePageCache();
            cachedAt = new Date();
        }

        // Add freshness metadata
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

// Serve OG images with immutable caching
app.get("/og/:id.png", async (req, res) => {
    const tokenId = parseInt(req.params.id, 10);

    if (isNaN(tokenId) || tokenId < 1) {
        return res.status(400).send("Invalid token ID");
    }

    const imagePath = ogGenerator.getOGImagePath(tokenId);

    try {
        await fs.access(imagePath);
        // NFTs are immutable - cache forever
        res.set("Cache-Control", "public, max-age=31536000, immutable");
        res.type("image/png");
        res.sendFile(imagePath);
    } catch {
        // Image not generated yet - try to generate it on-demand
        try {
            const nft = await pool.query(
                "SELECT name, description, content, content_type FROM nfts WHERE token_id = $1",
                [tokenId],
            );

            if (nft.rows.length > 0) {
                const { name, description, content, content_type } = nft.rows[0];
                await ogGenerator.generateOGImage(tokenId, content, content_type, {
                    name,
                    description,
                });

                // Update database
                await pool.query(
                    `INSERT INTO og_images (token_id, status, generated_at)
                     VALUES ($1, 'completed', NOW())
                     ON CONFLICT (token_id) DO UPDATE SET status = 'completed', generated_at = NOW()`,
                    [tokenId],
                );

                res.set("Cache-Control", "public, max-age=31536000, immutable");
                res.type("image/png");
                return res.sendFile(imagePath);
            }
        } catch (genError) {
            console.error(`OG generation failed for token ${tokenId}:`, genError.message);
        }

        // Fallback to default logo with short cache
        res.set("Cache-Control", "public, max-age=60");
        res.sendFile(path.join(__dirname, "dist", "logo_white.png"));
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

                // Queue and process OG images after NFT data is available
                console.log("Starting OG image generation...");
                await queueMissingOGImages().catch((e) =>
                    console.error("OG queue failed:", e.message),
                );
                processOGQueue().catch((e) =>
                    console.error("OG processing failed:", e.message),
                );
            })
            .catch((err) => console.error("NFT pre-warm failed:", err.message));
    } catch (err) {
        console.error("Initial sync failed:", err.message);
    }

    // Sync marketplace listings (floor prices, supply)
    console.log("Starting initial marketplace sync...");
    syncMarketplaceListings()
        .then(() => console.log("Initial marketplace sync complete"))
        .catch(e => console.error("Marketplace sync failed:", e.message));

    // Build initial home page cache
    console.log("Building initial home page cache...");
    try {
        await updateLeaderboards();
        await buildHomePageCache();
        console.log("Home page cache built");
    } catch (e) {
        console.error("Initial cache build failed:", e.message);
    }

    // Start periodic marketplace sync (every 60 seconds)
    const MARKETPLACE_SYNC_INTERVAL_MS = 60000;
    const runMarketplaceSync = async () => {
        try {
            await syncMarketplaceListings();
            // Rebuild home page cache after marketplace sync
            await buildHomePageCache().catch(() => {});
        } catch (e) {
            console.error("Marketplace sync error:", e.message);
        }
        setTimeout(runMarketplaceSync, MARKETPLACE_SYNC_INTERVAL_MS);
    };
    setTimeout(runMarketplaceSync, MARKETPLACE_SYNC_INTERVAL_MS);

    // Start periodic event sync with dynamic interval
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
                // Rebuild home page cache
                await updateLeaderboards().catch((e) => {});
                await buildHomePageCache().catch((e) => {});
                // Queue OG images for new mints
                await queueMissingOGImages().catch((e) => {});
                processOGQueue().catch((e) => {});
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
    // Create og-images directory
    const ogImagesDir = path.join(__dirname, "og-images");
    await fs.mkdir(ogImagesDir, { recursive: true }).catch(() => {});
    console.log(`OG images directory: ${ogImagesDir}`);

    // Initialize database if DATABASE_URL is set
    if (process.env.DATABASE_URL) {
        await initializeDatabase();
        // Initialize Playwright browser for OG generation
        await ogGenerator.initBrowser().catch((e) =>
            console.error("OG browser init failed:", e.message)
        );
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
