import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { NFTCard } from "../components";
import { Header } from "../components";
import StandardErrorDisplay from "../components/StandardErrorDisplay";

import "../styles/tailwind.css";
import "../styles/globals.css";

const SORT_OPTIONS = [
    { value: "newest", label: "Newest" },
    { value: "oldest", label: "Oldest" },
    { value: "price_low", label: "Price: Low → High" },
    { value: "price_high", label: "Price: High → Low" },
    { value: "editions", label: "Most Editions" },
];

const TYPE_OPTIONS = [
    { value: "all", label: "All Types" },
    { value: "html", label: "HTML" },
    { value: "markdown", label: "Markdown" },
    { value: "plain", label: "Plain Text" },
];

const ITEMS_PER_PAGE = 12;

export default function Gallery() {
    const [searchParams, setSearchParams] = useSearchParams();

    // Read state from URL
    const page = parseInt(searchParams.get("page") || "1", 10);
    const sort = searchParams.get("sort") || "newest";
    const contentType = searchParams.get("type") || "all";
    const listedOnly = searchParams.get("listed") === "yes";

    const [totalCount, setTotalCount] = useState(null);
    const [nfts, setNFTs] = useState([]);
    const [nftDataCache, setNftDataCache] = useState({});
    const [isLoading, setIsLoading] = useState(true);

    // Update URL params
    const updateParams = (updates) => {
        const newParams = new URLSearchParams(searchParams);
        Object.entries(updates).forEach(([key, value]) => {
            if (value === null || value === undefined || value === "" ||
                (key === "page" && value === 1) ||
                (key === "sort" && value === "newest") ||
                (key === "type" && value === "all") ||
                (key === "listed" && value === false)) {
                newParams.delete(key);
            } else if (key === "listed") {
                if (value) newParams.set(key, "yes");
                else newParams.delete(key);
            } else {
                newParams.set(key, value.toString());
            }
        });
        setSearchParams(newParams, { replace: true });
    };

    // Transform API response to cache format
    const buildCache = (apiNfts) => {
        const cache = {};
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

    // Fetch data
    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams({
                limit: ITEMS_PER_PAGE.toString(),
                offset: ((page - 1) * ITEMS_PER_PAGE).toString(),
                sort,
                type: contentType,
            });
            if (listedOnly) params.set("listed", "yes");

            const response = await fetch(`/api/gallery?${params}`);
            const data = await response.json();

            setNftDataCache(buildCache(data.nfts));
            setNFTs(data.nfts.map(n => n.id));
            setTotalCount(data.totalCount);
            setIsLoading(false);
        } catch (e) {
            console.error("Failed to fetch gallery data:", e);
            setIsLoading(false);
        }
    }, [page, sort, contentType, listedOnly]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const totalPages = Math.ceil((totalCount || 0) / ITEMS_PER_PAGE);
    const hasActiveFilters = sort !== "newest" || contentType !== "all" || listedOnly;

    const resetFilters = () => {
        setSearchParams({}, { replace: true });
    };

    const goToPage = (newPage) => {
        updateParams({ page: newPage });
        window.scrollTo({ top: 0, behavior: 'instant' });
    };

    // Generate page numbers to show
    const getPageNumbers = () => {
        const pages = [];
        const showEllipsis = totalPages > 7;

        if (!showEllipsis) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            pages.push(1);
            if (page > 3) pages.push("...");

            const start = Math.max(2, page - 1);
            const end = Math.min(totalPages - 1, page + 1);

            for (let i = start; i <= end; i++) pages.push(i);

            if (page < totalPages - 2) pages.push("...");
            if (totalPages > 1) pages.push(totalPages);
        }

        return pages;
    };

    return (
        <div className="min-h-screen bg-ink-950">
            <Header />
            <StandardErrorDisplay />
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                {/* Header */}
                <div className="space-y-1 mb-8">
                    <h1 className="text-3xl md:text-4xl font-mono text-ink-100">
                        Gallery
                    </h1>
                    <p className="text-ink-500">
                        {totalCount !== null ? `${totalCount} works` : "Loading..."}
                    </p>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-3 mb-8 pb-6 border-b border-ink-800">
                    {/* Sort */}
                    <div className="flex items-center gap-2">
                        <label className="text-xs text-ink-500 uppercase tracking-wide">Sort</label>
                        <select
                            value={sort}
                            onChange={(e) => updateParams({ sort: e.target.value, page: 1 })}
                            className="bg-ink-900 border border-ink-700 rounded-lg pl-3 pr-8 py-2 text-sm text-ink-200 focus:outline-none focus:border-ink-500 cursor-pointer"
                        >
                            {SORT_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Type filter */}
                    <div className="flex items-center gap-2">
                        <label className="text-xs text-ink-500 uppercase tracking-wide">Type</label>
                        <select
                            value={contentType}
                            onChange={(e) => updateParams({ type: e.target.value, page: 1 })}
                            className="bg-ink-900 border border-ink-700 rounded-lg pl-3 pr-8 py-2 text-sm text-ink-200 focus:outline-none focus:border-ink-500 cursor-pointer"
                        >
                            {TYPE_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* For Sale toggle */}
                    <button
                        onClick={() => updateParams({ listed: !listedOnly, page: 1 })}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
                            listedOnly
                                ? "bg-accent-cyan/10 border-accent-cyan/50 text-accent-cyan"
                                : "bg-ink-900 border-ink-700 text-ink-400 hover:text-ink-200 hover:border-ink-600"
                        }`}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        For Sale
                    </button>

                    {/* Reset */}
                    {hasActiveFilters && (
                        <button
                            onClick={resetFilters}
                            className="text-sm text-ink-500 hover:text-ink-300 transition-colors ml-auto"
                        >
                            Reset filters
                        </button>
                    )}
                </div>

                {/* Content */}
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
                ) : nfts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3">
                        <svg className="w-12 h-12 text-ink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-ink-400">No works match your filters</p>
                        <button
                            onClick={resetFilters}
                            className="text-sm text-accent-cyan hover:underline"
                        >
                            Clear filters
                        </button>
                    </div>
                ) : (
                    <>
                        {/* Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {nfts.map((id) => (
                                <NFTCard
                                    key={id}
                                    id={id}
                                    prefetchedData={nftDataCache[id]}
                                />
                            ))}
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-center gap-2 mt-12">
                                {/* Previous */}
                                <button
                                    onClick={() => goToPage(page - 1)}
                                    disabled={page === 1}
                                    className="px-3 py-2 rounded-lg border border-ink-700 text-sm text-ink-400 hover:text-ink-200 hover:border-ink-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                >
                                    ← Prev
                                </button>

                                {/* Page numbers */}
                                <div className="flex items-center gap-1">
                                    {getPageNumbers().map((p, i) => (
                                        p === "..." ? (
                                            <span key={`ellipsis-${i}`} className="px-2 text-ink-500">...</span>
                                        ) : (
                                            <button
                                                key={p}
                                                onClick={() => goToPage(p)}
                                                className={`min-w-[40px] px-3 py-2 rounded-lg text-sm transition-colors ${
                                                    p === page
                                                        ? "bg-ink-700 text-white"
                                                        : "text-ink-400 hover:text-ink-200 hover:bg-ink-800"
                                                }`}
                                            >
                                                {p}
                                            </button>
                                        )
                                    ))}
                                </div>

                                {/* Next */}
                                <button
                                    onClick={() => goToPage(page + 1)}
                                    disabled={page === totalPages}
                                    className="px-3 py-2 rounded-lg border border-ink-700 text-sm text-ink-400 hover:text-ink-200 hover:border-ink-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                >
                                    Next →
                                </button>
                            </div>
                        )}

                        {/* Page info */}
                        <p className="text-center text-ink-500 text-sm mt-4">
                            Showing {((page - 1) * ITEMS_PER_PAGE) + 1}–{Math.min(page * ITEMS_PER_PAGE, totalCount)} of {totalCount}
                        </p>
                    </>
                )}
            </div>
        </div>
    );
}
