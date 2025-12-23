import { useState, useEffect, useCallback } from "react";

// Format relative time (e.g., "2 minutes ago")
function formatRelativeTime(date) {
    if (!date) return "unknown";

    const now = new Date();
    const diffMs = now - new Date(date);
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);

    if (diffSeconds < 10) return "just now";
    if (diffSeconds < 60) return `${diffSeconds}s ago`;
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return new Date(date).toLocaleDateString();
}

// Determine staleness level
function getStalenessLevel(lastSyncTime, syncIntervalSeconds = 30) {
    if (!lastSyncTime) return "unknown";

    const now = new Date();
    const syncTime = new Date(lastSyncTime);
    const diffSeconds = (now - syncTime) / 1000;

    // Fresh: within 2 sync intervals
    if (diffSeconds < syncIntervalSeconds * 2) return "fresh";
    // Stale: within 5 sync intervals
    if (diffSeconds < syncIntervalSeconds * 5) return "stale";
    // Very stale: beyond 5 sync intervals
    return "very-stale";
}

export default function SyncStatus({ meta, onRefresh, compact = false }) {
    const [relativeTime, setRelativeTime] = useState("");
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Update relative time every 10 seconds
    useEffect(() => {
        const update = () => setRelativeTime(formatRelativeTime(meta?.lastSyncTime));
        update();
        const interval = setInterval(update, 10000);
        return () => clearInterval(interval);
    }, [meta?.lastSyncTime]);

    const handleRefresh = useCallback(async () => {
        if (!onRefresh || isRefreshing) return;
        setIsRefreshing(true);
        try {
            await onRefresh();
        } finally {
            setIsRefreshing(false);
        }
    }, [onRefresh, isRefreshing]);

    if (!meta) return null;

    const staleness = getStalenessLevel(meta.lastSyncTime, meta.syncIntervalSeconds);
    const isSyncing = meta.isSyncing || isRefreshing;

    // Color based on staleness
    const statusColors = {
        fresh: "text-green-500",
        stale: "text-yellow-500",
        "very-stale": "text-red-500",
        unknown: "text-ink-500",
    };

    const dotColors = {
        fresh: "bg-green-500",
        stale: "bg-yellow-500",
        "very-stale": "bg-red-500",
        unknown: "bg-ink-500",
    };

    if (compact) {
        return (
            <div className="flex items-center gap-2 text-xs text-ink-500">
                <span className={`w-1.5 h-1.5 rounded-full ${isSyncing ? "bg-blue-500 animate-pulse" : dotColors[staleness]}`} />
                <span>{isSyncing ? "Syncing..." : relativeTime}</span>
            </div>
        );
    }

    return (
        <div className="flex items-center justify-between gap-4 px-3 py-2 bg-ink-900/30 rounded-lg border border-ink-800/50">
            <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${isSyncing ? "bg-blue-500 animate-pulse" : dotColors[staleness]}`} />
                <span className="text-xs text-ink-400">
                    {isSyncing ? (
                        "Syncing blockchain data..."
                    ) : (
                        <>
                            Updated <span className={statusColors[staleness]}>{relativeTime}</span>
                            {meta.lastSyncBlock && (
                                <span className="text-ink-600 ml-1">
                                    (block {meta.lastSyncBlock.toLocaleString()})
                                </span>
                            )}
                        </>
                    )}
                </span>
            </div>

            {onRefresh && !isSyncing && staleness !== "fresh" && (
                <button
                    onClick={handleRefresh}
                    className="flex items-center gap-1 text-xs text-ink-400 hover:text-ink-200 transition-colors"
                >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Refresh
                </button>
            )}
        </div>
    );
}

// Hook to track sync metadata from API calls
export function useSyncMeta() {
    const [meta, setMeta] = useState(null);

    const updateMeta = useCallback((newMeta) => {
        if (newMeta) {
            setMeta(newMeta);
        }
    }, []);

    return [meta, updateMeta];
}
