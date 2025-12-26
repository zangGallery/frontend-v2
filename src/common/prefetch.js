// Simple in-memory prefetch cache for instant page loads
// Data is cached on hover and consumed on navigation

const cache = new Map();
const CACHE_TTL = 30000; // 30 seconds

// Prefetch NFT data on hover
export function prefetchNFT(id) {
    const key = `nft:${id}`;

    // Don't refetch if already cached and fresh
    const existing = cache.get(key);
    if (existing && Date.now() - existing.timestamp < CACHE_TTL) {
        return;
    }

    // Fetch in background
    fetch(`/api/nft/${id}`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
            if (data) {
                cache.set(key, { data, timestamp: Date.now() });
            }
        })
        .catch(() => {}); // Silent fail - prefetch is best-effort
}

// Get prefetched NFT data (returns null if not cached or stale)
export function getPrefetchedNFT(id) {
    const key = `nft:${id}`;
    const entry = cache.get(key);

    if (!entry) return null;

    // Check if stale
    if (Date.now() - entry.timestamp > CACHE_TTL) {
        cache.delete(key);
        return null;
    }

    return entry.data;
}

// Clear specific entry (call after consuming to free memory)
export function clearPrefetchedNFT(id) {
    cache.delete(`nft:${id}`);
}

// Prefetch multiple NFTs (for adjacent navigation)
export function prefetchNFTs(ids) {
    ids.forEach(id => {
        if (id != null) prefetchNFT(id);
    });
}

// Prefetch profile data on hover
export function prefetchProfile(address) {
    if (!address) return;

    const key = `profile:${address.toLowerCase()}`;

    // Don't refetch if already cached and fresh
    const existing = cache.get(key);
    if (existing && Date.now() - existing.timestamp < CACHE_TTL) {
        return;
    }

    // Fetch in background
    fetch(`/api/profile/${address.toLowerCase()}`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
            if (data) {
                cache.set(key, { data, timestamp: Date.now() });
            }
        })
        .catch(() => {}); // Silent fail - prefetch is best-effort
}

// Get prefetched profile data (returns null if not cached or stale)
export function getPrefetchedProfile(address) {
    if (!address) return null;

    const key = `profile:${address.toLowerCase()}`;
    const entry = cache.get(key);

    if (!entry) return null;

    // Check if stale
    if (Date.now() - entry.timestamp > CACHE_TTL) {
        cache.delete(key);
        return null;
    }

    return entry.data;
}

// Prefetch author data (NFTs, stats) on hover - this is the slow endpoint
export function prefetchAuthor(address) {
    if (!address) return;

    const key = `author:${address.toLowerCase()}`;

    // Don't refetch if already cached and fresh
    const existing = cache.get(key);
    if (existing && Date.now() - existing.timestamp < CACHE_TTL) {
        return;
    }

    // Fetch in background
    fetch(`/api/author/${address.toLowerCase()}`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
            if (data) {
                cache.set(key, { data, timestamp: Date.now() });
            }
        })
        .catch(() => {}); // Silent fail - prefetch is best-effort
}

// Get prefetched author data (returns null if not cached or stale)
export function getPrefetchedAuthor(address) {
    if (!address) return null;

    const key = `author:${address.toLowerCase()}`;
    const entry = cache.get(key);

    if (!entry) return null;

    // Check if stale
    if (Date.now() - entry.timestamp > CACHE_TTL) {
        cache.delete(key);
        return null;
    }

    return entry.data;
}
