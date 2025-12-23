import { useEffect, useMemo } from "react";
import config from "../config";
import { blockToDateState, getBlockTime } from "../common/history";
import Skeleton from "react-loading-skeleton";
import { useRecoilState } from "recoil";

import TimeAgo from "javascript-time-ago";
import en from "javascript-time-ago/locale/en.json";

import Address from "./Address";

TimeAgo.addDefaultLocale(en);

const timeAgo = new TimeAgo("en-US");

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

    const getEventColor = (type) => {
        switch (type) {
            case "mint":
                return "bg-green-500";
            case "transfer":
                return "bg-blue-500";
            case "list":
                return "bg-amber-500";
            case "delist":
                return "bg-ink-500";
            case "buy":
                return "bg-purple-500";
            default:
                return "bg-ink-500";
        }
    };

    const displayHistory = useMemo(
        () => (newestFirst ? history : [...(history || [])].reverse()),
        [history, newestFirst],
    );

    return history ? (
        <div className="space-y-4">
            {displayHistory.map((event, index) => {
                return (
                    <div
                        key={index}
                        className="relative pl-6 pb-4 border-l-2 border-ink-700 last:border-l-transparent"
                    >
                        {/* Timeline dot */}
                        <div
                            className={`absolute -left-[5px] top-1 w-2 h-2 rounded-full ${getEventColor(event.type)}`}
                        />

                        {/* Event card */}
                        <div className="bg-ink-800/50 rounded-lg p-4">
                            {/* Header */}
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-3">
                                    {!hideId && event.id && (
                                        <a
                                            href={"/nft/?id=" + event.id}
                                            className="text-accent-cyan hover:underline font-mono text-sm"
                                        >
                                            #{event.id}
                                        </a>
                                    )}
                                    <span className="px-2 py-0.5 bg-ink-700 rounded text-xs font-mono uppercase text-ink-200">
                                        {event.type}
                                    </span>
                                </div>
                                {blockToDate[event.blockNumber] ? (
                                    <span className="text-xs text-ink-400 font-mono">
                                        {timeAgo.format(
                                            blockToDate[event.blockNumber],
                                        )}
                                    </span>
                                ) : (
                                    <Skeleton
                                        width={80}
                                        baseColor="#27272a"
                                        highlightColor="#3f3f46"
                                    />
                                )}
                            </div>

                            {/* Details */}
                            <div className="space-y-1 text-sm font-mono">
                                {event.from && (
                                    <div className="flex gap-2">
                                        <span className="text-ink-500 w-16">
                                            FROM
                                        </span>
                                        <Address
                                            address={event.from}
                                            shorten
                                            nChar={8}
                                        />
                                    </div>
                                )}
                                {event.to && (
                                    <div className="flex gap-2">
                                        <span className="text-ink-500 w-16">
                                            TO
                                        </span>
                                        <Address
                                            address={event.to}
                                            shorten
                                            nChar={8}
                                        />
                                    </div>
                                )}
                                {event.seller && (
                                    <div className="flex gap-2">
                                        <span className="text-ink-500 w-16">
                                            SELLER
                                        </span>
                                        <Address
                                            address={event.seller}
                                            shorten
                                            nChar={8}
                                        />
                                    </div>
                                )}
                                {event.buyer && (
                                    <div className="flex gap-2">
                                        <span className="text-ink-500 w-16">
                                            BUYER
                                        </span>
                                        <Address
                                            address={event.buyer}
                                            shorten
                                            nChar={8}
                                        />
                                    </div>
                                )}
                                {event.price && (
                                    <div className="flex gap-2">
                                        <span className="text-ink-500 w-16">
                                            PRICE
                                        </span>
                                        <span className="text-white">
                                            {event.price} ETH
                                        </span>
                                    </div>
                                )}
                                {event.amount && (
                                    <div className="flex gap-2">
                                        <span className="text-ink-500 w-16">
                                            AMOUNT
                                        </span>
                                        <span className="text-ink-300">
                                            {event.amount}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Transaction link */}
                            <div className="mt-3 pt-3 border-t border-ink-700">
                                <a
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-ink-400 hover:text-accent-cyan transition-colors font-mono"
                                    href={
                                        config.blockExplorer.url +
                                        "/tx/" +
                                        event.transactionHash
                                    }
                                >
                                    View transaction →
                                </a>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    ) : (
        <div className="space-y-4">
            {[1, 2, 3].map((i) => (
                <Skeleton
                    key={i}
                    height={120}
                    className="rounded-lg"
                    baseColor="#27272a"
                    highlightColor="#3f3f46"
                />
            ))}
        </div>
    );
}
