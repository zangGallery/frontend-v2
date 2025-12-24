import { atom, useRecoilState } from "recoil";
import { namehash, keccak256, encodePacked } from "viem";
import config from "../config";
import { mainnetClient, baseClient } from "./provider";

// Base L2 Resolver for Basenames
const BASENAME_L2_RESOLVER_ADDRESS = "0xC6d566A56A1aFf6508b41f6c90ff131615583BCD";

const L2ResolverAbi = [
    {
        inputs: [{ name: "node", type: "bytes32" }],
        name: "name",
        outputs: [{ name: "", type: "string" }],
        stateMutability: "view",
        type: "function",
    },
];

// Convert address to reverse node for Base ENS lookup
function convertReverseNodeToBytes(address) {
    const addressFormatted = address.toLowerCase().replace("0x", "");
    const addressNode = keccak256(encodePacked(["string"], [addressFormatted]));
    const baseReverseNode = namehash("80002105.reverse");
    const addressReverseNode = keccak256(
        encodePacked(["bytes32", "bytes32"], [baseReverseNode, addressNode])
    );
    return addressReverseNode;
}

// Rate limiting: max 2 concurrent ENS requests with 100ms delay between
const ENS_MAX_CONCURRENT = 2;
const ENS_REQUEST_DELAY = 100;
let activeRequests = 0;
const pendingQueue = [];

// In-flight request deduplication - prevents duplicate requests for same address
const inFlightRequests = new Map();

async function rateLimitedRequest(fn) {
    return new Promise((resolve, reject) => {
        const execute = async () => {
            activeRequests++;
            try {
                const result = await fn();
                resolve(result);
            } catch (e) {
                reject(e);
            } finally {
                activeRequests--;
                // Process next in queue after delay
                if (pendingQueue.length > 0) {
                    setTimeout(() => {
                        const next = pendingQueue.shift();
                        if (next) next();
                    }, ENS_REQUEST_DELAY);
                }
            }
        };

        if (activeRequests < ENS_MAX_CONCURRENT) {
            execute();
        } else {
            pendingQueue.push(execute);
        }
    });
}

// Load cached ENS from localStorage
function loadCachedEns() {
    try {
        const cached = localStorage.getItem("ensCache");
        if (cached) {
            const parsed = JSON.parse(cached);
            // Filter out expired entries
            const now = new Date();
            const valid = {};
            for (const [address, data] of Object.entries(parsed)) {
                if (data && new Date(data.expiration) > now) {
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

// Save ENS cache to localStorage
function saveCachedEns(ensInfo) {
    try {
        localStorage.setItem("ensCache", JSON.stringify(ensInfo));
    } catch (e) {
        // Ignore localStorage errors
    }
}

const ensInfoState = atom({
    key: "ensInfo",
    default: loadCachedEns(),
});

const useEns = () => {
    const [ensInfo, setEnsInfo] = useRecoilState(ensInfoState);

    const updateEns = async (address) => {
        let ensAddress = null;

        try {
            // Try Base ENS (Basenames) first since we're on Base
            ensAddress = await rateLimitedRequest(async () => {
                const addressReverseNode = convertReverseNodeToBytes(address);
                const result = await baseClient.readContract({
                    abi: L2ResolverAbi,
                    address: BASENAME_L2_RESOLVER_ADDRESS,
                    functionName: "name",
                    args: [addressReverseNode],
                });
                return result || null;
            });
        } catch (e) {
            // Base ENS lookup failed - silent fail
        }

        // Skip mainnet ENS to reduce RPC calls - this is a Base-native app
        // Most users will have Basenames, not mainnet ENS
        // Uncomment below if mainnet ENS support is needed:
        // if (!ensAddress) {
        //     try {
        //         ensAddress = await rateLimitedRequest(async () => {
        //             return await mainnetClient.getEnsName({ address });
        //         });
        //     } catch (e) {
        //         // Mainnet ENS lookup failed - silent fail
        //     }
        // }

        const newEntry = {
            value: ensAddress,
            expiration: new Date(
                new Date().getTime() + config.ens.cacheExpiration,
            ),
        };

        setEnsInfo((currentEnsInfo) => {
            const updated = {
                ...currentEnsInfo,
                [address]: newEntry,
            };
            // Persist to localStorage
            saveCachedEns(updated);
            return updated;
        });

        return ensAddress;
    };

    const addressShouldBeUpdated = (address) => {
        return (
            (!ensInfo[address] ||
                new Date(ensInfo[address].expiration) < new Date()) &&
            !inFlightRequests.has(address)
        );
    };

    const invalidateEns = (address) => {
        setEnsInfo((currentEnsInfo) => ({
            ...currentEnsInfo,
            [address]: null,
        }));
    };

    const lookupEns = (address) => {
        if (!address) return address;

        // Check cache first
        if (ensInfo[address] && new Date(ensInfo[address].expiration) > new Date()) {
            return ensInfo[address].value;
        }

        // Check if already in-flight (deduplication)
        if (inFlightRequests.has(address)) {
            return ensInfo[address]?.value;
        }

        // Mark as in-flight and start request
        const promise = new Promise((resolve) => {
            // Defer the state update to avoid calling during render
            setTimeout(async () => {
                try {
                    const result = await updateEns(address);
                    resolve(result);
                } catch (e) {
                    resolve(null);
                } finally {
                    inFlightRequests.delete(address);
                }
            }, 0);
        });
        inFlightRequests.set(address, promise);

        return ensInfo[address]?.value;
    };

    const lookupEnsAsync = async (address, forceUpdate) => {
        if (!address) return address;

        if (forceUpdate) {
            invalidateEns(address);
        }

        // Note: we still need to check forceUpdate because React doesn't update state until the next render
        const update = addressShouldBeUpdated(address) || forceUpdate;
        let ensAddress = undefined;
        if (update) {
            ensAddress = await updateEns(address);
        } else {
            ensAddress = ensInfo[address]?.value;
        }

        return ensAddress;
    };

    return { lookupEns, lookupEnsAsync, invalidateEns };
};

export { useEns };
