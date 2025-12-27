import { useEffect, useState } from "react";
import { Header } from "../components";
import { formatEther } from "viem";
import config from "../config";
import PrefetchLink from "../components/PrefetchLink";

import "../styles/tailwind.css";
import "../styles/globals.css";

// Event type configuration - consistent with UserHistory
const EVENT_CONFIG = {
    mint: { icon: "M12 6v6m0 0v6m0-6h6m-6 0H6", label: "Minted", color: "text-green-400" },
    purchase: { icon: "M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z", label: "Purchased", color: "text-accent-cyan" },
    sale: { icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z", label: "Sold", color: "text-yellow-400" },
    list: { icon: "M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z", label: "Listed", color: "text-blue-400" },
    delist: { icon: "M6 18L18 6M6 6l12 12", label: "Delisted", color: "text-ink-400" },
    transfer: { icon: "M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4", label: "Transferred", color: "text-purple-400" },
    burn: { icon: "M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z", label: "Burned", color: "text-red-400" },
};

function formatPrice(priceWei) {
    if (!priceWei) return null;
    try {
        const eth = parseFloat(formatEther(BigInt(priceWei)));
        return eth < 0.0001 ? "<0.0001" : eth.toFixed(4);
    } catch {
        return null;
    }
}

function shortenAddress(addr) {
    if (!addr) return "";
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function parseEvent(row) {
    const data = row.data || {};
    const zeroAddress = "0x0000000000000000000000000000000000000000";

    switch (row.event_type) {
        case "TransferSingle": {
            const from = data._from || data.from;
            const to = data._to || data.to;
            let type = "transfer";
            if (from === zeroAddress) type = "mint";
            else if (to === zeroAddress) type = "burn";

            return {
                type,
                tokenId: row.token_id,
                from,
                to,
                amount: Number(data._value || data.value || 1),
                txHash: row.tx_hash,
                blockNumber: row.block_number,
            };
        }
        case "TokenListed":
            return {
                type: "list",
                tokenId: row.token_id,
                seller: data._seller,
                price: data._price,
                amount: Number(data.amount || 1),
                txHash: row.tx_hash,
                blockNumber: row.block_number,
            };
        case "TokenDelisted":
            return {
                type: "delist",
                tokenId: row.token_id,
                seller: data._seller,
                txHash: row.tx_hash,
                blockNumber: row.block_number,
            };
        case "TokenPurchased":
            return {
                type: "purchase",
                tokenId: row.token_id,
                buyer: data._buyer,
                seller: data._seller,
                price: data._price,
                amount: Number(data._amount || 1),
                txHash: row.tx_hash,
                blockNumber: row.block_number,
            };
        default:
            return null;
    }
}

export default function Activity() {
    const [events, setEvents] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchActivity = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const res = await fetch("/api/activity");
                if (!res.ok) throw new Error("Failed to fetch activity");
                const data = await res.json();

                // Parse and filter events
                const rawEvents = data.events || [];
                const parsed = rawEvents
                    .map(parseEvent)
                    .filter(Boolean);

                // Filter out transfers that are part of purchases (same tx_hash)
                const purchaseTxHashes = new Set(
                    parsed.filter(e => e.type === "purchase").map(e => e.txHash)
                );
                const filtered = parsed.filter(e => {
                    if (e.type === "transfer" && purchaseTxHashes.has(e.txHash)) {
                        return false;
                    }
                    return true;
                });

                // Limit to 100 most recent
                setEvents(filtered.slice(0, 100));
            } catch (e) {
                setError(e.message);
            } finally {
                setIsLoading(false);
            }
        };

        fetchActivity();
    }, []);

    return (
        <div className="min-h-screen bg-ink-950">
            <Header />
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <h1 className="text-3xl md:text-4xl font-mono font-bold text-center text-white mb-8">
                    Recent Activity
                </h1>
                <div className="bg-ink-900/50 rounded-2xl border border-ink-800 p-6">
                    {isLoading ? (
                        <div className="space-y-2">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <div key={i} className="flex items-center gap-4 p-3 bg-ink-900/30 rounded-lg animate-pulse">
                                    <div className="w-8 h-8 bg-ink-800 rounded-lg" />
                                    <div className="flex-1 space-y-2">
                                        <div className="h-4 bg-ink-800 rounded w-1/3" />
                                        <div className="h-3 bg-ink-800 rounded w-1/4" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : error ? (
                        <div className="text-center py-12 text-ink-400">
                            Failed to load activity
                        </div>
                    ) : events.length === 0 ? (
                        <div className="text-center py-12 text-ink-400">
                            No recent activity
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {events.map((event, idx) => {
                                const eventConfig = EVENT_CONFIG[event.type] || {
                                    icon: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
                                    label: event.type,
                                    color: "text-ink-400"
                                };

                                return (
                                    <div
                                        key={`${event.txHash}-${idx}`}
                                        className="flex items-center gap-4 p-3 bg-ink-900/30 rounded-lg hover:bg-ink-900/50 transition-colors group"
                                    >
                                        {/* Icon */}
                                        <div className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-ink-800/50 ${eventConfig.color}`}>
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={eventConfig.icon} />
                                            </svg>
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className={`text-sm font-medium ${eventConfig.color}`}>
                                                    {eventConfig.label}
                                                </span>
                                                <PrefetchLink
                                                    to={`/nft?id=${event.tokenId}`}
                                                    className="text-sm text-ink-200 hover:text-white truncate"
                                                >
                                                    #{event.tokenId}
                                                </PrefetchLink>
                                                {event.amount > 1 && (
                                                    <span className="text-xs text-ink-500">x{event.amount}</span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-ink-500">
                                                {event.price && (
                                                    <span className="text-ink-300">
                                                        {formatPrice(event.price)} ETH
                                                    </span>
                                                )}
                                                {event.buyer && (
                                                    <span>
                                                        by{" "}
                                                        <PrefetchLink
                                                            to={`/profile?address=${event.buyer}`}
                                                            className="font-mono hover:text-ink-300"
                                                        >
                                                            {shortenAddress(event.buyer)}
                                                        </PrefetchLink>
                                                    </span>
                                                )}
                                                {event.seller && !event.buyer && (
                                                    <span>
                                                        by{" "}
                                                        <PrefetchLink
                                                            to={`/profile?address=${event.seller}`}
                                                            className="font-mono hover:text-ink-300"
                                                        >
                                                            {shortenAddress(event.seller)}
                                                        </PrefetchLink>
                                                    </span>
                                                )}
                                                {event.from && event.to && event.type === "transfer" && (
                                                    <span>
                                                        <PrefetchLink
                                                            to={`/profile?address=${event.from}`}
                                                            className="font-mono hover:text-ink-300"
                                                        >
                                                            {shortenAddress(event.from)}
                                                        </PrefetchLink>
                                                        {" → "}
                                                        <PrefetchLink
                                                            to={`/profile?address=${event.to}`}
                                                            className="font-mono hover:text-ink-300"
                                                        >
                                                            {shortenAddress(event.to)}
                                                        </PrefetchLink>
                                                    </span>
                                                )}
                                                {event.to && event.type === "mint" && (
                                                    <span>
                                                        by{" "}
                                                        <PrefetchLink
                                                            to={`/profile?address=${event.to}`}
                                                            className="font-mono hover:text-ink-300"
                                                        >
                                                            {shortenAddress(event.to)}
                                                        </PrefetchLink>
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Transaction link */}
                                        <a
                                            href={`${config.blockExplorer?.url || "https://basescan.org"}/tx/${event.txHash}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex-shrink-0 p-2 text-ink-500 hover:text-ink-300 opacity-0 group-hover:opacity-100 transition-opacity"
                                            title="View transaction"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                            </svg>
                                        </a>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
