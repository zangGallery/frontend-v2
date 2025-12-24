import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { NFTCard, Header } from "../components";
import { useEns } from "../common/ens";
import config from "../config";
import makeBlockie from "ethereum-blockies-base64";

import "../styles/tailwind.css";
import "../styles/globals.css";

import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";

export default function ProfilePage() {
    const location = useLocation();
    const searchParams = new URLSearchParams(location.search);
    const address = searchParams.get("address")?.toLowerCase();

    const { lookupEns } = useEns();

    const [profileData, setProfileData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState("created");
    const [copied, setCopied] = useState(false);

    // Generate blockie avatar
    const blockieUrl = address ? makeBlockie(address) : null;

    // Fetch profile data
    useEffect(() => {
        if (!address) {
            setError("No address provided");
            setIsLoading(false);
            return;
        }

        // Validate address format
        if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
            setError("Invalid address format");
            setIsLoading(false);
            return;
        }

        const fetchProfile = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const response = await fetch(`/api/author/${address}`);
                if (!response.ok) {
                    throw new Error("Failed to fetch profile");
                }
                const data = await response.json();
                setProfileData(data);
            } catch (e) {
                setError(e.message);
            } finally {
                setIsLoading(false);
            }
        };

        fetchProfile();
    }, [address]);

    // Set document title
    useEffect(() => {
        const ensName = lookupEns(address);
        const displayName = ensName || shortenAddress(address);
        document.title = displayName ? `${displayName} - zang` : "Profile - zang";
    }, [address, lookupEns]);

    const shortenAddress = (addr) => {
        if (!addr) return "";
        return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
    };

    const copyAddress = () => {
        navigator.clipboard.writeText(address);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const ensName = address ? lookupEns(address) : null;
    const displayName = ensName || shortenAddress(address);

    const currentNfts = activeTab === "created"
        ? profileData?.created || []
        : profileData?.collected || [];

    // Transform NFT data for NFTCard prefetchedData format
    const getPrefetchedData = (nft) => ({
        token_id: nft.token_id,
        name: nft.name,
        description: nft.description,
        author: nft.author,
        content_type: nft.content_type,
        content: nft.content,
        _stats: {
            totalSupply: nft.total_supply ? parseInt(nft.total_supply, 10) : null,
            floorPrice: nft.floor_price,
            listedCount: nft.listed_count || 0,
            totalVolume: nft.total_volume || '0',
        },
    });

    return (
        <div className="min-h-screen bg-ink-950">
            <Header />
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                {error ? (
                    <div className="text-center py-16">
                        <div className="inline-block p-8 rounded-2xl bg-ink-900/50 border border-ink-800">
                            <p className="text-red-400 text-lg mb-4">{error}</p>
                            <a
                                href="/"
                                className="inline-flex items-center px-6 py-3 bg-accent-cyan text-ink-950 font-medium rounded-lg hover:bg-accent-cyan/90 transition-colors"
                            >
                                Back to Home
                            </a>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Profile Header */}
                        <div className="bg-ink-900/50 rounded-2xl border border-ink-800 p-6 mb-8">
                            <div className="flex flex-col sm:flex-row items-center gap-6">
                                {/* Avatar */}
                                {blockieUrl ? (
                                    <img
                                        src={blockieUrl}
                                        alt="Avatar"
                                        className="w-20 h-20 rounded-xl"
                                    />
                                ) : (
                                    <Skeleton
                                        width={80}
                                        height={80}
                                        className="rounded-xl"
                                        baseColor="#27272a"
                                        highlightColor="#3f3f46"
                                    />
                                )}

                                {/* Name and Address */}
                                <div className="flex-1 text-center sm:text-left">
                                    <h1 className="text-2xl font-bold text-white mb-2 font-mono">
                                        {displayName || (
                                            <Skeleton
                                                width={200}
                                                baseColor="#27272a"
                                                highlightColor="#3f3f46"
                                            />
                                        )}
                                    </h1>
                                    {ensName && (
                                        <p className="text-ink-400 font-mono text-sm mb-2">
                                            {shortenAddress(address)}
                                        </p>
                                    )}
                                    <div className="flex items-center justify-center sm:justify-start gap-3">
                                        <button
                                            onClick={copyAddress}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-ink-800 text-ink-300 hover:text-white hover:bg-ink-700 transition-colors text-sm"
                                        >
                                            {copied ? (
                                                <>
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                    Copied
                                                </>
                                            ) : (
                                                <>
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                    </svg>
                                                    Copy
                                                </>
                                            )}
                                        </button>
                                        <a
                                            href={`${config.blockExplorer.url}/address/${address}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-ink-800 text-ink-300 hover:text-white hover:bg-ink-700 transition-colors text-sm"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                            </svg>
                                            Basescan
                                        </a>
                                    </div>
                                </div>

                                {/* Stats */}
                                <div className="flex gap-6 text-center">
                                    <div>
                                        <div className="text-2xl font-bold text-white">
                                            {isLoading ? (
                                                <Skeleton width={40} baseColor="#27272a" highlightColor="#3f3f46" />
                                            ) : (
                                                profileData?.stats?.totalCreated || 0
                                            )}
                                        </div>
                                        <div className="text-xs text-ink-400 uppercase tracking-wide">Created</div>
                                    </div>
                                    <div>
                                        <div className="text-2xl font-bold text-white">
                                            {isLoading ? (
                                                <Skeleton width={40} baseColor="#27272a" highlightColor="#3f3f46" />
                                            ) : (
                                                profileData?.stats?.totalCollected || 0
                                            )}
                                        </div>
                                        <div className="text-xs text-ink-400 uppercase tracking-wide">Collected</div>
                                    </div>
                                    <div>
                                        <div className="text-2xl font-bold text-white">
                                            {isLoading ? (
                                                <Skeleton width={60} baseColor="#27272a" highlightColor="#3f3f46" />
                                            ) : (
                                                <>{profileData?.stats?.totalVolume || "0"} <span className="text-ink-400 text-base">ETH</span></>
                                            )}
                                        </div>
                                        <div className="text-xs text-ink-400 uppercase tracking-wide">Volume</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Tabs */}
                        <div className="flex gap-2 mb-6">
                            <button
                                onClick={() => setActiveTab("created")}
                                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                                    activeTab === "created"
                                        ? "bg-accent-cyan text-ink-950"
                                        : "bg-ink-800 text-ink-300 hover:text-white hover:bg-ink-700"
                                }`}
                            >
                                Created ({profileData?.stats?.totalCreated || 0})
                            </button>
                            <button
                                onClick={() => setActiveTab("collected")}
                                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                                    activeTab === "collected"
                                        ? "bg-accent-cyan text-ink-950"
                                        : "bg-ink-800 text-ink-300 hover:text-white hover:bg-ink-700"
                                }`}
                            >
                                Collected ({profileData?.stats?.totalCollected || 0})
                            </button>
                        </div>

                        {/* NFT Grid */}
                        {isLoading ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {[1, 2, 3].map((i) => (
                                    <div key={i} className="bg-ink-900/50 rounded-2xl border border-ink-800 overflow-hidden">
                                        <Skeleton height={208} baseColor="#27272a" highlightColor="#3f3f46" />
                                        <div className="p-4">
                                            <Skeleton count={2} baseColor="#27272a" highlightColor="#3f3f46" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : currentNfts.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {currentNfts.map((nft) => (
                                    <NFTCard
                                        key={nft.token_id}
                                        id={nft.token_id}
                                        prefetchedData={getPrefetchedData(nft)}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-16">
                                <div className="inline-block p-8 rounded-2xl bg-ink-900/50 border border-ink-800">
                                    <p className="text-ink-400 text-lg">
                                        {activeTab === "created"
                                            ? "No artworks created yet"
                                            : "No artworks collected yet"}
                                    </p>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
