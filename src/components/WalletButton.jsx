import { useState, useEffect } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { useNavigate } from "react-router-dom";
import { prefetchProfile, prefetchAuthor } from "../common/prefetch";

export default function WalletButton() {
    const navigate = useNavigate();
    const { address } = useAccount();

    // Track if profile setup prompt is dismissed
    const [promptDismissed, setPromptDismissed] = useState(() => {
        try {
            return localStorage.getItem("profileSetupDismissed") === "true";
        } catch {
            return false;
        }
    });

    // Track profile state - initialize from cache
    const [isProfileEmpty, setIsProfileEmpty] = useState(() => {
        if (!address) return false;
        try {
            const cached = localStorage.getItem(`profile_empty_${address.toLowerCase()}`);
            return cached === "true";
        } catch { return false; }
    });
    const [profileName, setProfileName] = useState(() => {
        if (!address) return null;
        try {
            return localStorage.getItem(`profile_name_${address.toLowerCase()}`) || null;
        } catch { return null; }
    });
    const [checkedProfile, setCheckedProfile] = useState(false);

    // Check profile when address changes
    useEffect(() => {
        if (!address) {
            setIsProfileEmpty(false);
            setProfileName(null);
            setCheckedProfile(false);
            return;
        }

        // Load from cache immediately
        try {
            const cachedName = localStorage.getItem(`profile_name_${address.toLowerCase()}`);
            const cachedEmpty = localStorage.getItem(`profile_empty_${address.toLowerCase()}`);
            if (cachedName) setProfileName(cachedName);
            if (cachedEmpty !== null) setIsProfileEmpty(cachedEmpty === "true");
        } catch {}

        const checkProfile = async () => {
            try {
                const res = await fetch(`/api/profile/${address.toLowerCase()}`);
                if (res.ok) {
                    const data = await res.json();
                    const isEmpty = !data.name && !data.bio && !data.xUsername &&
                                   !data.instagramUsername && !data.baseUsername;
                    setIsProfileEmpty(isEmpty);
                    setProfileName(data.name || null);
                    // Cache the results
                    try {
                        localStorage.setItem(`profile_name_${address.toLowerCase()}`, data.name || "");
                        localStorage.setItem(`profile_empty_${address.toLowerCase()}`, isEmpty.toString());
                    } catch {}
                }
            } catch {
                // Ignore errors
            }
            setCheckedProfile(true);
        };

        checkProfile();
    }, [address]);

    const dismissPrompt = (e) => {
        e.stopPropagation();
        setPromptDismissed(true);
        try {
            localStorage.setItem("profileSetupDismissed", "true");
        } catch {
            // Ignore localStorage errors
        }
    };

    const showSetupHint = checkedProfile && isProfileEmpty && !promptDismissed;

    return (
        <ConnectButton.Custom>
            {({
                account,
                chain,
                openChainModal,
                openConnectModal,
                mounted,
            }) => {
                const ready = mounted;
                const connected = ready && account && chain;

                return (
                    <div
                        {...(!ready && {
                            "aria-hidden": true,
                            style: {
                                opacity: 0,
                                pointerEvents: "none",
                                userSelect: "none",
                            },
                        })}
                    >
                        {(() => {
                            if (!connected) {
                                return (
                                    <button
                                        onClick={openConnectModal}
                                        className="flex items-center gap-2 px-3 py-2 text-sm text-ink-400 hover:text-white hover:bg-ink-800/50 rounded-lg transition-colors"
                                    >
                                        <svg
                                            className="w-4 h-4"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={1.5}
                                                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                                            />
                                        </svg>
                                        <span>Sign in</span>
                                    </button>
                                );
                            }

                            if (chain.unsupported) {
                                return (
                                    <button
                                        onClick={openChainModal}
                                        className="p-2 flex items-center justify-center text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition-colors"
                                        title="Wrong network"
                                    >
                                        <svg
                                            className="w-5 h-5"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={1.5}
                                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                                            />
                                        </svg>
                                    </button>
                                );
                            }

                            if (showSetupHint) {
                                return (
                                    <div className="flex items-center gap-1 bg-accent-cyan/10 rounded-lg border border-accent-cyan/30 pl-3 pr-1">
                                        <button
                                            onClick={() => navigate(`/profile?address=${address}`)}
                                            onMouseEnter={() => { prefetchProfile(address); prefetchAuthor(address); }}
                                            className="flex items-center gap-2 py-1.5 text-sm text-accent-cyan hover:text-white transition-colors"
                                        >
                                            <svg
                                                className="w-4 h-4"
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={1.5}
                                                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                                                />
                                            </svg>
                                            <span>Set up profile</span>
                                        </button>
                                        <button
                                            onClick={dismissPrompt}
                                            className="p-1.5 text-accent-cyan/50 hover:text-accent-cyan transition-colors"
                                            title="Dismiss"
                                        >
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>
                                );
                            }

                            return (
                                <button
                                    onClick={() => navigate(`/profile?address=${address}`)}
                                    onMouseEnter={() => { prefetchProfile(address); prefetchAuthor(address); }}
                                    className="flex items-center gap-2 px-3 py-2 text-sm text-ink-400 hover:text-white hover:bg-ink-800/50 rounded-lg transition-colors"
                                >
                                    <svg
                                        className="w-4 h-4"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={1.5}
                                            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                                        />
                                    </svg>
                                    <span className={profileName ? "" : "font-mono"}>{profileName || account.displayName}</span>
                                </button>
                            );
                        })()}
                    </div>
                );
            }}
        </ConnectButton.Custom>
    );
}
