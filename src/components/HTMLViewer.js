import React from "react";
import { createElement, Fragment, useState, useRef } from "react";
import { unified } from "unified";
import rehypeParse from "rehype-parse";
import rehypeReact from "rehype-react";
import rehypeSanitize from "rehype-sanitize";
import { schemas } from "../common";
import rehypeStringify from "rehype-stringify";

export default function HTMLViewer({ source }) {
    const [height, setHeight] = useState("400px");
    const ref = useRef();

    const PADDING = 1.25; // rem

    const convertRemToPixels = (rem) => {
        return (
            rem *
            parseFloat(getComputedStyle(document.documentElement).fontSize)
        );
    };

    const onLoad = () => {
        if (typeof window !== "undefined" && ref.current) {
            try {
                // Try to get content height
                const contentHeight =
                    ref.current.contentWindow?.document?.body?.scrollHeight;
                if (contentHeight) {
                    setHeight(
                        parseFloat(contentHeight) +
                            convertRemToPixels(PADDING * 2) +
                            "px",
                    );
                }
            } catch (e) {
                // If cross-origin error, keep default height
                console.warn(
                    "Could not access iframe content for height calculation",
                );
            }
        }
    };

    const sanitize = (html) => {
        const sanitized = unified()
            .use(rehypeParse, { fragment: true })
            .use(rehypeReact, { createElement, Fragment })
            .use(rehypeSanitize, schemas.validHTML)
            .use(rehypeStringify)
            .processSync(html);
        return sanitized.value;
    };

    return (
        <iframe
            ref={ref}
            onLoad={onLoad}
            height={height}
            style={{
                width: "100%",
                overflow: "auto",
                border: "none",
                borderRadius: "8px",
            }}
            srcDoc={sanitize(source)}
            sandbox="allow-same-origin"
            title="NFT HTML Content"
        />
    );
}
