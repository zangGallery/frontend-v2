import { useEffect, useState } from "react";
import { publicClient } from "../common/provider";
import { NFTCard } from "../components";
import InfiniteScroll from "react-infinite-scroll-component";
import config from "../config";
import { v1 } from "../common/abi";
import { Header } from "../components";
import { useRecoilState } from "recoil";
import { formatError, standardErrorState } from "../common/error";
import StandardErrorDisplay from "../components/StandardErrorDisplay";
import { useAccount } from "wagmi";

import "../styles/tailwind.css";
import "../styles/globals.css";

export default function Home() {
    const { address: walletAddress, isConnected } = useAccount();
    const [lastNFTId, setLastNFTId] = useState(null);
    const [nfts, setNFTs] = useState([]);
    const [nftToBalance, setNftToBalance] = useState({});

    const [, setStandardError] = useRecoilState(standardErrorState);

    const zangAddress = config.contractAddresses.v1.zang;
    const increment = 5;

    useEffect(() => {
        if (!isConnected || !walletAddress) {
            return;
        }
        // Reset NFTs when wallet changes
        setNFTs([]);
        setNftToBalance({});
    }, [walletAddress, isConnected]);

    useEffect(() => {
        const fetchLastTokenId = async () => {
            try {
                const newLastNFTId = await publicClient.readContract({
                    address: zangAddress,
                    abi: v1.zang,
                    functionName: "lastTokenId",
                });
                setLastNFTId(Number(newLastNFTId));
            } catch (e) {
                setStandardError(formatError(e));
            }
        };
        fetchLastTokenId();
    }, [setStandardError]);

    const updateNftToBalance = async (nftId, address) => {
        try {
            const balance = await publicClient.readContract({
                address: zangAddress,
                abi: v1.zang,
                functionName: "balanceOf",
                args: [address, BigInt(nftId)],
            });

            setNftToBalance((currentNftToBalance) => ({
                ...currentNftToBalance,
                [nftId]: Number(balance),
            }));
        } catch (e) {
            setStandardError(formatError(e));
        }
    };

    const getMoreIds = async (count, address) => {
        if (!address) {
            return;
        }

        const newNFTs = [...nfts];

        for (let i = 0; i < count; i++) {
            const newId = lastNFTId - newNFTs.length;
            if (newId >= 1) {
                newNFTs.push(newId);
                updateNftToBalance(newId, address);
            }
        }

        setNFTs(newNFTs);
    };

    useEffect(() => {
        getMoreIds(20, walletAddress);
    }, [lastNFTId, walletAddress]);

    const filteredNfts = nfts.filter(
        (nftId) =>
            nftToBalance[nftId] !== undefined && nftToBalance[nftId] !== 0,
    );

    // Still loading if:
    // 1. We have NFT IDs but haven't checked all their balances yet
    // 2. We haven't fetched any NFT IDs yet (but lastNFTId is known)
    // 3. We're still searching for owned NFTs (none found yet but more to check)
    const stillLoadingBalances =
        nfts.length > 0 && Object.keys(nftToBalance).length < nfts.length;
    const stillSearching =
        lastNFTId !== null &&
        (nfts.length === 0 ||
            (filteredNfts.length === 0 && nfts.length < lastNFTId));
    const isLoading =
        lastNFTId === null || stillLoadingBalances || stillSearching;

    useEffect(() => {
        if (filteredNfts.length < 20 && nfts.length < lastNFTId) {
            getMoreIds(20, walletAddress);
        }
    }, [nfts, walletAddress]);

    return (
        <div className="min-h-screen bg-ink-950">
            <Header />
            <StandardErrorDisplay />
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <h1 className="text-3xl md:text-4xl font-display font-bold text-center text-white mb-8">
                    Your Collection
                </h1>
                {walletAddress ? (
                    isLoading ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-3">
                            <svg
                                className="animate-spin h-8 w-8 text-accent-cyan"
                                fill="none"
                                viewBox="0 0 24 24"
                            >
                                <circle
                                    className="opacity-25"
                                    cx="12"
                                    cy="12"
                                    r="10"
                                    stroke="currentColor"
                                    strokeWidth="4"
                                />
                                <path
                                    className="opacity-75"
                                    fill="currentColor"
                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                />
                            </svg>
                            <span className="text-ink-400">
                                Loading your collection...
                            </span>
                        </div>
                    ) : filteredNfts.length > 0 ? (
                        <InfiniteScroll
                            dataLength={nfts.length}
                            next={() => getMoreIds(increment, walletAddress)}
                            hasMore={nfts.length < lastNFTId}
                            loader={
                                <div className="flex justify-center py-8">
                                    <div className="animate-pulse text-ink-400">
                                        Loading more...
                                    </div>
                                </div>
                            }
                            endMessage={
                                <div className="text-center py-8 text-ink-400">
                                    You've seen all your NFTs
                                </div>
                            }
                        >
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
                                {filteredNfts.map((id) => (
                                    <NFTCard id={id} key={id} />
                                ))}
                            </div>
                        </InfiniteScroll>
                    ) : (
                        <div className="text-center py-16">
                            <div className="inline-block p-8 rounded-2xl bg-ink-900/50 border border-ink-800">
                                <p className="text-ink-400 text-lg mb-4">
                                    Your collection is empty
                                </p>
                                <a
                                    href="/"
                                    className="inline-flex items-center px-6 py-3 bg-accent-cyan text-ink-950 font-medium rounded-lg hover:bg-accent-cyan/90 transition-colors"
                                >
                                    Explore NFTs
                                </a>
                            </div>
                        </div>
                    )
                ) : (
                    <div className="text-center py-16">
                        <div className="inline-block p-8 rounded-2xl bg-ink-900/50 border border-ink-800">
                            <p className="text-ink-400 text-lg">
                                Connect a wallet to view your collection
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

