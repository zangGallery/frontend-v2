import { useEffect, useMemo } from "react";
import config from "../config";
import { blockToDateState, getBlockTime } from "../common/history";
import { useRecoilState } from "recoil";

import TimeAgo from "javascript-time-ago";
import en from "javascript-time-ago/locale/en.json";

import Address from "./Address";

TimeAgo.addDefaultLocale(en);

const timeAgo = new TimeAgo("en-US");

// Event type configuration - consistent with UserHistory and Activity
const EVENT_CONFIG = {
    mint: { icon: "M12 6v6m0 0v6m0-6h6m-6 0H6", label: "Minted", color: "text-green-400" },
    purchase: { icon: "M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z", label: "Purchased", color: "text-accent-cyan" },
    buy: { icon: "M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z", label: "Purchased", color: "text-accent-cyan" },
    list: { icon: "M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z", label: "Listed", color: "text-blue-400" },
    delist: { icon: "M6 18L18 6M6 6l12 12", label: "Delisted", color: "text-ink-400" },
    transfer: { icon: "M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4", label: "Transferred", color: "text-purple-400" },
    burn: { icon: "M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z", label: "Burned", color: "text-red-400" },
};

export default function NFTHistory({ history, hideId, newestFirst = false }) {
    const [blockToDate, setBlockToDate] = useRecoilState(blockToDateState);

    useEffect(() => {
        if (!history) {
            return;
        }

        for (const event of history) {
            if (!(event.blockNumber in blockToDate)) {
                getBlockTime(event.blockNumber)
                    .then((date) => {
                        setBlockToDate((prev) => ({
                            ...prev,
                            [event.blockNumber]: date,
                        }));
                    })
                    .catch(() => {
                        // Failed to get block time - silent fail
                    });
            }
        }
    }, [history, blockToDate, setBlockToDate]);

    const displayHistory = useMemo(
        () => (newestFirst ? history : [...(history || [])].reverse()),
        [history, newestFirst],
    );

    if (!history) {
        return (
            <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-4 p-3 bg-ink-900/30 rounded-lg animate-pulse">
                        <div className="w-8 h-8 bg-ink-800 rounded-lg" />
                        <div className="flex-1 space-y-2">
                            <div className="h-4 bg-ink-800 rounded w-1/3" />
                            <div className="h-3 bg-ink-800 rounded w-1/4" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (displayHistory.length === 0) {
        return (
            <div className="text-center py-8 text-ink-400">
                No history yet
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {displayHistory.map((event, index) => {
                const eventConfig = EVENT_CONFIG[event.type] || {
                    icon: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
                    label: event.type,
                    color: "text-ink-400"
                };

                const timestamp = blockToDate[event.blockNumber];

                return (
                    <div
                        key={index}
                        className="flex items-center gap-4 p-3 bg-ink-900/30 rounded-lg hover:bg-ink-900/50 transition-colors group"
                    >
                        {/* Icon */}
                        <div className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-ink-800/50 ${eventConfig.color}`}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={eventConfig.icon} />
                            </svg>
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-sm font-medium ${eventConfig.color}`}>
                                    {eventConfig.label}
                                </span>
                                {!hideId && event.id && (
                                    <a
                                        href={"/nft/?id=" + event.id}
                                        className="text-sm text-accent-cyan hover:underline font-mono"
                                    >
                                        #{event.id}
                                    </a>
                                )}
                                {event.amount && event.amount > 1 && (
                                    <span className="text-xs text-ink-500">x{event.amount}</span>
                                )}
                                {event.price && (
                                    <span className="text-sm text-ink-300">
                                        {event.price} ETH
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-ink-500 flex-wrap">
                                {/* Show from/to for transfers */}
                                {event.from && event.to && (
                                    <span className="flex items-center gap-1">
                                        <Address address={event.from} shorten nChar={4} />
                                        <span>→</span>
                                        <Address address={event.to} shorten nChar={4} />
                                    </span>
                                )}
                                {/* Show seller for listings/delistings */}
                                {event.seller && !event.buyer && (
                                    <span className="flex items-center gap-1">
                                        by <Address address={event.seller} shorten nChar={4} />
                                    </span>
                                )}
                                {/* Show buyer and seller for purchases */}
                                {event.buyer && (
                                    <span className="flex items-center gap-1">
                                        <Address address={event.buyer} shorten nChar={4} />
                                        {event.seller && (
                                            <>
                                                <span>from</span>
                                                <Address address={event.seller} shorten nChar={4} />
                                            </>
                                        )}
                                    </span>
                                )}
                                {/* Timestamp */}
                                {timestamp && (
                                    <span className="text-ink-500">
                                        {timeAgo.format(timestamp)}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Transaction link */}
                        <a
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-shrink-0 p-2 text-ink-500 hover:text-ink-300 opacity-0 group-hover:opacity-100 transition-opacity"
                            href={config.blockExplorer.url + "/tx/" + event.transactionHash}
                            title="View transaction"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                        </a>
                    </div>
                );
            })}
        </div>
    );
}
