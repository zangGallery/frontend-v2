import config from "../config";

export default function ViewOnExplorer({ hash }) {
    return (
        <a
            className="inline-flex items-center gap-1.5 text-accent-cyan hover:text-accent-cyan/80 transition-colors text-sm"
            href={config.blockExplorer.url + "/tx/" + hash}
            target="_blank"
            rel="noopener noreferrer"
        >
            View on {config.blockExplorer.name}
            <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
            >
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
            </svg>
        </a>
    );
}
