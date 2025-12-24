import { atom, useRecoilState } from "recoil";

// In-flight request deduplication
const inFlightRequests = new Map();

// Load cached profiles from localStorage
function loadCachedProfiles() {
    try {
        const cached = localStorage.getItem("profilesCache");
        if (cached) {
            const parsed = JSON.parse(cached);
            const now = Date.now();
            const valid = {};
            // Keep entries for 5 minutes
            for (const [address, data] of Object.entries(parsed)) {
                if (data && data.fetchedAt > now - 5 * 60 * 1000) {
                    valid[address] = data;
                }
            }
            return valid;
        }
    } catch (e) {
        // Ignore localStorage errors
    }
    return {};
}

// Save profiles cache to localStorage
function saveCachedProfiles(profiles) {
    try {
        localStorage.setItem("profilesCache", JSON.stringify(profiles));
    } catch (e) {
        // Ignore localStorage errors
    }
}

const profilesState = atom({
    key: "profiles",
    default: loadCachedProfiles(),
});

const useProfiles = () => {
    const [profiles, setProfiles] = useRecoilState(profilesState);

    const fetchProfile = async (address) => {
        try {
            const response = await fetch(`/api/profile/${address.toLowerCase()}`);
            if (response.ok) {
                const data = await response.json();
                return data.name;
            }
        } catch (e) {
            // Silent fail
        }
        return null;
    };

    const updateProfile = async (address) => {
        const name = await fetchProfile(address);
        const newEntry = {
            name,
            fetchedAt: Date.now(),
        };

        setProfiles((current) => {
            const updated = {
                ...current,
                [address.toLowerCase()]: newEntry,
            };
            saveCachedProfiles(updated);
            return updated;
        });

        return name;
    };

    const lookupProfile = (address) => {
        if (!address) return null;
        const key = address.toLowerCase();

        // Check cache first (valid for 5 minutes)
        const cached = profiles[key];
        if (cached && cached.fetchedAt > Date.now() - 5 * 60 * 1000) {
            return cached.name;
        }

        // Check if already in-flight
        if (inFlightRequests.has(key)) {
            return cached?.name;
        }

        // Start fetch
        const promise = new Promise((resolve) => {
            setTimeout(async () => {
                try {
                    const result = await updateProfile(address);
                    resolve(result);
                } catch (e) {
                    resolve(null);
                } finally {
                    inFlightRequests.delete(key);
                }
            }, 0);
        });
        inFlightRequests.set(key, promise);

        return cached?.name;
    };

    const invalidateProfile = (address) => {
        const key = address.toLowerCase();
        setProfiles((current) => {
            const updated = { ...current };
            delete updated[key];
            saveCachedProfiles(updated);
            return updated;
        });
    };

    return { lookupProfile, invalidateProfile };
};

export { useProfiles };
