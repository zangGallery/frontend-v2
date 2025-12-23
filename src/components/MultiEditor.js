import React from "react";
import rehypeSanitize from "rehype-sanitize";

import MDEditor from "@uiw/react-md-editor";
import { defaultCommands } from "../common/commands";
import schemas from "../common/schemas";

import HTMLEditor from "./HTMLEditor";

export default function MultiEditor({ textType, value, setValue }) {
    switch (textType) {
        case "text/markdown":
            return (
                <div className="space-y-3">
                    <div
                        className="rounded-lg overflow-hidden border border-ink-700"
                        data-color-mode="dark"
                    >
                        <MDEditor
                            value={value}
                            onChange={setValue}
                            highlightEnable={false}
                            previewOptions={{
                                rehypePlugins: [
                                    () => rehypeSanitize(schemas.validMarkdown),
                                ],
                            }}
                            commands={defaultCommands}
                            height={400}
                        />
                    </div>
                    <div className="flex items-center gap-2 p-3 bg-ink-900/50 rounded-lg border border-ink-800">
                        <span className="text-purple-400 text-lg">#</span>
                        <p className="text-sm text-ink-400">
                            Need help with Markdown? Check the{" "}
                            <a
                                className="text-purple-400 hover:text-purple-300 underline"
                                target="_blank"
                                rel="noopener noreferrer"
                                href="https://docs.github.com/en/github/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax"
                            >
                                GitHub Markdown guide
                            </a>
                        </p>
                    </div>
                </div>
            );
        case "text/plain":
            return (
                <textarea
                    className="w-full h-[400px] px-4 py-3 bg-ink-900 border border-ink-700 rounded-lg text-ink-100 font-mono text-sm placeholder-ink-500 resize-none focus:outline-none focus:border-accent-cyan focus:ring-1 focus:ring-accent-cyan transition-colors"
                    value={value}
                    onChange={(event) => setValue(event.target.value)}
                    placeholder="Start writing your text..."
                />
            );
        case "text/html":
            return (
                <div className="space-y-3">
                    <HTMLEditor value={value} setValue={setValue} />
                    <div className="flex items-center gap-2 p-3 bg-ink-900/50 rounded-lg border border-ink-800">
                        <span className="text-amber-400 text-lg">{"<>"}</span>
                        <p className="text-sm text-ink-400">
                            Write HTML with inline CSS. External resources and
                            scripts are sanitized for security.
                        </p>
                    </div>
                </div>
            );
        default:
            return <p className="text-ink-400">Unsupported editor type</p>;
    }
}
