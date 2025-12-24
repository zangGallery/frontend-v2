import { useEffect, useState, useCallback } from "react";
import { NFTCard } from "../components";
import InfiniteScroll from "react-infinite-scroll-component";
import { Header } from "../components";
import StandardErrorDisplay from "../components/StandardErrorDisplay";

import "../styles/tailwind.css";
import "../styles/globals.css";

export default function Gallery() {
    const [lastNFTId, setLastNFTId] = useState(null);
    const [nfts, setNFTs] = useState([]);
    const [nftDataCache, setNftDataCache] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [hasMore, setHasMore] = useState(true);
    const [offset, setOffset] = useState(0);

    const limit = 12;

    // Transform API response to cache format
    const buildCache = (apiNfts, existingCache) => {
        const cache = { ...existingCache };
        for (const nft of apiNfts) {
            cache[nft.id] = {
                token_id: nft.id,
                name: nft.name,
                description: nft.description,
                author: nft.author,
                content_type: nft.contentType,
                content: nft.content,
                _stats: {
                    totalSupply: nft.totalSupply,
                    floorPrice: nft.floorPrice,
                    listedCount: nft.listedCount,
                    totalVolume: nft.totalVolume,
                },
            };
        }
        return cache;
    };

    // Fetch initial data
    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const response = await fetch(`/api/gallery?limit=${limit}&offset=0`);
                const data = await response.json();

                setLastNFTId(data.lastNftId);
                setNftDataCache(buildCache(data.nfts, {}));
                setNFTs(data.nfts.map(n => n.id));
                setHasMore(data.hasMore);
                setOffset(data.nfts.length);
                setIsLoading(false);
            } catch (e) {
                console.error("Failed to fetch gallery data:", e);
                setIsLoading(false);
            }
        };

        fetchInitialData();
    }, []);

    // Load more with prefetched data
    const loadMore = useCallback(async () => {
        if (!hasMore) return;

        try {
            const response = await fetch(`/api/gallery?limit=${limit}&offset=${offset}`);
            const data = await response.json();

            setNftDataCache(prev => buildCache(data.nfts, prev));
            setNFTs(prev => [...prev, ...data.nfts.map(n => n.id)]);
            setHasMore(data.hasMore);
            setOffset(prev => prev + data.nfts.length);
        } catch (e) {
            console.error("Failed to load more:", e);
        }
    }, [offset, hasMore]);

    return (
        <div className="min-h-screen bg-ink-950">
            <Header />
            <StandardErrorDisplay />
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="space-y-1 mb-10">
                    <h1 className="text-3xl md:text-4xl font-mono text-ink-100">
                        Gallery
                    </h1>
                    <p className="text-ink-500">
                        {lastNFTId !== null ? `${lastNFTId} works` : "Loading..."}
                    </p>
                </div>

                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3">
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
                        <span className="text-ink-400">Loading gallery...</span>
                    </div>
                ) : (
                    <InfiniteScroll
                        dataLength={nfts.length}
                        next={loadMore}
                        hasMore={hasMore}
                        loader={
                            <div className="flex justify-center py-8">
                                <svg
                                    className="animate-spin h-6 w-6 text-accent-cyan"
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
                            </div>
                        }
                        endMessage={
                            <p className="text-center text-ink-500 py-8">
                                You've seen all {lastNFTId} works
                            </p>
                        }
                    >
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {nfts.map((id) => (
                                <NFTCard
                                    key={id}
                                    id={id}
                                    prefetchedData={nftDataCache[id]}
                                />
                            ))}
                        </div>
                    </InfiniteScroll>
                )}
            </div>
        </div>
    );
}
