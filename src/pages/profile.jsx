import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { NFTCard, Header, UserHistory } from "../components";
import { useEns } from "../common/ens";
import { useProfiles } from "../common/profiles";
import { useAccount, useBalance, useSignMessage } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { formatEther } from "viem";
import config from "../config";
import makeBlockie from "ethereum-blockies-base64";
import { getPrefetchedProfile, getPrefetchedAuthor, getPrefetchedUserHistory } from "../common/prefetch";

import "../styles/tailwind.css";
import "../styles/globals.css";

import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";

export default function ProfilePage() {
    const location = useLocation();
    const searchParams = new URLSearchParams(location.search);
    const address = searchParams.get("address")?.toLowerCase();

    const { address: connectedAddress } = useAccount();
    const isOwnProfile = connectedAddress?.toLowerCase() === address;

    // Fetch balance only for own profile
    const { data: balance } = useBalance({
        address: isOwnProfile ? connectedAddress : undefined,
        chainId: config.networks.main.chainId,
    });

    const formattedBalance = balance
        ? parseFloat(formatEther(balance.value)).toFixed(4)
        : null;

    const { lookupEns } = useEns();
    const { invalidateProfile } = useProfiles();

    const [profileData, setProfileData] = useState(null);
    const [profileInfo, setProfileInfo] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState("created");
    const [copied, setCopied] = useState(false);

    // Edit profile state
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({
        name: "",
        bio: "",
        xUsername: "",
        instagramUsername: "",
        baseUsername: "",
    });
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState(null);

    // Profile setup prompt dismissed state (stored in localStorage)
    const [setupPromptDismissed, setSetupPromptDismissed] = useState(() => {
        try {
            return localStorage.getItem("profileSetupDismissed") === "true";
        } catch {
            return false;
        }
    });

    const dismissSetupPrompt = () => {
        setSetupPromptDismissed(true);
        try {
            localStorage.setItem("profileSetupDismissed", "true");
        } catch {
            // Ignore localStorage errors
        }
    };

    // Check if profile is empty (no name, bio, or social links)
    const isProfileEmpty = !profileInfo?.name && !profileInfo?.bio &&
        !profileInfo?.xUsername && !profileInfo?.instagramUsername && !profileInfo?.baseUsername;

    const showSetupPrompt = isOwnProfile && isProfileEmpty && !setupPromptDismissed && !isEditing && !isLoading;

    const { signMessageAsync } = useSignMessage();

    // Generate blockie avatar
    const blockieUrl = address ? makeBlockie(address) : null;

    // Fetch profile data (NFTs, stats)
    useEffect(() => {
        if (!address) {
            setError("No address provided");
            setIsLoading(false);
            return;
        }

        if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
            setError("Invalid address format");
            setIsLoading(false);
            return;
        }

        const fetchProfile = async () => {
            setIsLoading(true);
            setError(null);
            try {
                // Check for prefetched data first
                const prefetchedProfileInfo = getPrefetchedProfile(address);
                const prefetchedAuthorData = getPrefetchedAuthor(address);

                // If we have prefetched profile info, use it immediately
                if (prefetchedProfileInfo) {
                    setProfileInfo(prefetchedProfileInfo);
                    setEditForm({
                        name: prefetchedProfileInfo.name || "",
                        bio: prefetchedProfileInfo.bio || "",
                        xUsername: prefetchedProfileInfo.xUsername || "",
                        instagramUsername: prefetchedProfileInfo.instagramUsername || "",
                        baseUsername: prefetchedProfileInfo.baseUsername || "",
                    });
                }

                // If we have prefetched author data, use it immediately
                if (prefetchedAuthorData) {
                    setProfileData(prefetchedAuthorData);
                    setIsLoading(false);
                    return; // All data prefetched, no need to fetch
                }

                // Fetch what we don't have prefetched
                const fetchPromises = [fetch(`/api/author/${address}`)];
                if (!prefetchedProfileInfo) {
                    fetchPromises.push(fetch(`/api/profile/${address}`));
                }

                const [authorRes, profileRes] = await Promise.all(fetchPromises);

                if (!authorRes.ok) throw new Error("Failed to fetch profile");

                const authorData = await authorRes.json();
                setProfileData(authorData);

                // Only process profile response if we fetched it
                if (profileRes && profileRes.ok) {
                    const profileInfoData = await profileRes.json();
                    setProfileInfo(profileInfoData);
                    setEditForm({
                        name: profileInfoData.name || "",
                        bio: profileInfoData.bio || "",
                        xUsername: profileInfoData.xUsername || "",
                        instagramUsername: profileInfoData.instagramUsername || "",
                        baseUsername: profileInfoData.baseUsername || "",
                    });
                }
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
        const customName = profileInfo?.name;
        const ensName = lookupEns(address);
        const displayName = customName || ensName || shortenAddress(address);
        document.title = displayName ? `${displayName} - zang` : "Profile - zang";
    }, [address, lookupEns, profileInfo]);

    // Set default tab based on content: show Collected if Created is empty
    useEffect(() => {
        if (!profileData?.stats) return;
        const { totalCreated, totalCollected } = profileData.stats;
        if (totalCreated === 0 && totalCollected > 0) {
            setActiveTab("collected");
        }
    }, [profileData]);

    const shortenAddress = (addr) => {
        if (!addr) return "";
        return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
    };

    const copyAddress = () => {
        navigator.clipboard.writeText(address);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleSaveProfile = async () => {
        setIsSaving(true);
        setSaveError(null);

        try {
            const timestamp = Date.now();
            const cleanForm = {
                name: editForm.name.trim().slice(0, 50) || null,
                bio: editForm.bio.trim().slice(0, 160) || null,
                xUsername: editForm.xUsername.trim().replace(/^@/, "").slice(0, 50) || null,
                instagramUsername: editForm.instagramUsername.trim().replace(/^@/, "").slice(0, 50) || null,
                baseUsername: editForm.baseUsername.trim().slice(0, 50) || null,
            };

            const profileDataJson = JSON.stringify(cleanForm);
            const message = `Update my zang profile:\n\n${profileDataJson}\n\nTimestamp: ${timestamp}`;

            const signature = await signMessageAsync({ message });

            const response = await fetch("/api/profile", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    address: connectedAddress,
                    ...cleanForm,
                    signature,
                    timestamp,
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "Failed to save profile");
            }

            setProfileInfo(result);
            setIsEditing(false);
            invalidateProfile(address);
        } catch (e) {
            setSaveError(e.message || "Failed to save profile");
        } finally {
            setIsSaving(false);
        }
    };

    const ensName = address ? lookupEns(address) : null;
    const displayName = profileInfo?.name || ensName || shortenAddress(address);

    const currentNfts = activeTab === "created"
        ? profileData?.created || []
        : profileData?.collected || [];

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
                            <div className="flex flex-col sm:flex-row items-start gap-6">
                                {/* Avatar */}
                                {blockieUrl ? (
                                    <img
                                        src={blockieUrl}
                                        alt="Avatar"
                                        className="w-20 h-20 rounded-xl flex-shrink-0"
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

                                {/* Name, Bio, and Social Links */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3 mb-2">
                                        <h1 className="text-2xl font-bold text-white font-mono truncate">
                                            {displayName || (
                                                <Skeleton
                                                    width={200}
                                                    baseColor="#27272a"
                                                    highlightColor="#3f3f46"
                                                />
                                            )}
                                        </h1>
                                        {isOwnProfile && !isEditing && !showSetupPrompt && (
                                            <button
                                                onClick={() => setIsEditing(true)}
                                                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-ink-800 text-ink-400 hover:text-white hover:bg-ink-700 transition-colors text-sm"
                                            >
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                </svg>
                                                Edit
                                            </button>
                                        )}
                                    </div>

                                    {ensName && profileInfo?.name && (
                                        <p className="text-ink-400 font-mono text-sm mb-2">
                                            {ensName}
                                        </p>
                                    )}

                                    {/* Setup profile prompt */}
                                    {showSetupPrompt && (
                                        <div className="flex items-center gap-3 mb-3 p-3 bg-ink-800/50 rounded-lg border border-ink-700">
                                            <p className="text-ink-300 text-sm flex-1">
                                                Add a display name, bio, and social links to personalize your profile.
                                            </p>
                                            <button
                                                onClick={() => setIsEditing(true)}
                                                className="px-3 py-1.5 bg-accent-cyan text-ink-950 font-medium rounded-lg hover:bg-accent-cyan/90 transition-colors text-sm whitespace-nowrap"
                                            >
                                                Set up profile
                                            </button>
                                            <button
                                                onClick={dismissSetupPrompt}
                                                className="p-1.5 text-ink-500 hover:text-ink-300 transition-colors"
                                                title="Dismiss"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            </button>
                                        </div>
                                    )}

                                    {profileInfo?.bio && (
                                        <p className="text-ink-300 text-sm mb-3 max-w-xl">
                                            {profileInfo.bio}
                                        </p>
                                    )}

                                    {/* Links and Actions */}
                                    <div className="flex flex-wrap items-center gap-2">
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
                                                    <span className="font-mono">{shortenAddress(address)}</span>
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
                                        {isOwnProfile && (
                                            <ConnectButton.Custom>
                                                {({ openAccountModal }) => (
                                                    <button
                                                        onClick={openAccountModal}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-ink-800 text-ink-300 hover:text-white hover:bg-ink-700 transition-colors text-sm"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                                                        </svg>
                                                        Wallet
                                                    </button>
                                                )}
                                            </ConnectButton.Custom>
                                        )}
                                        {profileInfo?.xUsername && (
                                            <a
                                                href={`https://x.com/${profileInfo.xUsername}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-ink-800 text-ink-300 hover:text-white hover:bg-ink-700 transition-colors text-sm"
                                            >
                                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                                                </svg>
                                                @{profileInfo.xUsername}
                                            </a>
                                        )}
                                        {profileInfo?.instagramUsername && (
                                            <a
                                                href={`https://instagram.com/${profileInfo.instagramUsername}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-ink-800 text-ink-300 hover:text-white hover:bg-ink-700 transition-colors text-sm"
                                            >
                                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                                                </svg>
                                                @{profileInfo.instagramUsername}
                                            </a>
                                        )}
                                        {profileInfo?.baseUsername && (
                                            <a
                                                href={`https://www.base.app/profile/${profileInfo.baseUsername}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-ink-800 text-ink-300 hover:text-white hover:bg-ink-700 transition-colors text-sm"
                                            >
                                                <svg className="w-4 h-4" viewBox="0 0 1280 1280" fill="currentColor">
                                                    <path d="M0,101.12c0-34.64,0-51.95,6.53-65.28,6.25-12.76,16.56-23.07,29.32-29.32C49.17,0,66.48,0,101.12,0h1077.76c34.63,0,51.96,0,65.28,6.53,12.75,6.25,23.06,16.56,29.32,29.32,6.52,13.32,6.52,30.64,6.52,65.28v1077.76c0,34.63,0,51.96-6.52,65.28-6.26,12.75-16.57,23.06-29.32,29.32-13.32,6.52-30.65,6.52-65.28,6.52H101.12c-34.64,0-51.95,0-65.28-6.52-12.76-6.26-23.07-16.57-29.32-29.32-6.53-13.32-6.53-30.65-6.53-65.28V101.12Z" />
                                                </svg>
                                                {profileInfo.baseUsername}
                                            </a>
                                        )}
                                    </div>
                                </div>

                                {/* Stats */}
                                <div className="flex gap-6 text-center justify-center sm:justify-start">
                                    {isOwnProfile && formattedBalance && (
                                        <div>
                                            <div className="text-2xl font-bold text-white font-mono">
                                                {formattedBalance} <span className="text-ink-400 text-base font-sans">ETH</span>
                                            </div>
                                            <div className="text-xs text-ink-400 uppercase tracking-wide">Balance</div>
                                        </div>
                                    )}
                                    <div>
                                        <div className="text-2xl font-bold text-white font-mono">
                                            {isLoading ? (
                                                <Skeleton width={40} baseColor="#27272a" highlightColor="#3f3f46" />
                                            ) : (
                                                profileData?.stats?.totalCreated || 0
                                            )}
                                        </div>
                                        <div className="text-xs text-ink-400 uppercase tracking-wide">Created</div>
                                    </div>
                                    <div>
                                        <div className="text-2xl font-bold text-white font-mono">
                                            {isLoading ? (
                                                <Skeleton width={40} baseColor="#27272a" highlightColor="#3f3f46" />
                                            ) : (
                                                profileData?.stats?.totalCollected || 0
                                            )}
                                        </div>
                                        <div className="text-xs text-ink-400 uppercase tracking-wide">Collected</div>
                                    </div>
                                    <div>
                                        <div className="text-2xl font-bold text-white font-mono">
                                            {isLoading ? (
                                                <Skeleton width={60} baseColor="#27272a" highlightColor="#3f3f46" />
                                            ) : (
                                                <>{profileData?.stats?.totalVolume || "0"} <span className="text-ink-400 text-base font-sans">ETH</span></>
                                            )}
                                        </div>
                                        <div className="text-xs text-ink-400 uppercase tracking-wide">Volume</div>
                                    </div>
                                </div>
                            </div>

                            {/* Edit Profile Form */}
                            {isEditing && (
                                <div className="mt-6 pt-6 border-t border-ink-700">
                                    <h3 className="text-lg font-semibold text-white mb-4">Edit Profile</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
                                        <div>
                                            <label className="block text-sm text-ink-400 mb-1">Display Name</label>
                                            <input
                                                type="text"
                                                value={editForm.name}
                                                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                                maxLength={50}
                                                placeholder="Your display name"
                                                className="w-full px-3 py-2 bg-ink-800 border border-ink-700 rounded-lg text-white placeholder-ink-500 focus:outline-none focus:border-accent-cyan"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm text-ink-400 mb-1">X (Twitter)</label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500">@</span>
                                                <input
                                                    type="text"
                                                    value={editForm.xUsername}
                                                    onChange={(e) => setEditForm({ ...editForm, xUsername: e.target.value.replace(/^@/, "") })}
                                                    maxLength={50}
                                                    placeholder="username"
                                                    className="w-full pl-7 pr-3 py-2 bg-ink-800 border border-ink-700 rounded-lg text-white placeholder-ink-500 focus:outline-none focus:border-accent-cyan"
                                                />
                                            </div>
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="block text-sm text-ink-400 mb-1">Bio</label>
                                            <textarea
                                                value={editForm.bio}
                                                onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                                                maxLength={160}
                                                rows={2}
                                                placeholder="A short bio about yourself"
                                                className="w-full px-3 py-2 bg-ink-800 border border-ink-700 rounded-lg text-white placeholder-ink-500 focus:outline-none focus:border-accent-cyan resize-none"
                                            />
                                            <p className="text-xs text-ink-500 mt-1">{editForm.bio.length}/160</p>
                                        </div>
                                        <div>
                                            <label className="block text-sm text-ink-400 mb-1">Instagram</label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500">@</span>
                                                <input
                                                    type="text"
                                                    value={editForm.instagramUsername}
                                                    onChange={(e) => setEditForm({ ...editForm, instagramUsername: e.target.value.replace(/^@/, "") })}
                                                    maxLength={50}
                                                    placeholder="username"
                                                    className="w-full pl-7 pr-3 py-2 bg-ink-800 border border-ink-700 rounded-lg text-white placeholder-ink-500 focus:outline-none focus:border-accent-cyan"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm text-ink-400 mb-1">Base Profile</label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500 text-sm">base.app/profile/</span>
                                                <input
                                                    type="text"
                                                    value={editForm.baseUsername}
                                                    onChange={(e) => setEditForm({ ...editForm, baseUsername: e.target.value })}
                                                    maxLength={50}
                                                    placeholder="username"
                                                    className="w-full pl-32 pr-3 py-2 bg-ink-800 border border-ink-700 rounded-lg text-white placeholder-ink-500 focus:outline-none focus:border-accent-cyan"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {saveError && (
                                        <p className="text-red-400 text-sm mt-3">{saveError}</p>
                                    )}

                                    <div className="flex items-center gap-3 mt-4">
                                        <button
                                            onClick={handleSaveProfile}
                                            disabled={isSaving}
                                            className="px-4 py-2 bg-accent-cyan text-ink-950 font-medium rounded-lg hover:bg-accent-cyan/90 transition-colors disabled:opacity-50"
                                        >
                                            {isSaving ? "Signing..." : "Save Profile"}
                                        </button>
                                        <button
                                            onClick={() => {
                                                setIsEditing(false);
                                                setSaveError(null);
                                                setEditForm({
                                                    name: profileInfo?.name || "",
                                                    bio: profileInfo?.bio || "",
                                                    xUsername: profileInfo?.xUsername || "",
                                                    instagramUsername: profileInfo?.instagramUsername || "",
                                                    baseUsername: profileInfo?.baseUsername || "",
                                                });
                                            }}
                                            className="px-4 py-2 bg-ink-800 text-ink-300 font-medium rounded-lg hover:bg-ink-700 hover:text-white transition-colors"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                    <p className="text-xs text-ink-500 mt-2">
                                        Saving requires signing a message with your wallet to verify ownership.
                                    </p>
                                </div>
                            )}
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
                            <button
                                onClick={() => setActiveTab("history")}
                                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                                    activeTab === "history"
                                        ? "bg-accent-cyan text-ink-950"
                                        : "bg-ink-800 text-ink-300 hover:text-white hover:bg-ink-700"
                                }`}
                            >
                                History
                            </button>
                        </div>

                        {/* Content */}
                        {activeTab === "history" ? (
                            <UserHistory address={address} prefetchedHistory={getPrefetchedUserHistory(address)} />
                        ) : isLoading ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {[1, 2, 3].map((i) => (
                                    <div key={i} className="bg-ink-900/50 rounded-2xl border border-ink-800 overflow-hidden">
                                        <Skeleton height={208} baseColor="#27272a" highlightColor="#3f3f46" />
                                        <div className="p-4">
                                            <Skeleton baseColor="#27272a" highlightColor="#3f3f46" />
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
