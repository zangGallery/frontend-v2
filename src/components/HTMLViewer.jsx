import React, { useState, useRef, useEffect } from "react";
import DOMPurify from "dompurify";
import Skeleton from "react-loading-skeleton";

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

// Default height based on viewport (60% of viewport height, min 400px)
const getDefaultHeight = () => {
    if (typeof window !== "undefined") {
        return Math.max(Math.round(window.innerHeight * 0.6), 400);
    }
    return 400;
};

export default function HTMLViewer({ source, compact = false }) {
    const [height, setHeight] = useState(getDefaultHeight);
    const [isLoaded, setIsLoaded] = useState(false);
    const iframeRef = useRef(null);

    // Measure content height
    const measureHeight = () => {
        if (iframeRef.current) {
            try {
                const contentHeight =
                    iframeRef.current.contentWindow?.document?.body
                        ?.scrollHeight;
                // Use measured height - allow shorter content to shrink container
                if (contentHeight && contentHeight > 100) {
                    setHeight(contentHeight + 32);
                }
            } catch (e) {
                // Cross-origin error, keep default
            }
        }
    };

    // On iframe load, measure after a delay to let content render
    const handleLoad = () => {
        measureHeight();
        setTimeout(() => {
            measureHeight();
            setIsLoaded(true);
        }, 150);
    };

    // Reset state when source changes
    useEffect(() => {
        setIsLoaded(false);
        setHeight(getDefaultHeight());
    }, [source]);

    const sanitize = (html) => {
        const sanitized = DOMPurify.sanitize(html, purifyConfig);
        // Minimal wrapper - only reset browser defaults, don't modify content styling
        return `<!DOCTYPE html>
<html>
<head>
    <style>
        html, body {
            margin: 0;
            padding: 0;
        }
    </style>
</head>
<body>${sanitized}</body>
</html>`;
    };

    // Compact mode: simple iframe for card previews
    if (compact) {
        return (
            <iframe
                ref={iframeRef}
                style={{
                    width: "100%",
                    height: "100%",
                    border: "none",
                    display: "block",
                }}
                srcDoc={sanitize(source)}
                sandbox="allow-same-origin allow-scripts"
                title="NFT HTML Content"
            />
        );
    }

    // Full mode: with loading state and auto-resize
    const defaultHeight = getDefaultHeight();

    return (
        <div style={{ position: "relative" }}>
            {!isLoaded && (
                <div style={{ height: `${defaultHeight}px` }}>
                    <Skeleton
                        height="100%"
                        baseColor="#27272a"
                        highlightColor="#3f3f46"
                    />
                </div>
            )}
            <iframe
                ref={iframeRef}
                onLoad={handleLoad}
                style={{
                    width: "100%",
                    height: isLoaded ? `${height}px` : "0",
                    border: "none",
                    display: "block",
                    visibility: isLoaded ? "visible" : "hidden",
                    position: isLoaded ? "relative" : "absolute",
                }}
                srcDoc={sanitize(source)}
                sandbox="allow-same-origin allow-scripts"
                title="NFT HTML Content"
            />
        </div>
    );
}
