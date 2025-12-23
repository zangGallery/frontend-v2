const express = require("express");
const path = require("path");
const compression = require("compression");
const { ethers } = require("ethers");

const app = express();
const PORT = process.env.PORT || 3000;

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

// Minimal ABI for uri() function
const ZANG_ABI = [
    {
        type: "function",
        name: "uri",
        inputs: [{ type: "uint256", name: "tokenId" }],
        outputs: [{ type: "string", name: "" }],
        stateMutability: "view",
    },
];

const ZANG_CONTRACT = "0x5541ff300e9b01176b953EA3153006e36D4BA273";
const BASE_RPC = `https://base-mainnet.g.alchemy.com/v2/${process.env.GATSBY_ALCHEMY_BASE_API_KEY || process.env.ALCHEMY_BASE_API_KEY}`;
const SITE_URL = process.env.SITE_URL || "https://zang.gallery";

// Check if request is from a bot
function isBot(userAgent) {
    if (!userAgent) return false;
    return BOT_USER_AGENTS.some((bot) =>
        userAgent.toLowerCase().includes(bot.toLowerCase())
    );
}

// Fetch NFT metadata from blockchain
async function fetchNFTMetadata(tokenId) {
    try {
        const provider = new ethers.providers.JsonRpcProvider(BASE_RPC);
        const contract = new ethers.Contract(ZANG_CONTRACT, ZANG_ABI, provider);

        const uri = await contract.uri(tokenId);

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

// Enable compression
app.use(compression());

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

// Serve static files from Gatsby build
app.use(express.static(path.join(__dirname, "public"), { extensions: ["html"] }));

// Handle client-side routing - serve index.html for non-file requests
app.get("*", (req, res) => {
    // Check if request is for a specific page directory
    const pagePath = path.join(__dirname, "public", req.path, "index.html");
    const filePath = path.join(__dirname, "public", req.path);

    // Try page directory first (e.g., /nft/ -> /nft/index.html)
    res.sendFile(pagePath, (err) => {
        if (err) {
            // Fall back to root index.html for client-side routing
            res.sendFile(path.join(__dirname, "public", "index.html"));
        }
    });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Serving static files from: ${path.join(__dirname, "public")}`);
});
