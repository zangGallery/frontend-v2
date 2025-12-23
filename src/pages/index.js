import React, { useEffect, useState } from "react";
import { defaultReadProvider, useReadProvider } from "../common/provider";
import { NFTCard } from "../components";
import InfiniteScroll from "react-infinite-scroll-component";
import config from "../config";
import { v1 } from "../common/abi";
import { ethers } from "ethers";
import { Header } from "../components";
import { useRecoilState } from "recoil";
import { formatError, standardErrorState } from "../common/error";
import StandardErrorDisplay from "../components/StandardErrorDisplay";
import { navigate } from "gatsby-link";
import { formatEther } from "@ethersproject/units";

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
            <span className="transition-opacity duration-300">
                {getEventIcon(event)}{" "}
                <span className="text-ink-500">#{event.id}</span>{" "}
                <span className="text-ink-200 font-medium">{event.title}</span>{" "}
                · {getEventText(event)}
            </span>
        </div>
    );
}

export default function Home() {
    const [readProvider] = useReadProvider();
    const [lastNFTId, setLastNFTId] = useState(null);
    const [nfts, setNFTs] = useState([]);
    const [, setStandardError] = useRecoilState(standardErrorState);
    const [recentEvents, setRecentEvents] = useState([]);
    const [totalVolume, setTotalVolume] = useState(null);
    const [uniqueArtists, setUniqueArtists] = useState(null);

    const increment = 6;

    useEffect(() => {
        const fetchLastTokenId = async () => {
            const contractAddress = config.contractAddresses.v1.zang;
            const contractABI = v1.zang;
            const contract = new ethers.Contract(
                contractAddress,
                contractABI,
                readProvider,
            );

            try {
                const newLastNFTId = await contract.lastTokenId();
                setLastNFTId(newLastNFTId.toNumber());
            } catch (e) {
                setStandardError(formatError(e));
            }
        };
        fetchLastTokenId();
    }, [readProvider, setStandardError]);

    // Fetch recent events for live feed and stats
    useEffect(() => {
        const fetchRecentEvents = async () => {
            if (!defaultReadProvider) return;

            try {
                const marketplaceContract = new ethers.Contract(
                    config.contractAddresses.v1.marketplace,
                    v1.marketplace,
                    defaultReadProvider,
                );
                const zangContract = new ethers.Contract(
                    config.contractAddresses.v1.zang,
                    v1.zang,
                    defaultReadProvider,
                );

                const currentBlock = await defaultReadProvider.getBlockNumber();
                const fromBlock = Math.max(
                    currentBlock - 50000,
                    config.firstBlocks.v1.base.zang,
                );

                // Fetch events in parallel
                const [mintEvents, purchaseEvents, listEvents] =
                    await Promise.all([
                        zangContract.queryFilter(
                            zangContract.filters.TransferSingle(
                                null,
                                ethers.constants.AddressZero,
                            ),
                            fromBlock,
                        ),
                        marketplaceContract.queryFilter(
                            marketplaceContract.filters.TokenPurchased(),
                            fromBlock,
                        ),
                        marketplaceContract.queryFilter(
                            marketplaceContract.filters.TokenListed(),
                            fromBlock,
                        ),
                    ]);

                // Process events for feed
                const events = [
                    ...mintEvents.map((e) => ({
                        type: "mint",
                        id: e.args.id.toString(),
                        blockNumber: e.blockNumber,
                    })),
                    ...purchaseEvents.map((e) => ({
                        type: "purchase",
                        id: e.args._tokenId.toString(),
                        price: formatEther(e.args._price.toString()),
                        blockNumber: e.blockNumber,
                    })),
                    ...listEvents
                        .slice(-10)
                        .map((e) => ({
                            type: "list",
                            id: e.args._tokenId.toString(),
                            price: formatEther(e.args._price.toString()),
                            blockNumber: e.blockNumber,
                        })),
                ]
                    .sort((a, b) => b.blockNumber - a.blockNumber)
                    .slice(0, 10);

                // Fetch titles and content types for each unique NFT
                const uniqueIds = [...new Set(events.map((e) => e.id))];
                const nftData = {};
                await Promise.all(
                    uniqueIds.map(async (id) => {
                        try {
                            const tokenURI = await zangContract.uri(id);
                            const response = await fetch(tokenURI);
                            const metadata = await response.json();

                            // Get content type from text_uri
                            let contentType = "text";
                            if (metadata.text_uri) {
                                if (
                                    metadata.text_uri.startsWith(
                                        "data:text/html",
                                    )
                                ) {
                                    contentType = "HTML";
                                } else if (
                                    metadata.text_uri.startsWith(
                                        "data:text/markdown",
                                    )
                                ) {
                                    contentType = "Markdown";
                                } else {
                                    contentType = "text";
                                }
                            }

                            nftData[id] = {
                                title: metadata.name || `#${id}`,
                                contentType,
                            };
                        } catch {
                            nftData[id] = {
                                title: `#${id}`,
                                contentType: "text",
                            };
                        }
                    }),
                );

                // Add titles and content types to events
                const eventsWithData = events.map((e) => ({
                    ...e,
                    title: nftData[e.id]?.title,
                    contentType: nftData[e.id]?.contentType,
                }));
                setRecentEvents(eventsWithData);

                // Calculate total volume
                const volume = purchaseEvents.reduce((sum, e) => {
                    return (
                        sum +
                        parseFloat(formatEther(e.args._price.toString())) *
                            e.args._amount.toNumber()
                    );
                }, 0);
                setTotalVolume(volume);

                // Get unique artists (minters)
                const artists = new Set(mintEvents.map((e) => e.args.to));
                setUniqueArtists(artists.size);
            } catch (e) {
                console.error("Error fetching events:", e);
            }
        };

        fetchRecentEvents();
    }, []);

    const getMoreIds = (count) => {
        const newNFTs = [...nfts];

        for (let i = 0; i < count; i++) {
            const newId = lastNFTId - newNFTs.length;
            if (newId >= 1) {
                newNFTs.push(newId);
            }
        }

        setNFTs(newNFTs);
    };

    useEffect(() => getMoreIds(12), [lastNFTId]);

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
                            <span className="text-ink-400">{">"}</span>{" "}
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
                                        artists (recent)
                                    </div>
                                </div>
                            )}
                            {totalVolume !== null && totalVolume > 0 && (
                                <div className="text-center">
                                    <div className="text-3xl font-mono text-white">
                                        {totalVolume.toFixed(3)}{" "}
                                        <span className="text-ink-400">Ξ</span>
                                    </div>
                                    <div className="text-ink-500 text-sm">
                                        volume (recent)
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
                    <div className="hidden sm:flex items-center gap-2 text-ink-600 text-sm font-mono">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                        Live
                    </div>
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
                            <NFTCard id={id} key={id} />
                        ))}
                    </div>
                </InfiniteScroll>
            </section>
        </div>
    );
}

// Gatsby Head API for SEO
export function Head() {
    return (
        <>
            <title>zang - Text-based NFTs</title>
            <meta
                name="description"
                content="Create and collect text-based NFTs on Base. Poetry, prose, code, and HTML art - all onchain."
            />
            <meta
                name="keywords"
                content="zang, text, NFTs, onchain, typography, art, Base, blockchain"
            />
            <meta charSet="utf-8" />
            <link rel="icon" href="/favicon.ico" />
        </>
    );
}
