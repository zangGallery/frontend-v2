import React, { useEffect, useState, useCallback } from "react";
import { Header } from "../components";

import "../styles/tailwind.css";
import "../styles/globals.css";

import config from "../config";
import { v1 } from "../common/abi";

import { defaultReadProvider, useReadProvider } from "../common/provider";
import { ethers } from "ethers";
import { parseHistory } from "../common/history";
import NFTHistory from "../components/NFTHistory";

// Cache for events
let eventsCache = null;
let lastFetchTime = null;
const CACHE_DURATION = 60000; // 1 minute

export default function Activity() {
    const zangAddress = config.contractAddresses.v1.zang;
    const zangABI = v1.zang;
    const marketplaceAddress = config.contractAddresses.v1.marketplace;
    const marketplaceABI = v1.marketplace;

    const [events, setEvents] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [readProvider] = useReadProvider();

    const queryEvents = useCallback(async () => {
        if (!readProvider) return;

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
            const zangContract = new ethers.Contract(
                zangAddress,
                zangABI,
                defaultReadProvider,
            );
            const marketplaceContract = new ethers.Contract(
                marketplaceAddress,
                marketplaceABI,
                defaultReadProvider,
            );

            // Get current block and only query last ~50k blocks (~1 week on Base)
            const currentBlock = await defaultReadProvider.getBlockNumber();
            const fromBlock = Math.max(
                currentBlock - 50000,
                config.firstBlocks.v1.base.zang,
            );

            // Query all event types in parallel
            const [
                transferEvents,
                tokenListedEvents,
                tokenDelistedEvents,
                tokenPurchasedEvents,
            ] = await Promise.all([
                zangContract.queryFilter(
                    zangContract.filters.TransferSingle(),
                    fromBlock,
                ),
                marketplaceContract.queryFilter(
                    marketplaceContract.filters.TokenListed(),
                    fromBlock,
                ),
                marketplaceContract.queryFilter(
                    marketplaceContract.filters.TokenDelisted(),
                    fromBlock,
                ),
                marketplaceContract.queryFilter(
                    marketplaceContract.filters.TokenPurchased(),
                    fromBlock,
                ),
            ]);

            // Combine and sort by block number (descending for recent first)
            const allEvents = [
                ...transferEvents,
                ...tokenListedEvents,
                ...tokenDelistedEvents,
                ...tokenPurchasedEvents,
            ].sort((a, b) => {
                if (b.blockNumber !== a.blockNumber) {
                    return b.blockNumber - a.blockNumber;
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
            console.error("Error fetching events:", error);
            setEvents([]);
        } finally {
            setIsLoading(false);
        }
    }, [
        readProvider,
        zangAddress,
        zangABI,
        marketplaceAddress,
        marketplaceABI,
    ]);

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

export function Head() {
    return (
        <>
            <title>Activity - zang</title>
            <meta
                name="description"
                content="View recent activity on zang.gallery"
            />
        </>
    );
}
