import { Fragment, useCallback } from "react";
import { useEffect, useState } from "react";
import { formatEther, zeroAddress } from "viem";
import { publicClient } from "../common/provider";
import { NFTCard, Address } from "../components";
import config from "../config";
import { v1 } from "../common/abi";
import { Header } from "../components";
import { useRecoilState } from "recoil";
import { formatError, standardErrorState } from "../common/error";
import StandardErrorDisplay from "../components/StandardErrorDisplay";
import { useNavigate, Link } from "react-router-dom";
import { useNewEvents, useSocketStatus, useSyncStatus } from "../common/socket";
import SyncStatus, { useSyncMeta } from "../components/SyncStatus";
import makeBlockie from "ethereum-blockies-base64";
import { PrefetchLink } from "../components";

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
    const [topArtists, setTopArtists] = useState([]);
    const [topCollectors, setTopCollectors] = useState([]);

    const zangAddress = config.contractAddresses.v1.zang;

    // Single unified fetch for all home page data
    useEffect(() => {
        const fetchHomeData = async () => {
            try {
                const response = await fetch("/api/home");
                if (!response.ok) throw new Error("Failed to fetch home data");

                const data = await response.json();

                // Set lastNFTId from cache
                setLastNFTId(data.lastNftId);

                // Set stats
                if (data.stats) {
                    setUniqueArtists(data.stats.uniqueArtists);
                    setTotalVolume(data.stats.totalVolumeEth);
                }

                // Set leaderboards
                setTopArtists(data.topArtists || []);
                setTopCollectors(data.topCollectors || []);

                // Set sync metadata
                if (data._meta) {
                    setActivityMeta(data._meta);
                }

                // Set NFT IDs and cache prefetched data
                if (data.nfts && data.nfts.length > 0) {
                    const ids = data.nfts.map(n => parseInt(n.id, 10));
                    setNFTs(ids);

                    // Build cache from prefetched data (includes content for instant preview)
                    const cache = {};
                    for (const nft of data.nfts) {
                        cache[nft.id] = {
                            token_id: nft.id,
                            name: nft.name,
                            description: nft.description,
                            author: nft.author,
                            content_type: nft.contentType,
                            content: nft.content, // Include content for immediate preview
                            // Include pre-computed stats for NFTCard (eliminates RPC calls)
                            _stats: {
                                totalSupply: nft.totalSupply,
                                floorPrice: nft.floorPrice,
                                listedCount: nft.listedCount,
                                totalVolume: nft.totalVolume,
                            },
                        };
                    }
                    setNftDataCache(cache);
                }

                // Process recent events for live feed
                if (data.recentEvents && data.recentEvents.length > 0) {
                    const feedEvents = data.recentEvents
                        .filter(e => e.type !== "TransferSingle" || e.type === "TransferSingle") // Keep all for now
                        .map(e => {
                            let type = "transfer";
                            if (e.type === "TransferSingle") type = "mint";
                            else if (e.type === "TokenPurchased") type = "purchase";
                            else if (e.type === "TokenListed") type = "list";

                            // Get content type label for mint events
                            let contentTypeLabel = "text";
                            if (e.contentType === "text/html") contentTypeLabel = "HTML";
                            else if (e.contentType === "text/markdown") contentTypeLabel = "markdown";
                            else if (e.contentType === "text/plain") contentTypeLabel = "text";

                            return {
                                type,
                                id: e.tokenId.toString(),
                                title: e.title || `#${e.tokenId}`,
                                blockNumber: e.blockNumber,
                                price: e.price,
                                contentType: contentTypeLabel,
                            };
                        })
                        .filter(e => e.type !== "transfer")
                        .slice(0, 10);

                    setRecentEvents(feedEvents);
                }
            } catch (e) {
                console.error("Error fetching home data:", e);
                // Fallback to RPC for lastNFTId if API fails
                try {
                    const newLastNFTId = await publicClient.readContract({
                        address: zangAddress,
                        abi: v1.zang,
                        functionName: "lastTokenId",
                    });
                    setLastNFTId(Number(newLastNFTId));
                } catch (rpcError) {
                    setStandardError(formatError(rpcError));
                }
            }
        };
        fetchHomeData();
    }, [setStandardError, zangAddress, setActivityMeta]);

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

    // Note: NFT data is now fetched via /api/home unified endpoint
    // No need for separate getMoreIds - data comes pre-cached

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
                                    "Write beauty.",
                                    "Words forever.",
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

            {/* Gallery Section - Latest Works */}
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

                {/* NFT Grid - Limited to 12 */}
                {lastNFTId === null ? (
                    <div className="flex justify-center py-8">
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
                    <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {nfts.slice(0, 12).map((id) => (
                                <NFTCard
                                    id={id}
                                    key={id}
                                    prefetchedData={nftDataCache[id]}
                                />
                            ))}
                        </div>
                        {lastNFTId > 12 && (
                            <div className="text-center mt-10">
                                <Link
                                    to="/gallery"
                                    className="inline-flex items-center gap-2 px-6 py-3 bg-ink-800 text-ink-200 font-medium rounded-lg hover:bg-ink-700 hover:text-white transition-colors"
                                >
                                    See All Works
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                    </svg>
                                </Link>
                            </div>
                        )}
                    </>
                )}
            </section>

            {/* Top Artists Section */}
            {topArtists.length > 0 && (
                <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 border-t border-ink-800">
                    <div className="space-y-1 mb-10">
                        <h2 className="text-2xl sm:text-3xl font-mono text-ink-100">
                            Top Artists
                        </h2>
                        <p className="text-ink-500 text-sm">
                            By sales volume
                        </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {topArtists.slice(0, 6).map((artist, index) => (
                            <PrefetchLink
                                key={artist.address}
                                to={`/profile?address=${artist.address}`}
                                className="flex items-center gap-4 p-5 bg-ink-900/50 rounded-xl border border-ink-800 hover:border-ink-600 hover:bg-ink-800/50 transition-colors"
                            >
                                <span className="text-ink-500 font-mono text-lg w-6">
                                    {index + 1}
                                </span>
                                <img
                                    src={makeBlockie(artist.address)}
                                    alt=""
                                    className="w-12 h-12 rounded-lg"
                                />
                                <div className="flex-1 min-w-0">
                                    <div className="text-ink-200 font-mono text-sm">
                                        <Address address={artist.address} shorten nChar={6} disableLink />
                                    </div>
                                    <div className="text-ink-500 text-xs mt-1">
                                        {artist.totalCreated} works · {artist.volumeEth.toFixed(4)} ETH
                                    </div>
                                </div>
                            </PrefetchLink>
                        ))}
                    </div>
                </section>
            )}

            {/* Top Collectors Section */}
            {topCollectors.length > 0 && (
                <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 border-t border-ink-800">
                    <div className="space-y-1 mb-10">
                        <h2 className="text-2xl sm:text-3xl font-mono text-ink-100">
                            Top Collectors
                        </h2>
                        <p className="text-ink-500 text-sm">
                            By purchase volume
                        </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {topCollectors.slice(0, 6).map((collector, index) => (
                            <PrefetchLink
                                key={collector.address}
                                to={`/profile?address=${collector.address}`}
                                className="flex items-center gap-4 p-5 bg-ink-900/50 rounded-xl border border-ink-800 hover:border-ink-600 hover:bg-ink-800/50 transition-colors"
                            >
                                <span className="text-ink-500 font-mono text-lg w-6">
                                    {index + 1}
                                </span>
                                <img
                                    src={makeBlockie(collector.address)}
                                    alt=""
                                    className="w-12 h-12 rounded-lg"
                                />
                                <div className="flex-1 min-w-0">
                                    <div className="text-ink-200 font-mono text-sm">
                                        <Address address={collector.address} shorten nChar={6} disableLink />
                                    </div>
                                    <div className="text-ink-500 text-xs mt-1">
                                        {collector.totalCollected} collected · {collector.volumeEth.toFixed(4)} ETH
                                    </div>
                                </div>
                            </PrefetchLink>
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
}

