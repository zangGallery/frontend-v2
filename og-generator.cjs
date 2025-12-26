/**
 * OG Image Generator using Playwright
 * Generates pixel-perfect screenshots of NFT artwork for social media previews
 */

const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs").promises;

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;

// Singleton browser instance
let browser = null;

// DOMPurify configuration for server-side (matches HTMLViewer.jsx)
const ALLOWED_TAGS = [
    "html", "head", "body", "div", "span", "p", "br", "hr",
    "h1", "h2", "h3", "h4", "h5", "h6",
    "ul", "ol", "li", "dl", "dt", "dd",
    "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption",
    "article", "section", "nav", "aside", "header", "footer", "main",
    "figure", "figcaption", "details", "summary",
    "a", "strong", "b", "em", "i", "u", "s", "mark", "small", "sub", "sup",
    "blockquote", "q", "cite", "code", "pre", "kbd", "var", "samp",
    "img", "audio", "video", "source", "track", "picture",
    "style",
    "svg", "g", "path", "rect", "circle", "ellipse", "line", "polyline", "polygon",
    "text", "tspan", "textPath", "defs", "use", "symbol", "clipPath", "mask",
    "pattern", "linearGradient", "radialGradient", "stop", "filter",
    "feGaussianBlur", "feOffset", "feBlend", "feColorMatrix", "feComposite",
    "feMerge", "feMergeNode", "feFlood", "image", "title", "desc",
];

/**
 * Initialize the browser instance
 */
async function initBrowser() {
    if (!browser) {
        browser = await chromium.launch({
            args: ["--no-sandbox", "--disable-setuid-sandbox"],
        });
        console.log("OG Generator: Browser initialized");
    }
    return browser;
}

/**
 * Close the browser instance
 */
async function closeBrowser() {
    if (browser) {
        await browser.close();
        browser = null;
        console.log("OG Generator: Browser closed");
    }
}

/**
 * Escape HTML entities
 */
function escapeHtml(text) {
    if (!text) return "";
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/**
 * Get base styles for OG image
 */
function getBaseStyles() {
    return `
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Inter:wght@400;500;600;700&display=swap');

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        html, body {
            width: ${OG_WIDTH}px;
            height: ${OG_HEIGHT}px;
            overflow: hidden;
            background: linear-gradient(135deg, #18181b 0%, #09090b 100%);
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        }

        .og-container {
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
        }

        .og-artwork {
            flex: 1;
            overflow: hidden;
            padding: 32px;
        }

        .og-footer {
            height: 80px;
            padding: 0 32px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            background: rgba(0, 0, 0, 0.3);
            border-top: 1px solid #27272a;
        }

        .og-title {
            color: #fafafa;
            font-size: 24px;
            font-weight: 600;
            max-width: 70%;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .og-meta {
            display: flex;
            align-items: center;
            gap: 16px;
        }

        .og-badge {
            padding: 8px 16px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            color: white;
        }

        .og-badge-txt { background: #3b82f6; }
        .og-badge-md { background: #8b5cf6; }
        .og-badge-html { background: #f59e0b; }

        .og-brand {
            color: #71717a;
            font-size: 16px;
            font-weight: 500;
        }
    `;
}

/**
 * Template for plain text content
 * - Short text: large font, centered
 * - ASCII art (wide lines): fit to width
 * - Long prose/poetry: show first ~10 lines at readable size
 */
function getPlainTextTemplate(content, metadata) {
    const escapedName = escapeHtml(metadata.name || `#${metadata.tokenId}`);

    const allLines = content.split('\n');
    const nonEmptyLines = allLines.filter(l => l.trim().length > 0);
    const lineCount = nonEmptyLines.length || 1;
    const maxLineLength = Math.max(...allLines.map(l => l.length), 1);
    const totalChars = content.length;

    const availableWidth = OG_WIDTH - 64;
    const availableHeight = OG_HEIGHT - 80 - 64;
    const charWidthRatio = 0.6;

    // Detect content type
    const isShortText = lineCount <= 5 && maxLineLength < 60 && totalChars < 300;
    // ASCII art: very wide lines (80+) that need to preserve exact formatting
    const isAsciiArt = maxLineLength > 80;
    const isLongProse = !isAsciiArt && !isShortText && lineCount > 8;

    let displayContent = content;
    let fontSize;
    let centered = false;
    let showFade = false;

    if (isShortText) {
        // Short text: large font, centered
        fontSize = Math.floor(availableWidth / (maxLineLength * charWidthRatio));
        fontSize = Math.min(fontSize, Math.floor(availableHeight / (lineCount * 1.5)));
        fontSize = Math.max(32, Math.min(72, fontSize));
        centered = true;
    } else if (isAsciiArt) {
        // ASCII art: fit to width, preserve structure
        fontSize = Math.floor(availableWidth / (maxLineLength * charWidthRatio));
        fontSize = Math.max(8, Math.min(24, fontSize));
        const maxFontSizeForHeight = Math.floor(availableHeight / (lineCount * 1.4));
        fontSize = Math.min(fontSize, maxFontSizeForHeight);
        fontSize = Math.max(8, fontSize);
    } else if (isLongProse) {
        // Long prose: fill the space with readable text, fade at bottom
        // Calculate how many lines fit at a readable size (20px)
        fontSize = 20;
        const lineHeightPx = fontSize * 1.6;
        const maxLines = Math.floor(availableHeight / lineHeightPx);

        const truncatedLines = allLines.slice(0, maxLines);
        displayContent = truncatedLines.join('\n');
        showFade = allLines.length > maxLines;
    } else {
        // Medium content: fit naturally
        fontSize = Math.floor(availableWidth / (maxLineLength * charWidthRatio));
        fontSize = Math.max(14, Math.min(24, fontSize));
        const maxFontSizeForHeight = Math.floor(availableHeight / (lineCount * 1.4));
        fontSize = Math.min(fontSize, maxFontSizeForHeight);
        fontSize = Math.max(14, fontSize);
    }

    const escapedContent = escapeHtml(displayContent);

    const centerStyles = centered ? `
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;
    ` : '';

    const fadeOverlay = showFade ? `
        <div class="fade-overlay"></div>
        <div class="more-indicator">...</div>
    ` : '';

    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        ${getBaseStyles()}

        .og-artwork {
            color: #e4e4e7;
            font-family: 'JetBrains Mono', monospace;
            font-size: ${fontSize}px;
            line-height: ${centered ? 1.5 : 1.6};
            white-space: pre;
            overflow: hidden;
            position: relative;
            ${centerStyles}
        }

        .fade-overlay {
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            height: 150px;
            background: linear-gradient(to bottom, transparent 0%, #18181b 80%);
            pointer-events: none;
        }

        .more-indicator {
            position: absolute;
            bottom: 16px;
            left: 32px;
            color: #71717a;
            font-size: 32px;
            font-weight: bold;
            letter-spacing: 4px;
        }
    </style>
</head>
<body>
    <div class="og-container">
        <div class="og-artwork">${escapedContent}${fadeOverlay}</div>
        <div class="og-footer">
            <span class="og-title">${escapedName}</span>
            <div class="og-meta">
                <span class="og-badge og-badge-txt">TXT</span>
                <span class="og-brand">zang.gallery</span>
            </div>
        </div>
    </div>
</body>
</html>`;
}

/**
 * Template for markdown content
 */
function getMarkdownTemplate(content, metadata) {
    // Simple markdown to HTML conversion for common elements
    let html = escapeHtml(content)
        // Headers
        .replace(/^### (.+)$/gm, "<h3>$1</h3>")
        .replace(/^## (.+)$/gm, "<h2>$1</h2>")
        .replace(/^# (.+)$/gm, "<h1>$1</h1>")
        // Bold and italic
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.+?)\*/g, "<em>$1</em>")
        .replace(/__(.+?)__/g, "<strong>$1</strong>")
        .replace(/_(.+?)_/g, "<em>$1</em>")
        // Code
        .replace(/`(.+?)`/g, "<code>$1</code>")
        // Line breaks
        .replace(/\n\n/g, "</p><p>")
        .replace(/\n/g, "<br>");

    html = `<p>${html}</p>`;

    const escapedName = escapeHtml(metadata.name || `#${metadata.tokenId}`);

    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        ${getBaseStyles()}

        .og-artwork {
            color: #e4e4e7;
            font-size: 20px;
            line-height: 1.7;
        }

        .og-artwork h1, .og-artwork h2, .og-artwork h3 {
            color: #fafafa;
            margin-bottom: 16px;
        }

        .og-artwork h1 { font-size: 36px; }
        .og-artwork h2 { font-size: 28px; }
        .og-artwork h3 { font-size: 22px; }

        .og-artwork p {
            margin-bottom: 12px;
        }

        .og-artwork strong {
            color: #fafafa;
            font-weight: 600;
        }

        .og-artwork em {
            font-style: italic;
        }

        .og-artwork code {
            font-family: 'JetBrains Mono', monospace;
            background: rgba(255, 255, 255, 0.1);
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 0.9em;
        }
    </style>
</head>
<body>
    <div class="og-container">
        <div class="og-artwork">${html}</div>
        <div class="og-footer">
            <span class="og-title">${escapedName}</span>
            <div class="og-meta">
                <span class="og-badge og-badge-md">MD</span>
                <span class="og-brand">zang.gallery</span>
            </div>
        </div>
    </div>
</body>
</html>`;
}

/**
 * Template for HTML content (renders actual artwork)
 * Uses iframe to give the content its own viewport context (like the website does)
 */
function getHTMLTemplate(content, metadata) {
    const escapedName = escapeHtml(metadata.name || `#${metadata.tokenId}`);
    const artworkHeight = OG_HEIGHT - 80; // 550px for artwork, 80px for footer

    // Wrap content in a minimal HTML document with default styles
    // This matches how HTMLViewer.jsx sanitizes content
    const wrappedContent = `<!DOCTYPE html>
<html>
<head>
    <style>
        * { box-sizing: border-box; }
        html, body {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
            background: #18181b;
            color: #e4e4e7;
            font-family: system-ui, -apple-system, sans-serif;
        }
    </style>
</head>
<body>${content}</body>
</html>`;

    // Base64 encode the content for srcdoc-like behavior via data URI
    const encodedContent = Buffer.from(wrappedContent).toString('base64');

    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        html, body {
            width: ${OG_WIDTH}px;
            height: ${OG_HEIGHT}px;
            overflow: hidden;
            background: #18181b;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        }

        .og-container {
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
        }

        .og-artwork {
            width: ${OG_WIDTH}px;
            height: ${artworkHeight}px;
            overflow: hidden;
            background: #18181b;
        }

        .og-artwork iframe {
            width: 100%;
            height: 100%;
            border: none;
            display: block;
        }

        .og-footer {
            height: 80px;
            padding: 0 32px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            background: rgba(0, 0, 0, 0.3);
            border-top: 1px solid #27272a;
        }

        .og-title {
            color: #fafafa;
            font-size: 24px;
            font-weight: 600;
            max-width: 70%;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .og-meta {
            display: flex;
            align-items: center;
            gap: 16px;
        }

        .og-badge {
            padding: 8px 16px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            color: white;
            background: #f59e0b;
        }

        .og-brand {
            color: #71717a;
            font-size: 16px;
            font-weight: 500;
        }
    </style>
</head>
<body>
    <div class="og-container">
        <div class="og-artwork">
            <iframe src="data:text/html;base64,${encodedContent}"></iframe>
        </div>
        <div class="og-footer">
            <span class="og-title">${escapedName}</span>
            <div class="og-meta">
                <span class="og-badge">HTML</span>
                <span class="og-brand">zang.gallery</span>
            </div>
        </div>
    </div>
</body>
</html>`;
}

/**
 * Get the appropriate template based on content type
 */
function getTemplate(content, contentType, metadata) {
    if (contentType === "text/markdown") {
        return getMarkdownTemplate(content, metadata);
    } else if (contentType === "text/html") {
        return getHTMLTemplate(content, metadata);
    } else {
        // Default to plain text
        return getPlainTextTemplate(content, metadata);
    }
}

/**
 * Generate OG image for a token
 * @param {number} tokenId - The token ID
 * @param {string} content - The NFT content
 * @param {string} contentType - MIME type (text/plain, text/markdown, text/html)
 * @param {object} metadata - { name, description, tokenId }
 * @returns {string} Path to the generated image
 */
async function generateOGImage(tokenId, content, contentType, metadata) {
    const browser = await initBrowser();
    const context = await browser.newContext({
        viewport: { width: OG_WIDTH, height: OG_HEIGHT },
        deviceScaleFactor: 1,
    });

    try {
        const page = await context.newPage();

        // Generate HTML template
        const html = getTemplate(content, contentType, { ...metadata, tokenId });

        // Set content and wait for fonts/images to load
        await page.setContent(html, { waitUntil: "networkidle" });

        // Wait for content to render
        // HTML content with animations needs more time to settle
        const waitTime = contentType === "text/html" ? 1500 : 500;
        await page.waitForTimeout(waitTime);

        // Ensure output directory exists
        const outputDir = path.join(__dirname, "og-images");
        await fs.mkdir(outputDir, { recursive: true });

        // Take screenshot
        const outputPath = path.join(outputDir, `${tokenId}.png`);
        await page.screenshot({
            path: outputPath,
            type: "png",
            clip: { x: 0, y: 0, width: OG_WIDTH, height: OG_HEIGHT }
        });

        console.log(`OG Generator: Generated image for token ${tokenId}`);
        return outputPath;
    } finally {
        await context.close();
    }
}

/**
 * Check if an OG image exists for a token
 */
async function ogImageExists(tokenId) {
    const imagePath = path.join(__dirname, "og-images", `${tokenId}.png`);
    try {
        await fs.access(imagePath);
        return true;
    } catch {
        return false;
    }
}

/**
 * Get the path to an OG image
 */
function getOGImagePath(tokenId) {
    return path.join(__dirname, "og-images", `${tokenId}.png`);
}

module.exports = {
    initBrowser,
    closeBrowser,
    generateOGImage,
    ogImageExists,
    getOGImagePath,
    OG_WIDTH,
    OG_HEIGHT,
};
