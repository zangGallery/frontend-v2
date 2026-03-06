require("dotenv").config();
const express = require("express");
const path = require("path");
const fs = require("fs").promises;
const compression = require("compression");
const http = require("http");
const { Server } = require("socket.io");
const ogGenerator = require("./og-generator.cjs");

const { pool, initializeDatabase } = require("./server/db.cjs");
const { fetchNFTMetadata, SITE_URL } = require("./server/blockchain.cjs");
const {
    getSyncState,
    syncAllEvents,
    updateAuthorStats,
    updateLeaderboards,
    buildHomePageCache,
    rebuildDerivedData,
    syncMarketplaceListings,
    prewarmNftCache,
    prewarmBlockTimestamps,
} = require("./server/sync.cjs");
const { isBot, generateOGPage, queueMissingOGImages, processOGQueue } = require("./server/og.cjs");
const { registerRoutes } = require("./server/routes.cjs");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" },
    transports: ["websocket", "polling"],
});
const PORT = process.env.PORT || 3000;

// Middleware
app.use(compression());
app.use(express.json());

// Register API routes
registerRoutes(app);

// WebSocket connection handling
io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    socket.on("disconnect", () => {
        console.log("Client disconnected:", socket.id);
    });

    socket.on("subscribe", (tokenId) => {
        socket.join(`token:${tokenId}`);
    });

    socket.on("unsubscribe", (tokenId) => {
        socket.leave(`token:${tokenId}`);
    });
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
        res.set("Cache-Control", "public, max-age=31536000, immutable");
        res.type("image/png");
        res.sendFile(imagePath);
    } catch {
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

        res.set("Cache-Control", "public, max-age=60");
        res.sendFile(path.join(__dirname, "dist", "logo_white.png"));
    }
});

// Handle /nft route for bots
app.get("/nft", async (req, res, next) => {
    const userAgent = req.headers["user-agent"];
    const tokenId = req.query.id;

    if (isBot(userAgent) && tokenId) {
        const metadata = await fetchNFTMetadata(tokenId);
        const html = generateOGPage(tokenId, metadata, SITE_URL);
        return res.type("html").send(html);
    }

    next();
});

// Serve static files from Vite build
app.use(express.static(path.join(__dirname, "dist")));

// Handle client-side routing
app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "dist", "index.html"));
});

// Background sync
const SYNC_INTERVAL_MS = 30000;
const HISTORICAL_SYNC_INTERVAL_MS = 5000;

async function startBackgroundSync() {
    // Initial sync
    console.log("Starting initial event sync...");
    try {
        const result = await syncAllEvents(io);
        console.log("Initial sync complete:", result);

        await rebuildDerivedData({ skipLeaderboards: true });

        // Pre-warm block timestamps (needed for history display)
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

                console.log("Starting OG image generation...");
                await queueMissingOGImages().catch((e) =>
                    console.error("OG queue failed:", e.message),
                );
                processOGQueue(ogGenerator).catch((e) =>
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

    // Periodic marketplace sync (every 60 seconds)
    const MARKETPLACE_SYNC_INTERVAL_MS = 60000;
    const runMarketplaceSync = async () => {
        try {
            await syncMarketplaceListings();
            await updateLeaderboards().catch(e =>
                console.error("Leaderboard update failed:", e.message));
            await buildHomePageCache().catch(e =>
                console.error("Home page cache build failed:", e.message));
        } catch (e) {
            console.error("Marketplace sync error:", e.message);
        }
        setTimeout(runMarketplaceSync, MARKETPLACE_SYNC_INTERVAL_MS);
    };
    setTimeout(runMarketplaceSync, MARKETPLACE_SYNC_INTERVAL_MS);

    // Periodic event sync with dynamic interval
    const runSync = async () => {
        try {
            const result = await syncAllEvents(io);
            if (result.eventsCount > 0) {
                console.log(
                    `Background sync: ${result.eventsCount} new events`,
                );
                await rebuildDerivedData();
                await queueMissingOGImages().catch(e =>
                    console.error("OG queue failed:", e.message));
                processOGQueue(ogGenerator).catch(e =>
                    console.error("OG processing failed:", e.message));
            }
            const nextInterval = result.needsMoreSync ? HISTORICAL_SYNC_INTERVAL_MS : SYNC_INTERVAL_MS;
            setTimeout(runSync, nextInterval);
        } catch (err) {
            console.error("Background sync error:", err.message);
            setTimeout(runSync, SYNC_INTERVAL_MS);
        }
    };
    setTimeout(runSync, SYNC_INTERVAL_MS);

    console.log("Background sync started (30s normal, 5s during historical catch-up)");
}

// Start server
async function startServer() {
    const ogImagesDir = path.join(__dirname, "og-images");
    await fs.mkdir(ogImagesDir, { recursive: true }).catch(() => {});
    console.log(`OG images directory: ${ogImagesDir}`);

    if (process.env.DATABASE_URL) {
        await initializeDatabase();
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

// Graceful shutdown
process.on("SIGTERM", async () => {
    console.log("SIGTERM received, shutting down gracefully...");
    server.close(() => console.log("HTTP server closed"));
    await ogGenerator.closeBrowser().catch(() => {});
    await pool.end().catch(() => {});
    console.log("Cleanup complete");
    process.exit(0);
});

startServer().catch(console.error);
