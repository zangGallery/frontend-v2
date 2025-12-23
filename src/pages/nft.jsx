import { Fragment, useEffect, useMemo, useState } from "react";
import { atom, useRecoilState } from "recoil";
import { publicClient } from "../common/provider";
import config from "../config";
import { formatEther, zeroAddress } from "viem";
import { v1 } from "../common/abi";
import rehypeSanitize from "rehype-sanitize";
import schemas from "../common/schemas";
import { useLocation, useNavigate } from "react-router-dom";

import MDEditor from "@uiw/react-md-editor";
import HTMLViewer from "../components/HTMLViewer";
import { Header } from "../components";
import { useAccount } from "wagmi";

import "../styles/tailwind.css";
import "../styles/globals.css";
import Listings from "../components/Listings";
import TransferButton from "../components/TransferButton";
import { useEns } from "../common/ens";
import TypeTag from "../components/TypeTag";
import EditRoyaltyButton from "../components/EditRoyaltyButton";
import ListButton from "../components/ListButton";
import EditButton from "../components/EditButton";
import DelistButton from "../components/DelistButton";
import Decimal from "decimal.js";
import {
    formatError,
    isTokenExistenceError,
    standardErrorState,
} from "../common/error";
import StandardErrorDisplay from "../components/StandardErrorDisplay";
import NFTOwners from "../components/NFTOwners";

import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";

import { getEvents, computeBalances, parseHistory } from "../common/history";
import NFTHistory from "../components/NFTHistory";

import Address from "../components/Address";

const burnedIdsState = atom({
    key: "burnedIds",
    default: [],
});

export default function NFTPage() {
    const location = useLocation();
    const navigate = useNavigate();
    const zangAddress = config.contractAddresses.v1.zang;
    const marketplaceAddress = config.contractAddresses.v1.marketplace;

    const searchParams = new URLSearchParams(location.search);
    const id = searchParams.get("id") ? parseInt(searchParams.get("id")) : null;
    const [updateTracker, setUpdateTracker] = useState([0, null]);

    const { address: walletAddress, isConnected } = useAccount();
    const { lookupEns } = useEns();

    const [burnedIds, setBurnedIds] = useRecoilState(burnedIdsState);
    const [prevValidId, setPrevValidId] = useState(null);
    const [nextValidId, setNextValidId] = useState(null);

    // === NFT Info ===

    const [tokenData, setTokenData] = useState(null);
    const [tokenType, setTokenType] = useState(null);
    const [tokenContent, setTokenContent] = useState(null);
    const [tokenAuthor, setTokenAuthor] = useState(null);
    const [royaltyInfo, setRoyaltyInfo] = useState(null);
    const [totalSupply, setTotalSupply] = useState(null);
    const [lastNFTId, setLastNFTId] = useState(null);
    const [exists, setExists] = useState(true);
    const [listings, setListings] = useState(null);

    const [events, setEvents] = useState(null);

    // View source toggle for markdown/html
    const [showSource, setShowSource] = useState(false);

    // ETH price in USD
    const [ethPrice, setEthPrice] = useState(null);

    const [, setStandardError] = useRecoilState(standardErrorState);

    const queryBalances = async (author) => {
        if (!id || !author) {
            return;
        }
        const firstZangBlock = config.firstBlocks.v1.base.zang;
        const firstMarketplaceBlock = config.firstBlocks.v1.base.marketplace;

        const events = await getEvents(
            id,
            author,
            firstZangBlock,
            firstMarketplaceBlock,
        );
        setEvents(events);
    };

    const queryPrevValidId = async () => {
        if (!id) {
            return;
        }

        let prevId = id - 1;
        let isValid = false;
        while (prevId >= 1 && !isValid) {
            if (burnedIds.includes(prevId)) {
                prevId--;
            } else {
                try {
                    isValid = await publicClient.readContract({
                        address: zangAddress,
                        abi: v1.zang,
                        functionName: "exists",
                        args: [BigInt(prevId)],
                    });
                } catch (e) {
                    setStandardError(formatError(e));
                    break;
                }

                if (isValid) {
                    break;
                } else {
                    setBurnedIds((burnedIds) => [...burnedIds, prevId]);
                    prevId--;
                }
            }
        }

        if (isValid) {
            return prevId;
        } else {
            return null;
        }
    };

    const queryLastNFTId = async () => {
        try {
            const newLastNFTId = await publicClient.readContract({
                address: zangAddress,
                abi: v1.zang,
                functionName: "lastTokenId",
            });
            setLastNFTId(Number(newLastNFTId));
            return Number(newLastNFTId);
        } catch (e) {
            setStandardError(formatError(e));
        }
    };

    const queryNextValidId = async (knownLastNFTId = null) => {
        if (!id) return;

        let nextId = id + 1;
        let isValid = false;
        let actualLastNFTId = knownLastNFTId || lastNFTId;

        if (actualLastNFTId === null) {
            actualLastNFTId = await queryLastNFTId();
        }

        while (nextId <= actualLastNFTId && !isValid) {
            if (nextId === actualLastNFTId) {
                await queryLastNFTId();
            }
            if (burnedIds.includes(nextId)) {
                nextId++;
            } else {
                try {
                    isValid = await publicClient.readContract({
                        address: zangAddress,
                        abi: v1.zang,
                        functionName: "exists",
                        args: [BigInt(nextId)],
                    });
                } catch (e) {
                    setStandardError(formatError(e));
                    break;
                }

                if (isValid) {
                    break;
                } else {
                    setBurnedIds((burnedIds) => [...burnedIds, nextId]);
                    nextId++;
                }
            }
        }

        if (isValid) {
            return nextId;
        } else {
            return null;
        }
    };

    const queryTokenURI = async () => {
        if (!id) return;

        try {
            const tURI = await publicClient.readContract({
                address: zangAddress,
                abi: v1.zang,
                functionName: "uri",
                args: [BigInt(id)],
            });
            return tURI;
        } catch (e) {
            if (isTokenExistenceError(e)) {
                setExists(false);
            } else {
                setStandardError(formatError(e));
            }
        }
    };

    const queryTokenAuthor = async () => {
        if (!id) return;

        try {
            const author = await publicClient.readContract({
                address: zangAddress,
                abi: v1.zang,
                functionName: "authorOf",
                args: [BigInt(id)],
            });
            setTokenAuthor(author);

            return author;
        } catch (e) {
            if (!isTokenExistenceError(e)) {
                setStandardError(formatError(e));
            }
        }
    };

    const queryTokenData = async (tURI) => {
        if (!tURI) return;

        try {
            const tokenDataResponse = await fetch(tURI);
            const newTokenData = await tokenDataResponse.json();
            setTokenData(newTokenData);

            return newTokenData;
        } catch (e) {
            setStandardError(formatError(e));
        }
    };

    const queryTokenContent = async (newTokenData) => {
        if (!newTokenData?.text_uri) return;
        var parsedTextURI = newTokenData.text_uri;
        parsedTextURI = parsedTextURI.replace("charset=UTF-8,", "");
        try {
            const response = await fetch(parsedTextURI);
            const parsedText = await response.text();
            setTokenType(response.headers.get("content-type"));
            setTokenContent(parsedText);
        } catch (e) {
            setStandardError(formatError(e));
        }
    };

    const queryRoyaltyInfo = async () => {
        if (!id) return;

        try {
            const [recipient, amount] = await publicClient.readContract({
                address: zangAddress,
                abi: v1.zang,
                functionName: "royaltyInfo",
                args: [BigInt(id), 10000n],
            });
            const decimalAmount = new Decimal(amount.toString());
            setRoyaltyInfo({
                recipient,
                amount: decimalAmount.div(100).toNumber(),
            });
        } catch (e) {
            setStandardError(formatError(e));
        }
    };

    const queryTotalSupply = async () => {
        if (!id) return;

        try {
            const supply = await publicClient.readContract({
                address: zangAddress,
                abi: v1.zang,
                functionName: "totalSupply",
                args: [BigInt(id)],
            });
            setTotalSupply(supply);
        } catch (e) {
            setStandardError(formatError(e));
        }
    };

    const changeId = (right) => () => {
        if (right) {
            navigate("/nft?id=" + nextValidId);
        } else {
            navigate("/nft?id=" + prevValidId);
        }
    };

    useEffect(() => {
        if (!id) {
            navigate("/");
        }
    }, [id, navigate]);

    // Set document title
    useEffect(() => {
        document.title = id ? `#${id} - zang` : "zang";
    }, [id]);

    useEffect(() => {
        setStandardError(null);
    }, [id]);

    useEffect(() => {
        const loadNftData = async () => {
            setExists(true);
            setTokenData(null);
            setTokenContent(null);
            setTokenType(null);
            setTokenAuthor(null);
            setRoyaltyInfo(null);
            setTotalSupply(null);
            setPrevValidId(null);
            setNextValidId(null);
            setListings(null);
            setListingSellerBalances({});
            setEvents(null);
            setShowSource(false);

            // Fetch lastNFTId first so prev/next queries can use it
            const fetchedLastNFTId = await queryLastNFTId();

            queryTokenURI()
                .then((tURI) => queryTokenData(tURI))
                .then((newTokenData) => queryTokenContent(newTokenData));
            queryTokenAuthor().then((author) => queryBalances(author));
            queryRoyaltyInfo();
            queryTotalSupply();
            queryListings();

            const [prevId, nextId] = await Promise.all([
                queryPrevValidId(),
                queryNextValidId(fetchedLastNFTId),
            ]);
            setPrevValidId(prevId);
            setNextValidId(nextId);
        };
        loadNftData();
    }, [id]);

    /*useEffect(() => queryTokenAuthor(), [id, readProvider])
    useEffect(() => queryRoyaltyInfo(), [id, readProvider])
    useEffect(() => queryTotalSupply(), [id, readProvider])
    useEffect(() => setExists(true), [id, readProvider])*/

    // Fetch ETH price in USD
    useEffect(() => {
        const fetchEthPrice = async () => {
            try {
                const response = await fetch(
                    "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd",
                );
                const data = await response.json();
                setEthPrice(data.ethereum.usd);
            } catch (e) {
                // Failed to fetch ETH price - silent fail
            }
        };
        fetchEthPrice();
    }, []);

    // === Listing info ===

    const [listingSellerBalances, setListingSellerBalances] = useState({});

    const activeListings = useMemo(() => {
        return listings
            ? listings.filter((listing) => listing.seller !== zeroAddress)
            : null;
    }, [listings]);

    const listingGroups = useMemo(() => {
        if (!activeListings) {
            return null;
        }
        const groups = {};

        for (const listing of activeListings) {
            const seller = listing.seller;
            if (!groups[seller]) {
                groups[seller] = [];
            }
            groups[seller].push(listing);
        }

        const newGroups = [];

        for (const [seller, _listings] of Object.entries(groups)) {
            _listings.sort((a, b) => a.price - b.price);

            newGroups.push({
                seller,
                listings: _listings,
                sellerBalance: listingSellerBalances[seller],
            });
        }

        // Sort by price
        for (const group of newGroups) {
            group.listings.sort((a, b) => a.price - b.price);
        }
        newGroups.sort((a, b) => a.listings[0].price - b.listings[0].price);

        return newGroups;
    }, [activeListings, listingSellerBalances]);

    const addressBalance = (address) => {
        return listingSellerBalances[address];
    };

    const userBalance = () => {
        return addressBalance(walletAddress);
    };

    const addressAvailableAmount = (address) => {
        if (!id || !walletAddress || activeListings === null) return null;

        let _availableAmount = addressBalance(address);

        if (_availableAmount === null || _availableAmount === undefined) {
            return null;
        }

        for (const listing of activeListings) {
            if (listing.seller === address) {
                _availableAmount -= listing.amount;
            }
        }

        if (_availableAmount < 0) {
            _availableAmount = 0;
        }

        return _availableAmount;
    };

    const userAvailableAmount = () => {
        return addressAvailableAmount(walletAddress);
    };

    const queryListings = async () => {
        if (!id) return;

        try {
            const listingCount = await publicClient.readContract({
                address: marketplaceAddress,
                abi: v1.marketplace,
                functionName: "listingCount",
                args: [BigInt(id)],
            });
            const count = Number(listingCount);

            const newListings = [];
            const promises = [];

            for (let i = 0; i < count; i++) {
                promises.push(
                    publicClient
                        .readContract({
                            address: marketplaceAddress,
                            abi: v1.marketplace,
                            functionName: "listings",
                            args: [BigInt(id), BigInt(i)],
                        })
                        .then((listing) => {
                            // listing is an array: [price, seller, amount]
                            const [price, seller, amount] = listing;
                            newListings.push({
                                amount: Number(amount),
                                price: formatEther(price),
                                seller: seller,
                                id: i,
                            });
                        })
                        .catch(() => null),
                );
            }

            await Promise.all(promises);

            newListings.sort((a, b) => a.price - b.price);

            // If a listing has seller 0x0000... it has been delisted
            setListings(newListings);
        } catch (e) {
            setStandardError(formatError(e));
        }
    };

    const updateSellerBalance = async (sellerAddress) => {
        if (!sellerAddress || !id) return;

        try {
            const balance = await publicClient.readContract({
                address: zangAddress,
                abi: v1.zang,
                functionName: "balanceOf",
                args: [sellerAddress, BigInt(id)],
            });
            setListingSellerBalances((currentBalance) => ({
                ...currentBalance,
                [sellerAddress]: Number(balance),
            }));
        } catch (e) {
            setStandardError(formatError(e));
        }
    };

    const queryUserBalance = async () => {
        await updateSellerBalance(walletAddress);
    };

    const queryListingSellerBalances = async () => {
        if (!id || !listings) return;

        const promises = [];

        try {
            if (activeListings) {
                for (const listing of activeListings) {
                    const promise = updateSellerBalance(listing.seller);
                    promises.push(promise);
                }
            }

            await Promise.all(promises);
        } catch (e) {
            setStandardError(formatError(e));
        }
    };

    // Fetch seller balances when listings load or change
    useEffect(() => {
        if (activeListings && activeListings.length > 0) {
            queryListingSellerBalances();
        }
    }, [activeListings]);

    // Refresh data when a transaction completes
    useEffect(() => {
        const updateId = updateTracker[0];
        if (updateId === id) {
            queryListings();
            queryTotalSupply();
            queryRoyaltyInfo();
        }
    }, [updateTracker]);

    // Query user balance when wallet connects or id changes
    useEffect(() => {
        if (walletAddress && id && isConnected) {
            queryUserBalance();
        }
    }, [walletAddress, id, isConnected]);

    const onUpdate = (updatedNFTId) => {
        setUpdateTracker(([_, counter]) => [updatedNFTId, counter + 1]);
    };

    return (
        <div className="min-h-screen bg-ink-950">
            <Header />
            <StandardErrorDisplay />

            {exists ? (
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    {/* Navigation Arrows */}
                    <div className="flex justify-between items-center mb-6">
                        <button
                            onClick={changeId(false)}
                            disabled={!prevValidId}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                                prevValidId
                                    ? "text-ink-300 hover:text-white hover:bg-ink-800"
                                    : "text-ink-700 cursor-not-allowed"
                            }`}
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
                                    d="M15 19l-7-7 7-7"
                                />
                            </svg>
                            <span className="hidden sm:inline">Previous</span>
                        </button>

                        <span className="text-ink-500 font-mono text-sm">
                            #{id}
                        </span>

                        <button
                            onClick={changeId(true)}
                            disabled={!nextValidId}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                                nextValidId
                                    ? "text-ink-300 hover:text-white hover:bg-ink-800"
                                    : "text-ink-700 cursor-not-allowed"
                            }`}
                        >
                            <span className="hidden sm:inline">Next</span>
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
                                    d="M9 5l7 7-7 7"
                                />
                            </svg>
                        </button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Content Area - 2/3 width on large screens */}
                        <div className="lg:col-span-2">
                            <div className="bg-ink-900/50 rounded-2xl border border-ink-800 overflow-hidden">
                                    {/* View Source Toggle - only for markdown and html */}
                                    {tokenType &&
                                        (tokenType === "text/markdown" ||
                                            tokenType === "text/html") && (
                                            <div className="flex justify-end px-4 pt-4">
                                                <button
                                                    onClick={() =>
                                                        setShowSource(
                                                            !showSource,
                                                        )
                                                    }
                                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                                        showSource
                                                            ? "bg-ink-700 text-white"
                                                            : "bg-ink-800/50 text-ink-400 hover:text-ink-200 hover:bg-ink-800"
                                                    }`}
                                                >
                                                    {showSource ? (
                                                        <Fragment>
                                                            <svg
                                                                className="w-4 h-4"
                                                                fill="none"
                                                                stroke="currentColor"
                                                                viewBox="0 0 24 24"
                                                            >
                                                                <path
                                                                    strokeLinecap="round"
                                                                    strokeLinejoin="round"
                                                                    strokeWidth={
                                                                        2
                                                                    }
                                                                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                                                />
                                                                <path
                                                                    strokeLinecap="round"
                                                                    strokeLinejoin="round"
                                                                    strokeWidth={
                                                                        2
                                                                    }
                                                                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                                                />
                                                            </svg>
                                                            View Rendered
                                                        </Fragment>
                                                    ) : (
                                                        <Fragment>
                                                            <svg
                                                                className="w-4 h-4"
                                                                fill="none"
                                                                stroke="currentColor"
                                                                viewBox="0 0 24 24"
                                                            >
                                                                <path
                                                                    strokeLinecap="round"
                                                                    strokeLinejoin="round"
                                                                    strokeWidth={
                                                                        2
                                                                    }
                                                                    d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                                                                />
                                                            </svg>
                                                            View Source
                                                        </Fragment>
                                                    )}
                                                </button>
                                            </div>
                                        )}
                                    <div className="p-6">
                                        {tokenType &&
                                        (tokenContent ||
                                            tokenContent === "") ? (
                                            showSource &&
                                            typeof window !== "undefined" ? (
                                                (() => {
                                                    const AceEditor =
                                                        require("react-ace").default;
                                                    require("ace-builds/src-noconflict/mode-html");
                                                    require("ace-builds/src-noconflict/mode-markdown");
                                                    require("ace-builds/src-noconflict/theme-monokai");
                                                    return (
                                                        <AceEditor
                                                            mode={
                                                                tokenType ===
                                                                "text/html"
                                                                    ? "html"
                                                                    : "markdown"
                                                            }
                                                            theme="monokai"
                                                            value={tokenContent}
                                                            name="source-viewer"
                                                            readOnly={true}
                                                            editorProps={{
                                                                $blockScrolling: false,
                                                            }}
                                                            setOptions={{
                                                                showPrintMargin: false,
                                                                showGutter: true,
                                                                highlightActiveLine: false,
                                                                highlightGutterLine: false,
                                                            }}
                                                            width="100%"
                                                            height="400px"
                                                            fontSize={14}
                                                        />
                                                    );
                                                })()
                                            ) : tokenType === "text/html" ? (
                                                <HTMLViewer
                                                    source={tokenContent}
                                                />
                                            ) : tokenType ===
                                              "text/markdown" ? (
                                                <div
                                                    className="prose prose-invert prose-ink max-w-none"
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
                                                <pre className="font-mono text-ink-100 whitespace-pre overflow-x-auto text-sm leading-relaxed">
                                                    {tokenContent}
                                                </pre>
                                            )
                                        ) : (
                                            <Skeleton
                                                count={12}
                                                baseColor="#27272a"
                                                highlightColor="#3f3f46"
                                            />
                                        )}
                                    </div>
                                </div>
                        </div>

                        {/* Info Sidebar - 1/3 width on large screens */}
                        <div className="space-y-6">
                            {/* Title & Author */}
                            <div className="bg-ink-900/50 rounded-2xl border border-ink-800 p-6">
                                <h1 className="text-2xl font-bold text-white mb-2">
                                    {tokenData?.name !== null &&
                                    tokenData?.name !== undefined ? (
                                        tokenData.name
                                    ) : (
                                        <Skeleton
                                            baseColor="#27272a"
                                            highlightColor="#3f3f46"
                                        />
                                    )}
                                </h1>

                                <p className="text-ink-400 mb-4">
                                    {tokenAuthor !== null ? (
                                        <Fragment>
                                            by{" "}
                                            <Address
                                                address={tokenAuthor}
                                                shorten
                                                nChar={8}
                                            />
                                        </Fragment>
                                    ) : (
                                        <Skeleton
                                            width={150}
                                            baseColor="#27272a"
                                            highlightColor="#3f3f46"
                                        />
                                    )}
                                </p>

                                <div className="flex flex-wrap gap-2 mb-4">
                                    {tokenType && totalSupply !== null ? (
                                        <Fragment>
                                            <TypeTag type={tokenType} />
                                            <span className="px-2 py-1 text-xs font-medium rounded bg-ink-800 text-ink-300">
                                                Edition:{" "}
                                                {totalSupply.toString()}
                                            </span>
                                        </Fragment>
                                    ) : (
                                        <Skeleton
                                            width={180}
                                            baseColor="#27272a"
                                            highlightColor="#3f3f46"
                                        />
                                    )}
                                </div>

                                {tokenData?.description !== undefined &&
                                tokenData?.description !== null ? (
                                    <p className="text-ink-300 text-sm italic">
                                        {tokenData.description}
                                    </p>
                                ) : (
                                    <Skeleton
                                        count={2}
                                        baseColor="#27272a"
                                        highlightColor="#3f3f46"
                                    />
                                )}

                                {royaltyInfo &&
                                tokenAuthor &&
                                royaltyInfo?.amount !== null ? (
                                    <div className="flex items-center gap-2 mt-4">
                                        <p className="text-ink-500 text-xs">
                                            {royaltyInfo.amount.toFixed(2)}%
                                            royalty to{" "}
                                            {royaltyInfo.recipient ===
                                            tokenAuthor
                                                ? "the author"
                                                : royaltyInfo.recipient}
                                        </p>
                                        {tokenAuthor === walletAddress && (
                                            <EditRoyaltyButton
                                                id={id}
                                                walletAddress={walletAddress}
                                                currentRoyaltyPercentage={
                                                    royaltyInfo?.amount
                                                }
                                                onUpdate={onUpdate}
                                                minimal
                                            />
                                        )}
                                    </div>
                                ) : (
                                    <Skeleton
                                        width={200}
                                        baseColor="#27272a"
                                        highlightColor="#3f3f46"
                                        className="mt-4"
                                    />
                                )}
                            </div>

                            {/* User's Holdings & Actions - only show if user owns this NFT */}
                            {isConnected &&
                                userBalance() !== null &&
                                userBalance() !== 0 && (
                                    <div className="bg-ink-900/50 rounded-2xl border border-ink-800 p-6">
                                        {/* Ownership stats */}
                                        <div className="flex items-baseline justify-between mb-5">
                                            <div>
                                                <span className="text-3xl font-bold text-white">
                                                    {userBalance()}
                                                </span>
                                                <span className="text-ink-400 text-sm ml-2">
                                                    owned
                                                </span>
                                            </div>
                                            {userBalance() !==
                                                userAvailableAmount() &&
                                                userAvailableAmount() !==
                                                    null && (
                                                    <span className="text-ink-500 text-sm">
                                                        {userAvailableAmount()}{" "}
                                                        available
                                                    </span>
                                                )}
                                        </div>

                                        {/* Primary action - List for Sale */}
                                        <ListButton
                                            id={id}
                                            userBalance={userBalance()}
                                            userAvailableAmount={userAvailableAmount()}
                                            onUpdate={onUpdate}
                                            walletAddress={walletAddress}
                                            fullWidth
                                        />

                                        {/* Secondary action - Transfer */}
                                        <TransferButton
                                            id={id}
                                            walletAddress={walletAddress}
                                            balance={userBalance()}
                                            availableAmount={userAvailableAmount()}
                                            onUpdate={onUpdate}
                                            secondary
                                        />

                                        {/* User's active listings */}
                                        {listingGroups?.find(
                                            (g) => g.seller === walletAddress,
                                        )?.listings?.length > 0 && (
                                            <div className="border-t border-ink-700 pt-4 mt-5">
                                                <p className="text-xs text-ink-500 uppercase tracking-wide mb-3">
                                                    Your Listings
                                                </p>
                                                <div className="space-y-2">
                                                    {listingGroups
                                                        .find(
                                                            (g) =>
                                                                g.seller ===
                                                                walletAddress,
                                                        )
                                                        .listings.map(
                                                            (listing) => (
                                                                <div
                                                                    key={
                                                                        listing.id
                                                                    }
                                                                    className="flex items-center justify-between py-2"
                                                                >
                                                                    <div className="flex items-baseline gap-2">
                                                                        <span className="text-white font-mono text-sm">
                                                                            {
                                                                                listing.price
                                                                            }{" "}
                                                                            ETH
                                                                        </span>
                                                                        {ethPrice && (
                                                                            <span className="text-ink-500 text-xs">
                                                                                $
                                                                                {(
                                                                                    parseFloat(
                                                                                        listing.price,
                                                                                    ) *
                                                                                    ethPrice
                                                                                ).toFixed(
                                                                                    2,
                                                                                )}
                                                                            </span>
                                                                        )}
                                                                        <span className="text-ink-500 text-xs">
                                                                            ×{" "}
                                                                            {
                                                                                listing.amount
                                                                            }
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex items-center gap-3">
                                                                        <EditButton
                                                                            nftId={id}
                                                                            listingId={listing.id}
                                                                            balance={userBalance()}
                                                                            onUpdate={onUpdate}
                                                                            oldAmount={listing.amount}
                                                                            oldPrice={listing.price}
                                                                            ethPrice={ethPrice}
                                                                            availableAmount={userAvailableAmount()}
                                                                            minimal
                                                                        />
                                                                        <DelistButton
                                                                            nftId={
                                                                                id
                                                                            }
                                                                            listingId={
                                                                                listing.id
                                                                            }
                                                                            onUpdate={
                                                                                onUpdate
                                                                            }
                                                                            minimal
                                                                        />
                                                                    </div>
                                                                </div>
                                                            ),
                                                        )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                            {/* Marketplace - listings from others */}
                            <div className="bg-ink-900/50 rounded-2xl border border-ink-800 p-6">
                                <Listings
                                    isConnected={isConnected}
                                    id={id}
                                    walletAddress={walletAddress}
                                    onUpdate={onUpdate}
                                    listingGroups={listingGroups}
                                    showOnlyOthers={true}
                                    ethPrice={ethPrice}
                                />
                            </div>

                            {/* Owners */}
                            <div className="bg-ink-900/50 rounded-2xl border border-ink-800 overflow-hidden">
                                <div className="px-4 py-3 border-b border-ink-800/50">
                                    <h3 className="text-sm font-medium text-ink-300">
                                        Owners
                                    </h3>
                                </div>
                                <div className="p-4 max-h-60 overflow-y-auto">
                                    <NFTOwners
                                        balances={computeBalances(events)}
                                    />
                                </div>
                            </div>

                            {/* History */}
                            <div className="bg-ink-900/50 rounded-2xl border border-ink-800 overflow-hidden">
                                <div className="px-4 py-3 border-b border-ink-800/50">
                                    <h3 className="text-sm font-medium text-ink-300">
                                        History
                                    </h3>
                                </div>
                                <div className="p-4 max-h-72 overflow-y-auto">
                                    <NFTHistory
                                        history={parseHistory(events)}
                                        hideId
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
                    <div className="bg-ink-900/50 rounded-2xl border border-ink-800 p-12 inline-block">
                        <p className="text-ink-400 text-lg">
                            This NFT doesn't exist.
                        </p>
                        <a
                            href="/"
                            className="inline-flex items-center mt-4 px-6 py-3 bg-accent-cyan text-ink-950 font-medium rounded-lg hover:bg-accent-cyan/90 transition-colors"
                        >
                            Back to Home
                        </a>
                    </div>
                </div>
            )}
        </div>
    );
}

