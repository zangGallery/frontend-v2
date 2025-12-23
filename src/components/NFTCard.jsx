import { Fragment } from "react";
import { useEffect, useState } from "react";
import { formatEther, zeroAddress } from "viem";
import { publicClient } from "../common/provider";
import config from "../config";
import { v1 } from "../common/abi";
import { useNavigate } from "react-router-dom";
import MDEditor from "@uiw/react-md-editor";
import rehypeSanitize from "rehype-sanitize";
import schemas from "../common/schemas";
import { isTokenExistenceError } from "../common/error";
import HTMLViewer from "./HTMLViewer";
import Address from "./Address";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";

// Type badge component
function TypeBadge({ type }) {
    if (!type) return null;

    const config = {
        "text/plain": {
            label: "TXT",
            bg: "bg-blue-500/10",
            border: "border-blue-500/30",
            text: "text-blue-400",
            icon: "¶",
        },
        "text/markdown": {
            label: "MD",
            bg: "bg-purple-500/10",
            border: "border-purple-500/30",
            text: "text-purple-400",
            icon: "#",
        },
        "text/html": {
            label: "HTML",
            bg: "bg-amber-500/10",
            border: "border-amber-500/30",
            text: "text-amber-400",
            icon: "<Fragment>",
        },
    };

    const typeConfig = config[type] || config["text/plain"];

    return (
        <span
            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-mono ${typeConfig.bg} ${typeConfig.border} ${typeConfig.text} border`}
        >
            <span className="opacity-60">{typeConfig.icon}</span>
            {typeConfig.label}
        </span>
    );
}

export default function NFTCard({ id }) {
    const navigate = useNavigate();
    const [tokenData, setTokenData] = useState(null);
    const [tokenAuthor, setTokenAuthor] = useState(null);
    const [tokenType, setTokenType] = useState(null);
    const [tokenContent, setTokenContent] = useState(null);
    const [exists, setExists] = useState(true);

    // Stats
    const [totalSupply, setTotalSupply] = useState(null);
    const [floorPrice, setFloorPrice] = useState(null);
    const [listedCount, setListedCount] = useState(null);
    const [totalVolume, setTotalVolume] = useState(null);

    const zangAddress = config.contractAddresses.v1.zang;
    const marketplaceAddress = config.contractAddresses.v1.marketplace;

    // Fetch all data in parallel
    useEffect(() => {
        if (!id) return;

        const fetchAllData = async () => {
            try {
                // Fetch URI, author, and supply in parallel
                const [tokenURI, author, supply] = await Promise.all([
                    publicClient.readContract({
                        address: zangAddress,
                        abi: v1.zang,
                        functionName: "uri",
                        args: [BigInt(id)],
                    }),
                    publicClient.readContract({
                        address: zangAddress,
                        abi: v1.zang,
                        functionName: "authorOf",
                        args: [BigInt(id)],
                    }),
                    publicClient.readContract({
                        address: zangAddress,
                        abi: v1.zang,
                        functionName: "totalSupply",
                        args: [BigInt(id)],
                    }),
                ]);
                setTokenAuthor(author);
                setTotalSupply(Number(supply));

                // Fetch metadata
                const tokenDataResponse = await fetch(tokenURI);
                const newTokenData = await tokenDataResponse.json();
                setTokenData(newTokenData);

                // Fetch content if text_uri exists
                if (newTokenData?.text_uri) {
                    let parsedTextURI = newTokenData.text_uri.replaceAll(
                        "#",
                        "%23",
                    );
                    parsedTextURI = parsedTextURI.replace("charset=UTF-8,", "");

                    const response = await fetch(parsedTextURI);
                    const parsedText = await response.text();
                    setTokenType(response.headers.get("content-type"));
                    setTokenContent(parsedText);
                }

                // Fetch marketplace listings
                const listingCount = await publicClient.readContract({
                    address: marketplaceAddress,
                    abi: v1.marketplace,
                    functionName: "listingCount",
                    args: [BigInt(id)],
                });
                const count = Number(listingCount);

                if (count > 0) {
                    const listingPromises = [];
                    for (let i = 0; i < count; i++) {
                        listingPromises.push(
                            publicClient.readContract({
                                address: marketplaceAddress,
                                abi: v1.marketplace,
                                functionName: "listings",
                                args: [BigInt(id), BigInt(i)],
                            }),
                        );
                    }
                    const rawListings = await Promise.all(listingPromises);

                    // Map to objects: [price, seller, amount]
                    const listings = rawListings.map(([price, seller, amount]) => ({
                        price,
                        seller,
                        amount,
                    }));

                    // Filter active listings (seller != 0x0)
                    const activeListings = listings.filter(
                        (l) => l.seller !== zeroAddress,
                    );

                    setListedCount(
                        activeListings.reduce(
                            (sum, l) => sum + Number(l.amount),
                            0,
                        ),
                    );

                    if (activeListings.length > 0) {
                        const prices = activeListings.map((l) =>
                            parseFloat(formatEther(l.price)),
                        );
                        setFloorPrice(Math.min(...prices));
                    }
                } else {
                    setListedCount(0);
                }

                // Fetch total volume from purchase events
                const purchaseEvents = await publicClient.getContractEvents({
                    address: marketplaceAddress,
                    abi: v1.marketplace,
                    eventName: "TokenPurchased",
                    args: { _tokenId: BigInt(id) },
                    fromBlock: BigInt(config.firstBlocks.v1.base.marketplace),
                });

                if (purchaseEvents.length > 0) {
                    const volume = purchaseEvents.reduce((sum, event) => {
                        const price = parseFloat(formatEther(event.args._price));
                        const amount = Number(event.args._amount);
                        return sum + price * amount;
                    }, 0);
                    setTotalVolume(volume);
                } else {
                    setTotalVolume(0);
                }
            } catch (e) {
                if (isTokenExistenceError(e)) {
                    setExists(false);
                }
            }
        };

        fetchAllData();
    }, [id]);

    if (!exists) {
        return null;
    }

    const handleClick = () => navigate("/nft?id=" + id);
    const handleKeyDown = (e) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleClick();
        }
    };

    return (
        <div
            className="group relative cursor-pointer"
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            role="button"
            tabIndex={0}
        >
            {/* Card container */}
            <div className="relative bg-ink-900/40 border border-ink-800 rounded-xl overflow-hidden transition-all duration-300 hover:border-ink-600 hover:bg-ink-900/60 hover:-translate-y-1 hover:shadow-xl hover:shadow-ink-950/50">
                {/* Top bar with ID and type */}
                <div className="flex items-center justify-between px-4 py-2 border-b border-ink-800/50 bg-ink-900/30">
                    <span className="text-ink-600 text-xs font-mono">
                        #{id}
                    </span>
                    <TypeBadge type={tokenType} />
                </div>

                {/* Preview Area */}
                <div className="relative h-52 overflow-hidden">
                    <div className="absolute inset-0 p-4 overflow-hidden">
                        {tokenType && tokenContent !== null ? (
                            tokenType === "text/html" ? (
                                <div className="absolute inset-0 [&>iframe]:!h-full [&>iframe]:!min-h-full">
                                    <HTMLViewer source={tokenContent} />
                                </div>
                            ) : tokenType === "text/markdown" ? (
                                <div
                                    className="prose prose-invert prose-sm max-w-none text-ink-300"
                                    data-color-mode="dark"
                                >
                                    <MDEditor.Markdown
                                        source={tokenContent}
                                        rehypePlugins={[
                                            () =>
                                                rehypeSanitize(
                                                    schemas.validMarkdown,
                                                ),
                                        ]}
                                    />
                                </div>
                            ) : (
                                <pre className="font-mono text-sm text-ink-300 leading-relaxed whitespace-pre overflow-x-auto">
                                    {tokenContent}
                                </pre>
                            )
                        ) : (
                            <div className="space-y-2">
                                <Skeleton
                                    count={5}
                                    baseColor="#1c1c1e"
                                    highlightColor="#2a2a2e"
                                />
                            </div>
                        )}
                    </div>

                    {/* Gradient fade at bottom */}
                    <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-ink-900 via-ink-900/80 to-transparent pointer-events-none" />

                    {/* Hover reveal indicator */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-ink-950/40">
                        <span className="px-4 py-2 bg-white/10 backdrop-blur-sm rounded-lg text-white text-sm font-medium border border-white/20">
                            Read more →
                        </span>
                    </div>
                </div>

                {/* Content Area - Compact */}
                <div className="px-3 py-2.5 bg-gradient-to-b from-ink-900 to-ink-900/80">
                    {/* Title and Author row */}
                    <div className="flex items-center justify-between gap-2">
                        <h3 className="text-ink-100 font-medium text-sm leading-tight line-clamp-1 group-hover:text-white transition-colors flex-1 min-w-0">
                            {tokenData?.name || (
                                <Skeleton
                                    baseColor="#1c1c1e"
                                    highlightColor="#2a2a2e"
                                    width="70%"
                                />
                            )}
                        </h3>
                        {tokenAuthor && (
                            <span className="text-ink-500 text-xs font-mono shrink-0">
                                <Address
                                    address={tokenAuthor}
                                    shorten
                                    nChar={4}
                                    disableLink
                                />
                            </span>
                        )}
                    </div>

                    {/* Stats row */}
                    <div className="flex items-center gap-1.5 mt-1.5 text-xs">
                        {totalSupply !== null ? (
                            <span className="text-ink-500 whitespace-nowrap">
                                {totalSupply} ed.
                            </span>
                        ) : (
                            <Skeleton
                                width={30}
                                baseColor="#1c1c1e"
                                highlightColor="#2a2a2e"
                            />
                        )}

                        {listedCount !== null && listedCount > 0 && (
                            <Fragment>
                                <span className="text-ink-700">·</span>
                                <span className="text-ink-500 whitespace-nowrap">
                                    {listedCount} listed
                                </span>
                            </Fragment>
                        )}

                        {floorPrice !== null && (
                            <Fragment>
                                <span className="text-ink-700">·</span>
                                <span className="text-green-400 whitespace-nowrap font-mono">
                                    {floorPrice} Ξ
                                </span>
                            </Fragment>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
