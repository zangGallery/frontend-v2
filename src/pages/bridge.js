import React from "react";
import { Header } from "../components";

import "../styles/tailwind.css";

export default function Bridge() {
    return (
        <div className="min-h-screen bg-ink-950">
            <Header />
            <div className="max-w-4xl mx-auto px-4 py-8">
                <div className="bg-ink-800/50 rounded-lg border border-ink-700/50 p-4 mb-6">
                    <p className="text-ink-300">
                        <span className="font-semibold text-ink-100">Note</span>
                        : We are not affiliated with Li.Finance.
                    </p>
                </div>
                <div
                    className="bg-ink-900/50 rounded-lg border border-ink-700/50 overflow-hidden"
                    style={{ height: "80vh" }}
                >
                    <iframe
                        id="lifi-iframe"
                        className="w-full h-full"
                        src="https://li.finance/embed?fromChain=eth&toChain=base&toToken=0x0000000000000000000000000000000000000000"
                        scrolling="auto"
                        title="Li.Fi Widget"
                        frameBorder="0"
                    />
                </div>
            </div>
        </div>
    );
}

export function Head() {
    return (
        <>
            <title>Bridge - zang</title>
            <meta
                name="description"
                content="Bridge assets to Base for zang.gallery"
            />
        </>
    );
}
