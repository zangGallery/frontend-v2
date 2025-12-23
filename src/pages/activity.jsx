import { useEffect, useState, useCallback } from "react";
import { Header } from "../components";

import "../styles/tailwind.css";
import "../styles/globals.css";

import config from "../config";
import { v1 } from "../common/abi";

import { publicClient } from "../common/provider";
import { parseHistory } from "../common/history";
import NFTHistory from "../components/NFTHistory";

// Cache for events
let eventsCache = null;
let lastFetchTime = null;
const CACHE_DURATION = 60000; // 1 minute

export default function Activity() {
    const zangAddress = config.contractAddresses.v1.zang;
    const marketplaceAddress = config.contractAddresses.v1.marketplace;

    const [events, setEvents] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    const queryEvents = useCallback(async () => {
        // Check cache first
        if (
            eventsCache &&
            lastFetchTime &&
            Date.now() - lastFetchTime < CACHE_DURATION
        ) {
            setEvents(eventsCache);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);

        try {
            // Get current block and only query last ~50k blocks (~1 week on Base)
            const currentBlock = await publicClient.getBlockNumber();
            const fromBlock = BigInt(
                Math.max(
                    Number(currentBlock) - 50000,
                    config.firstBlocks.v1.base.zang,
                ),
            );

            // Query all event types in parallel
            const [
                transferEvents,
                tokenListedEvents,
                tokenDelistedEvents,
                tokenPurchasedEvents,
            ] = await Promise.all([
                publicClient.getContractEvents({
                    address: zangAddress,
                    abi: v1.zang,
                    eventName: "TransferSingle",
                    fromBlock,
                }),
                publicClient.getContractEvents({
                    address: marketplaceAddress,
                    abi: v1.marketplace,
                    eventName: "TokenListed",
                    fromBlock,
                }),
                publicClient.getContractEvents({
                    address: marketplaceAddress,
                    abi: v1.marketplace,
                    eventName: "TokenDelisted",
                    fromBlock,
                }),
                publicClient.getContractEvents({
                    address: marketplaceAddress,
                    abi: v1.marketplace,
                    eventName: "TokenPurchased",
                    fromBlock,
                }),
            ]);

            // Add event name to each event for parseHistory
            const allEvents = [
                ...transferEvents.map((e) => ({ ...e, event: "TransferSingle" })),
                ...tokenListedEvents.map((e) => ({ ...e, event: "TokenListed" })),
                ...tokenDelistedEvents.map((e) => ({ ...e, event: "TokenDelisted" })),
                ...tokenPurchasedEvents.map((e) => ({ ...e, event: "TokenPurchased" })),
            ].sort((a, b) => {
                if (Number(b.blockNumber) !== Number(a.blockNumber)) {
                    return Number(b.blockNumber) - Number(a.blockNumber);
                }
                return b.logIndex - a.logIndex;
            });

            // Limit to last 100 events for performance
            const limitedEvents = allEvents.slice(0, 100);

            // Cache the results
            eventsCache = limitedEvents;
            lastFetchTime = Date.now();

            setEvents(limitedEvents);
        } catch (error) {
            setEvents([]);
        } finally {
            setIsLoading(false);
        }
    }, [zangAddress, marketplaceAddress]);

    useEffect(() => {
        queryEvents();
    }, [queryEvents]);

    return (
        <div className="min-h-screen bg-ink-950">
            <Header />
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <h1 className="text-3xl md:text-4xl font-mono font-bold text-center text-white mb-8">
                    Recent Activity
                </h1>
                <div className="bg-ink-900/50 rounded-2xl border border-ink-800 p-6">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-3">
                            <svg
                                className="animate-spin h-8 w-8 text-accent-cyan"
                                fill="none"
                                viewBox="0 0 24 24"
                            >
                                <circle
                                    className="opacity-25"
                                    cx="12"
                                    cy="12"
                                    r="10"
                                    stroke="currentColor"
                                    strokeWidth="4"
                                />
                                <path
                                    className="opacity-75"
                                    fill="currentColor"
                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                />
                            </svg>
                            <span className="text-ink-400">
                                Loading activity...
                            </span>
                        </div>
                    ) : events && events.length === 0 ? (
                        <div className="text-center py-12 text-ink-400">
                            No recent activity
                        </div>
                    ) : (
                        <NFTHistory
                            history={parseHistory(events)}
                            newestFirst
                        />
                    )}
                </div>
            </div>
        </div>
    );
}

