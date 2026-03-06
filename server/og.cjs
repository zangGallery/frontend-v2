const { pool } = require("./db.cjs");

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

function isBot(userAgent) {
    if (!userAgent) return false;
    return BOT_USER_AGENTS.some((bot) =>
        userAgent.toLowerCase().includes(bot.toLowerCase()),
    );
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

function generateOGPage(tokenId, metadata, siteUrl) {
    const title = metadata?.name || `NFT #${tokenId}`;
    const description =
        metadata?.description || "A text-based NFT on zang.gallery";
    const image = `${siteUrl}/og/${tokenId}.png`;
    const url = `${siteUrl}/nft?id=${tokenId}`;

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

// Queue NFTs for OG image generation
async function queueMissingOGImages() {
    const missing = await pool.query(`
        SELECT n.token_id FROM nfts n
        LEFT JOIN og_images o ON n.token_id = o.token_id
        WHERE o.token_id IS NULL
          AND n.content IS NOT NULL
    `);

    if (missing.rows.length === 0) {
        return { queued: 0 };
    }

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
async function processOGQueue(ogGenerator) {
    if (isProcessingOGQueue) {
        return { processed: 0, reason: "already processing" };
    }
    isProcessingOGQueue = true;

    try {
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
                await pool.query(
                    `UPDATE og_images SET status = 'generating' WHERE token_id = $1`,
                    [token_id]
                );

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

                const filePath = await ogGenerator.generateOGImage(
                    token_id,
                    content,
                    content_type,
                    { name, description }
                );

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

        const remaining = await pool.query(
            `SELECT COUNT(*) as count FROM og_images WHERE status = 'pending'`
        );
        if (parseInt(remaining.rows[0].count, 10) > 0) {
            setTimeout(() => processOGQueue(ogGenerator).catch(e =>
                console.error("OG queue batch failed:", e.message)), 2000);
        }

        return { processed };
    } finally {
        isProcessingOGQueue = false;
    }
}

module.exports = {
    isBot,
    generateOGPage,
    queueMissingOGImages,
    processOGQueue,
};
