import { Fragment } from "react";
import React, { useState } from "react";

import HTMLViewer from "./HTMLViewer";

export default function HTMLEditor({ value, setValue }) {
    const [previewOpen, setPreviewOpen] = useState(false);

    if (typeof window !== "undefined") {
        const AceEditor = require("react-ace").default;
        require("ace-builds/src-noconflict/mode-html");
        require("ace-builds/src-noconflict/theme-monokai");
        const { Split } = require("@geoffcox/react-splitter");

        return (
            <Fragment>
                <div
                    className="rounded-lg border border-ink-700 relative"
                    style={{ zIndex: 0 }}
                >
                    <div style={{ height: "500px" }}>
                        <Split
                            horizontal={false}
                            onSplitChanged={() =>
                                window.dispatchEvent(new Event("resize"))
                            }
                        >
                            <div className="h-full">
                                <AceEditor
                                    mode="html"
                                    theme="monokai"
                                    onChange={setValue}
                                    value={value}
                                    name="html-editor"
                                    editorProps={{ $blockScrolling: false }}
                                    setOptions={{
                                        enableBasicAutocompletion: true,
                                        enableLiveAutocompletion: true,
                                        enableSnippets: true,
                                        showPrintMargin: false,
                                    }}
                                    width="100%"
                                    height="100%"
                                    fontSize={14}
                                />
                            </div>
                            <div className="h-full overflow-auto bg-ink-950 relative">
                                <button
                                    type="button"
                                    onClick={() => setPreviewOpen(true)}
                                    className="absolute top-2 right-2 z-10 p-1.5 bg-ink-800/80 hover:bg-ink-700 rounded text-ink-400 hover:text-white transition-colors"
                                    title="Expand preview"
                                >
                                    <svg
                                        className="w-4 h-4"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                                        />
                                    </svg>
                                </button>
                                <HTMLViewer source={value} />
                            </div>
                        </Split>
                    </div>
                </div>

                {/* Fullscreen Preview Modal */}
                {previewOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div
                            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                            onClick={() => setPreviewOpen(false)}
                        />
                        <div className="relative w-full max-w-4xl h-[80vh] bg-ink-950 rounded-xl border border-ink-700 overflow-hidden">
                            <div className="absolute top-3 right-3 z-10">
                                <button
                                    type="button"
                                    onClick={() => setPreviewOpen(false)}
                                    className="p-2 bg-ink-800 hover:bg-ink-700 rounded-lg text-ink-400 hover:text-white transition-colors"
                                >
                                    <svg
                                        className="w-5 h-5"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M6 18L18 6M6 6l12 12"
                                        />
                                    </svg>
                                </button>
                            </div>
                            <div className="h-full">
                                <HTMLViewer source={value} />
                            </div>
                        </div>
                    </div>
                )}
            </Fragment>
        );
    }
    return null;
}
