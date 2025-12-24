import { useMemo } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import BuyButton from "./BuyButton";
import Address from "../components/Address";

import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";

export default function Listings({
    isConnected,
    id,
    listingGroups,
    walletAddress,
    onUpdate,
    showOnlyOthers = false,
    ethPrice = null,
}) {
    // Flatten all listings with seller info, sorted by price
    const allListings = useMemo(() => {
        if (!listingGroups) return null;

        const listings = [];
        for (const group of listingGroups) {
            if (showOnlyOthers && group.seller?.toLowerCase() === walletAddress?.toLowerCase()) {
                continue;
            }
            for (const listing of group.listings) {
                listings.push({
                    ...listing,
                    seller: group.seller,
                    sellerBalance: group.sellerBalance,
                });
            }
        }
        return listings.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
    }, [listingGroups, showOnlyOthers, walletAddress]);

    const formatUsd = (ethAmount) => {
        if (!ethPrice) return null;
        return (parseFloat(ethAmount) * ethPrice).toFixed(2);
    };

    if (allListings === null) {
        return (
            <div className="space-y-3">
                <Skeleton
                    height={52}
                    className="rounded-lg"
                    baseColor="#27272a"
                    highlightColor="#3f3f46"
                />
                <Skeleton
                    height={52}
                    className="rounded-lg"
                    baseColor="#27272a"
                    highlightColor="#3f3f46"
                />
            </div>
        );
    }

    if (allListings.length === 0) {
        return (
            <div className="py-12 text-center">
                <p className="text-ink-500 text-sm">No listings yet</p>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {allListings.map((listing, index) => {
                const isFulfillable = listing.sellerBalance > 0;
                const isPartial = listing.sellerBalance < listing.amount;

                return (
                    <div
                        key={`${listing.seller}-${listing.id}`}
                        className="group grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 py-3 px-4 -mx-4 rounded-lg hover:bg-ink-800/30 transition-colors"
                    >
                        {/* Price */}
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-base font-medium text-white tabular-nums">
                                {listing.price}
                            </span>
                            <span className="text-sm text-ink-500">ETH</span>
                            {ethPrice && (
                                <span className="text-xs text-ink-600 ml-1">
                                    (${formatUsd(listing.price)})
                                </span>
                            )}
                        </div>

                        {/* Amount - fixed width */}
                        <div className="w-12 text-right">
                            <span className="text-sm text-ink-500 tabular-nums">
                                ×{listing.amount}
                            </span>
                        </div>

                        {/* Seller */}
                        <div className="hidden sm:block w-24 text-right">
                            <span className="text-xs text-ink-500 font-mono">
                                <Address address={listing.seller} shorten nChar={6} />
                            </span>
                        </div>

                        {/* Action */}
                        <div className="flex items-center justify-end gap-2 w-20">
                            {!isFulfillable ? (
                                <span className="text-xs text-ink-600">Unavailable</span>
                            ) : isPartial ? (
                                <span className="text-xs text-amber-500/80">
                                    {listing.sellerBalance} left
                                </span>
                            ) : isConnected ? (
                                <BuyButton
                                    nftId={id}
                                    listingId={listing.id}
                                    price={listing.price}
                                    maxAmount={listing.amount}
                                    sellerBalance={listing.sellerBalance}
                                    onUpdate={onUpdate}
                                />
                            ) : (
                                <ConnectButton.Custom>
                                    {({ openConnectModal }) => (
                                        <button
                                            onClick={openConnectModal}
                                            className="text-xs text-accent-cyan hover:text-accent-cyan/80 transition-colors"
                                        >
                                            Connect
                                        </button>
                                    )}
                                </ConnectButton.Custom>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
