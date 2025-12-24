import React, { useState, useRef, useEffect } from "react";
import DOMPurify from "dompurify";

// Configure DOMPurify for safe HTML + SVG (no scripts)
// DOMPurify's defaults already block event handlers (onclick, onerror, etc.)
// and sanitize dangerous URLs (javascript:, data: in wrong contexts)
// Explicit allowlist of safe HTML/SVG tags (style is critical for artwork CSS)
const ALLOWED_TAGS = [
    // HTML structural
    "html", "head", "body", "div", "span", "p", "br", "hr",
    "h1", "h2", "h3", "h4", "h5", "h6",
    "ul", "ol", "li", "dl", "dt", "dd",
    "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption",
    "article", "section", "nav", "aside", "header", "footer", "main",
    "figure", "figcaption", "details", "summary",
    // Text formatting
    "a", "strong", "b", "em", "i", "u", "s", "mark", "small", "sub", "sup",
    "blockquote", "q", "cite", "code", "pre", "kbd", "var", "samp",
    // Media
    "img", "audio", "video", "source", "track", "picture",
    // CSS - critical for artwork styling
    "style",
    // SVG elements
    "svg", "g", "path", "rect", "circle", "ellipse", "line", "polyline", "polygon",
    "text", "tspan", "textPath", "defs", "use", "symbol", "clipPath", "mask",
    "pattern", "linearGradient", "radialGradient", "stop", "filter",
    "feGaussianBlur", "feOffset", "feBlend", "feColorMatrix", "feComposite",
    "feMerge", "feMergeNode", "feFlood", "image", "title", "desc",
];

const purifyConfig = {
    ALLOWED_TAGS,
    // Allow common attributes
    ADD_ATTR: ["class", "style", "target", "viewBox", "xmlns", "fill", "stroke",
        "stroke-width", "d", "x", "y", "width", "height", "cx", "cy", "r", "rx", "ry",
        "x1", "y1", "x2", "y2", "points", "transform", "opacity", "id", "href",
        "xlink:href", "offset", "stop-color", "stop-opacity", "gradientUnits",
        "gradientTransform", "spreadMethod", "preserveAspectRatio", "clip-path",
        "filter", "mask", "font-size", "font-family", "text-anchor", "dominant-baseline"],
    // FORCE_BODY prevents style tags from being stripped when at start of content
    // See: https://github.com/cure53/DOMPurify/issues/804
    FORCE_BODY: true,
};

export default function HTMLViewer({ source }) {
    const [height, setHeight] = useState(300);
    const iframeRef = useRef(null);

    // Auto-resize iframe to fit content
    const updateHeight = () => {
        if (iframeRef.current) {
            try {
                const contentHeight =
                    iframeRef.current.contentWindow?.document?.body
                        ?.scrollHeight;
                if (contentHeight && contentHeight > 50) {
                    setHeight(Math.max(contentHeight + 32, 200)); // Add padding
                }
            } catch (e) {
                // Cross-origin error, keep default
            }
        }
    };

    // Update height when source changes
    useEffect(() => {
        const timer = setTimeout(updateHeight, 100);
        return () => clearTimeout(timer);
    }, [source]);

    const sanitize = (html) => {
        const sanitized = DOMPurify.sanitize(html, purifyConfig);
        // Minimal wrapper - only set defaults that user can override
        return `<!DOCTYPE html>
<html>
<head>
    <style>
        * { box-sizing: border-box; }
        html, body {
            margin: 0;
            padding: 0;
            min-height: 100%;
            background: #18181b;
            color: #e4e4e7;
            font-family: system-ui, -apple-system, sans-serif;
        }
    </style>
</head>
<body>${sanitized}</body>
</html>`;
    };

    return (
        <iframe
            ref={iframeRef}
            onLoad={updateHeight}
            style={{
                width: "100%",
                height: `${height}px`,
                border: "none",
                display: "block",
                transition: "height 0.15s ease-out",
            }}
            srcDoc={sanitize(source)}
            sandbox="allow-same-origin allow-scripts"
            title="NFT HTML Content"
        />
    );
}
