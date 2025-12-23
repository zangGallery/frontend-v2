import React, { useState, useRef, useEffect } from "react";
import { unified } from "unified";
import rehypeParse from "rehype-parse";
import rehypeSanitize from "rehype-sanitize";
import { schemas } from "../common";
import rehypeStringify from "rehype-stringify";

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
        const sanitized = unified()
            .use(rehypeParse, { fragment: true })
            .use(rehypeSanitize, schemas.validHTML)
            .use(rehypeStringify)
            .processSync(html);
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
<body>${String(sanitized)}</body>
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
                borderRadius: "8px",
                display: "block",
            }}
            srcDoc={sanitize(source)}
            sandbox="allow-scripts allow-same-origin"
            title="NFT HTML Content"
        />
    );
}
