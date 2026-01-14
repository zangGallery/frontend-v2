import { atom } from "recoil";

const standardErrorState = atom({
    key: "standardError",
    default: null,
});

const isTokenExistenceError = (e) => {
    // Each wallet formats errors differently, so we need a general method
    const stringified = JSON.stringify(e);
    return (
        stringified.includes("ZangNFT") &&
        stringified.includes("query for nonexistent token")
    );
};

// Sanitize URLs to hide API keys
const sanitizeMessage = (msg) => {
    if (!msg || typeof msg !== 'string') return msg;

    // Remove API keys from RPC URLs (alchemy, infura, etc)
    return msg
        .replace(/https:\/\/[^/]+\.alchemy\.com\/v2\/[a-zA-Z0-9_-]+/g, 'https://[RPC]')
        .replace(/https:\/\/[^/]+\.infura\.io\/v3\/[a-zA-Z0-9_-]+/g, 'https://[RPC]')
        .replace(/https:\/\/[^/]+\.quiknode\.pro\/[a-zA-Z0-9_-]+/g, 'https://[RPC]');
};

const formatError = (e) => {
    if (e.message) {
        if (e.message === "Internal JSON-RPC error." && e.data?.message) {
            return sanitizeMessage("Internal JSON-RPC error: " + e.data.message + ".");
        }

        // Check for network errors and provide user-friendly message
        if (e.message.includes("Failed to fetch") || e.message.includes("NetworkError")) {
            return "Network error. Please check your internet connection.";
        }

        // Handle wallet connector errors (wagmi/rainbowkit issue)
        if (e.message.includes("getChainId is not a function") ||
            e.message.includes("connector.getChainId")) {
            return "Wallet connection error. Please disconnect your wallet completely, refresh the page, and reconnect.";
        }

        return sanitizeMessage(e.message);
    }
    return "Unknown error.";
};

export { formatError, isTokenExistenceError, standardErrorState };
