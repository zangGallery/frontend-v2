import { Fragment, useCallback } from "react";
import { useEffect, useState } from "react";
import { formatEther, zeroAddress } from "viem";
import { publicClient } from "../common/provider";
import { NFTCard } from "../components";
import InfiniteScroll from "react-infinite-scroll-component";
import config from "../config";
import { v1 } from "../common/abi";
import { Header } from "../components";
import { useRecoilState } from "recoil";
import { formatError, standardErrorState } from "../common/error";
import StandardErrorDisplay from "../components/StandardErrorDisplay";
import { useNavigate, Link } from "react-router-dom";
import { useNewEvents, useSocketStatus, useSyncStatus } from "../common/socket";
import SyncStatus, { useSyncMeta } from "../components/SyncStatus";

import "../styles/tailwind.css";

// Typewriter effect with fixed-width container for stable centering
function TypewriterText({ phrases }) {
    const [currentPhraseIndex, setCurrentPhraseIndex] = useState(0);
    const [currentText, setCurrentText] = useState("");
    const [isDeleting, setIsDeleting] = useState(false);

    // Fixed width based on longest phrase (ch = character width in monospace)
    const maxLength = Math.max(...phrases.map((p) => p.length));

    useEffect(() => {
        const currentPhrase = phrases[currentPhraseIndex];
        const timeout = setTimeout(
            () => {
                if (!isDeleting) {
                    if (currentText.length < currentPhrase.length) {
                        setCurrentText(
                            currentPhrase.slice(0, currentText.length + 1),
                        );
                    } else {
                        setTimeout(() => setIsDeleting(true), 2000);
                    }
                } else {
                    if (currentText.length > 0) {
                        setCurrentText(currentText.slice(0, -1));
                    } else {
                        setIsDeleting(false);
                        setCurrentPhraseIndex(
                            (prev) => (prev + 1) % phrases.length,
                        );
                    }
                }
            },
            isDeleting ? 50 : 100,
        );

        return () => clearTimeout(timeout);
    }, [currentText, isDeleting, currentPhraseIndex, phrases]);

    return (
        <span
            className="inline-block text-center"
            style={{ width: `${maxLength + 1}ch` }}
        >
            <span className="text-white">{currentText}</span>
            <span className="animate-pulse text-accent-cyan">|</span>
        </span>
    );
}

// Animated counter that counts up
function AnimatedCounter({ value, suffix = "" }) {
    const [displayValue, setDisplayValue] = useState(0);

    useEffect(() => {
        if (value === null || value === undefined) return;

        const duration = 1500;
        const steps = 30;
        const increment = value / steps;
        let current = 0;
        let step = 0;

        const timer = setInterval(() => {
            step++;
            current = Math.min(Math.round(increment * step), value);
            setDisplayValue(current);
            if (step >= steps) clearInterval(timer);
        }, duration / steps);

        return () => clearInterval(timer);
    }, [value]);

    return (
        <span>
            {displayValue.toLocaleString()}
            {suffix}
        </span>
    );
}

// Live feed ticker showing recent activity
function LiveFeed({ events }) {
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        if (!events || events.length === 0) return;
        const timer = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % events.length);
        }, 3000);
        return () => clearInterval(timer);
    }, [events]);

    if (!events || events.length === 0) return null;

    const event = events[currentIndex];
    const getEventText = (e) => {
        switch (e.type) {
            case "mint":
                return `New ${e.contentType} minted`;
            case "purchase":
                return `Sold for ${e.price} ETH`;
            case "list":
                return `Listed for ${e.price} ETH`;
            default:
                return "New activity";
        }
    };

    const getEventIcon = (e) => {
        switch (e.type) {
            case "mint":
                return "✨";
            case "purchase":
                return "💎";
            case "list":
                return "🏷️";
            default:
                return "📝";
        }
    };

    return (
        <div className="flex items-center justify-center gap-2 text-sm text-ink-400">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <Link
                to={`/nft?id=${event.id}`}
                className="transition-opacity duration-300 hover:text-ink-200"
            >
                {getEventIcon(event)}{" "}
                <span className="text-ink-500">#{event.id}</span>{" "}
                <span className="text-ink-200 font-medium">{event.title}</span>{" "}
                · {getEventText(event)}
            </Link>
        </div>
    );
}

export default function Home() {
    const navigate = useNavigate();
    const [lastNFTId, setLastNFTId] = useState(null);
    const [nfts, setNFTs] = useState([]);
    const [nftDataCache, setNftDataCache] = useState({}); // Cache for prefetched NFT data
    const [, setStandardError] = useRecoilState(standardErrorState);
    const [recentEvents, setRecentEvents] = useState([]);
    const [totalVolume, setTotalVolume] = useState(null);
    const [uniqueArtists, setUniqueArtists] = useState(null);
    const [activityMeta, setActivityMeta] = useSyncMeta();

    const increment = 6;

    const zangAddress = config.contractAddresses.v1.zang;
    const marketplaceAddress = config.contractAddresses.v1.marketplace;

    useEffect(() => {
        const fetchLastTokenId = async () => {
            try {
                const newLastNFTId = await publicClient.readContract({
                    address: zangAddress,
                    abi: v1.zang,
                    functionName: "lastTokenId",
                });
                setLastNFTId(Number(newLastNFTId));
            } catch (e) {
                setStandardError(formatError(e));
            }
        };
        fetchLastTokenId();
    }, [setStandardError]);

    // Fetch recent events for live feed from cached API
    useEffect(() => {
        const fetchRecentEvents = async () => {
            try {
                // Fetch from cached API instead of RPC
                const response = await fetch("/api/activity");
                if (!response.ok) throw new Error("Failed to fetch activity");

                const { events: rawEvents, _meta } = await response.json();
                setActivityMeta(_meta);

                // Process events for feed
                const events = rawEvents.slice(0, 50).map((e) => {
                    const data = e.data;
                    let type = "transfer";
                    let price = null;

                    if (e.event_type === "TransferSingle" && data.from === "0x0000000000000000000000000000000000000000") {
                        type = "mint";
                    } else if (e.event_type === "TokenPurchased") {
                        type = "purchase";
                        price = formatEther(BigInt(data._price || 0));
                    } else if (e.event_type === "TokenListed") {
                        type = "list";
                        price = formatEther(BigInt(data._price || 0));
                    }

                    return {
                        type,
                        id: e.token_id.toString(),
                        blockNumber: Number(e.block_number),
                        price,
                    };
                }).filter(e => e.type !== "transfer").slice(0, 10);

                // Fetch titles using batch API
                const uniqueIds = [...new Set(events.map((e) => e.id))];
                const batchResponse = await fetch("/api/nfts/batch", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ ids: uniqueIds }),
                });

                const nftData = {};
                if (batchResponse.ok) {
                    const { nfts } = await batchResponse.json();
                    for (const nft of nfts) {
                        if (nft.data) {
                            let contentType = "text";
                            if (nft.data.content_type === "text/html") {
                                contentType = "HTML";
                            } else if (nft.data.content_type === "text/markdown") {
                                contentType = "Markdown";
                            }
                            nftData[nft.id] = {
                                title: nft.data.name || `#${nft.id}`,
                                contentType,
                            };
                        } else {
                            nftData[nft.id] = { title: `#${nft.id}`, contentType: "text" };
                        }
                    }
                }

                // Add titles and content types to events
                const eventsWithData = events.map((e) => ({
                    ...e,
                    title: nftData[e.id]?.title || `#${e.id}`,
                    contentType: nftData[e.id]?.contentType || "text",
                }));
                setRecentEvents(eventsWithData);
            } catch (e) {
                console.error("Error fetching activity:", e);
            }
        };

        fetchRecentEvents();
    }, []);

    // Fetch stats (unique artists, total volume) from DB
    useEffect(() => {
        const fetchStats = async () => {
            try {
                const response = await fetch("/api/stats");
                if (response.ok) {
                    const data = await response.json();
                    if (data.uniqueArtists > 0) {
                        setUniqueArtists(data.uniqueArtists);
                    }
                    if (data.totalVolumeEth !== undefined) {
                        setTotalVolume(data.totalVolumeEth);
                    }
                }
            } catch {
                // Silent fail
            }
        };
        fetchStats();
    }, []);

    // WebSocket connection status
    const isConnected = useSocketStatus();

    // Handle real-time new events via WebSocket
    const handleNewEvents = useCallback(async (newEvents) => {
        // Filter for relevant event types
        const relevantEvents = newEvents.filter(e =>
            e.type === "TransferSingle" ||
            e.type === "TokenListed" ||
            e.type === "TokenPurchased"
        );

        if (relevantEvents.length === 0) return;

        // Fetch NFT data for new events
        const uniqueIds = [...new Set(relevantEvents.map(e => e.tokenId.toString()))];
        const nftData = {};

        try {
            const batchResponse = await fetch("/api/nfts/batch", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: uniqueIds }),
            });

            if (batchResponse.ok) {
                const { nfts } = await batchResponse.json();
                for (const nft of nfts) {
                    if (nft.data) {
                        let contentType = "text";
                        if (nft.data.content_type === "text/html") contentType = "HTML";
                        else if (nft.data.content_type === "text/markdown") contentType = "Markdown";
                        nftData[nft.id] = { title: nft.data.name || `#${nft.id}`, contentType };
                    }
                }
            }
        } catch {
            // Silent fail
        }

        // Create feed events from WebSocket events
        const feedEvents = relevantEvents.map(e => {
            let type = "transfer";
            if (e.type === "TransferSingle") type = "mint"; // Simplified - assumes mints
            else if (e.type === "TokenPurchased") type = "purchase";
            else if (e.type === "TokenListed") type = "list";

            return {
                type,
                id: e.tokenId.toString(),
                blockNumber: e.blockNumber,
                title: nftData[e.tokenId]?.title || `#${e.tokenId}`,
                contentType: nftData[e.tokenId]?.contentType || "text",
            };
        }).filter(e => e.type !== "transfer");

        // Prepend new events to the feed (newest first)
        setRecentEvents(prev => [...feedEvents, ...prev].slice(0, 15));

        // If there's a new mint, refresh lastNFTId
        if (relevantEvents.some(e => e.type === "TransferSingle")) {
            try {
                const newLastNFTId = await publicClient.readContract({
                    address: zangAddress,
                    abi: v1.zang,
                    functionName: "lastTokenId",
                });
                setLastNFTId(Number(newLastNFTId));
            } catch {
                // Silent fail
            }
        }
    }, [zangAddress]);

    useNewEvents(handleNewEvents);

    // Handle real-time sync status updates via WebSocket
    const handleSyncStatus = useCallback((status) => {
        setActivityMeta({
            lastSyncBlock: status.lastSyncBlock,
            lastSyncTime: status.lastSyncTime,
            isSyncing: status.isSyncing,
            syncProgress: status.syncProgress,
            blocksRemaining: status.blocksRemaining,
            isCatchingUp: status.isCatchingUp,
        });
    }, [setActivityMeta]);

    useSyncStatus(handleSyncStatus);

    const getMoreIds = async (count) => {
        const newNFTs = [...nfts];
        const newIds = [];

        for (let i = 0; i < count; i++) {
            const newId = lastNFTId - newNFTs.length - i;
            if (newId >= 1) {
                newIds.push(newId);
            }
        }

        if (newIds.length === 0) return;

        // Add IDs to list immediately for UI responsiveness
        setNFTs([...newNFTs, ...newIds]);

        // Batch fetch NFT data for all new IDs
        try {
            const response = await fetch("/api/nfts/batch", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: newIds }),
            });

            if (response.ok) {
                const { nfts: batchData } = await response.json();
                const newCache = { ...nftDataCache };

                for (const nft of batchData) {
                    if (nft.data) {
                        newCache[nft.id] = nft.data;
                    }
                }

                setNftDataCache(newCache);
            }
        } catch (e) {
            // Silent fail - individual NFTCards will fetch their own data
        }
    };

    useEffect(() => {
        if (lastNFTId !== null) {
            getMoreIds(12);
        }
    }, [lastNFTId]);

    return (
        <div className="min-h-screen bg-ink-950">
            <Header />
            <StandardErrorDisplay />

            {/* Hero Section */}
            <section className="relative overflow-hidden">
                <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
                    <div className="text-center space-y-8">
                        <p className="text-ink-500 font-mono text-xs sm:text-sm tracking-widest uppercase">
                            A canvas for writers & creators
                        </p>

                        {/* Typewriter headline */}
                        <h1 className="text-4xl sm:text-5xl md:text-6xl font-mono leading-tight">
                            <span className="text-ink-400 hidden sm:inline">{">"}</span>{" "}
                            <TypewriterText
                                phrases={[
                                    "Write beautifully.",
                                    "Words, forever.",
                                    "Code is poetry.",
                                    "Text is art.",
                                    "Create freely.",
                                ]}
                            />
                        </h1>

                        {/* Description */}
                        <p className="text-ink-400 text-lg sm:text-xl max-w-2xl mx-auto leading-relaxed">
                            Mint your{" "}
                            <span className="text-ink-200">poetry</span>,{" "}
                            <span className="text-ink-200">stories</span>,{" "}
                            <span className="text-ink-200">code</span>, and{" "}
                            <span className="text-ink-200">HTML art</span> as
                            NFTs. No images required. Pure text, onchain
                            forever.
                        </p>

                        {/* CTA Buttons */}
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
                            <button
                                onClick={() => navigate("/mint")}
                                className="group relative px-8 py-4 bg-white text-ink-950 font-medium rounded-lg hover:bg-ink-100 transition-all duration-200 text-lg"
                            >
                                <span className="flex items-center justify-center gap-3">
                                    <span className="font-mono text-ink-500">
                                        $
                                    </span>
                                    Start Writing
                                </span>
                            </button>
                            <button
                                onClick={() => {
                                    document
                                        .getElementById("gallery")
                                        .scrollIntoView({ behavior: "smooth" });
                                }}
                                className="px-8 py-4 border border-ink-700 text-ink-300 font-medium rounded-lg hover:border-ink-500 hover:text-white transition-all duration-200 text-lg"
                            >
                                Browse Gallery
                            </button>
                        </div>

                        {/* Stats row */}
                        <div className="flex flex-wrap items-center justify-center gap-8 pt-6">
                            {lastNFTId && (
                                <div className="text-center">
                                    <div className="text-3xl font-mono text-white">
                                        <AnimatedCounter value={lastNFTId} />
                                    </div>
                                    <div className="text-ink-500 text-sm">
                                        texts minted
                                    </div>
                                </div>
                            )}
                            {uniqueArtists && uniqueArtists > 0 && (
                                <div className="text-center">
                                    <div className="text-3xl font-mono text-white">
                                        <AnimatedCounter
                                            value={uniqueArtists}
                                        />
                                    </div>
                                    <div className="text-ink-500 text-sm">
                                        artists
                                    </div>
                                </div>
                            )}
                            {totalVolume !== null && totalVolume > 0 && (
                                <div className="text-center">
                                    <div className="text-3xl font-mono text-white">
                                        {totalVolume.toFixed(4)}{" "}
                                        <span className="text-ink-400">Ξ</span>
                                    </div>
                                    <div className="text-ink-500 text-sm">
                                        total volume
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Live Feed */}
                        <div className="pt-8">
                            <LiveFeed events={recentEvents} />
                        </div>
                    </div>
                </div>

                {/* Decorative bottom border */}
                <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-ink-800 to-transparent" />
            </section>

            {/* Gallery Section */}
            <section
                id="gallery"
                className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16"
            >
                {/* Section Header */}
                <div className="flex items-center justify-between mb-10">
                    <div className="space-y-1">
                        <h2 className="text-2xl sm:text-3xl font-mono text-ink-100">
                            Latest Works
                        </h2>
                        <p className="text-ink-500 text-sm">
                            Fresh from the creative minds
                        </p>
                    </div>
                    {activityMeta && (
                        <div className="hidden sm:block">
                            <SyncStatus meta={activityMeta} compact />
                        </div>
                    )}
                </div>

                {/* NFT Grid */}
                <InfiniteScroll
                    dataLength={nfts.length}
                    next={() => getMoreIds(increment)}
                    hasMore={nfts.length < lastNFTId}
                    loader={
                        <div className="col-span-full flex justify-center py-8">
                            <div className="flex items-center gap-3 text-ink-400">
                                <svg
                                    className="animate-spin h-5 w-5"
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
                                <span>Loading more...</span>
                            </div>
                        </div>
                    }
                    endMessage={
                        lastNFTId === null ? (
                            <div className="col-span-full flex justify-center py-8">
                                <div className="flex items-center gap-3 text-ink-400">
                                    <svg
                                        className="animate-spin h-5 w-5"
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
                                    <span>Loading...</span>
                                </div>
                            </div>
                        ) : (
                            <div className="col-span-full text-center py-12">
                                <p className="text-ink-500">
                                    You've seen all {lastNFTId} NFTs!
                                </p>
                                <button
                                    onClick={() => navigate("/mint")}
                                    className="mt-4 text-accent-cyan hover:text-accent-cyan/80 transition-colors"
                                >
                                    Create your own →
                                </button>
                            </div>
                        )
                    }
                >
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
                        {nfts.map((id) => (
                            <NFTCard
                                id={id}
                                key={id}
                                prefetchedData={nftDataCache[id]}
                            />
                        ))}
                    </div>
                </InfiniteScroll>
            </section>
        </div>
    );
}

