import { useMemo } from "react";
import { useRecoilState } from "recoil";
import { standardErrorState } from "../common/error";

// Sanitize any API keys from error messages
const sanitizeError = (msg) => {
    if (!msg || typeof msg !== 'string') return msg;
    return msg
        .replace(/https:\/\/[^/]+\.alchemy\.com\/v2\/[a-zA-Z0-9_-]+/g, 'https://[RPC]')
        .replace(/https:\/\/[^/]+\.infura\.io\/v3\/[a-zA-Z0-9_-]+/g, 'https://[RPC]')
        .replace(/https:\/\/[^/]+\.quiknode\.pro\/[a-zA-Z0-9_-]+/g, 'https://[RPC]');
};

export default function StandardErrorDisplay() {
    const [standardError, setStandardError] =
        useRecoilState(standardErrorState);

    const displayError = useMemo(() => sanitizeError(standardError), [standardError]);

    if (!standardError) {
        return null;
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-start gap-3">
                <svg
                    className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                </svg>
                <div className="flex-1">
                    <p className="text-red-400 text-sm break-all">
                        <span className="font-semibold">Error:</span>{" "}
                        {displayError}
                    </p>
                </div>
                <button
                    onClick={() => setStandardError(null)}
                    className="text-red-400 hover:text-red-300 transition-colors"
                    aria-label="Dismiss error"
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
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                        />
                    </svg>
                </button>
            </div>
        </div>
    );
}
