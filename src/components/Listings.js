import React from "react";

import BuyButton from "./BuyButton";
import FulfillabilityInfo from "./FulfillabilityInfo";
import Listing from "./Listing";
import Address from "../components/Address";

import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";

export default function Listings({
    walletProvider,
    id,
    listingGroups,
    walletAddress,
    onUpdate,
    showOnlyOthers = false,
    ethPrice = null,
}) {
    const otherListingGroups = () =>
        listingGroups
            ? listingGroups.filter(
                  (group) => !showOnlyOthers || group.seller !== walletAddress,
              )
            : null;

    return (
        <div>
            <h4 className="text-lg font-semibold text-white mb-4">
                Marketplace
            </h4>
            {otherListingGroups() !== null ? (
                otherListingGroups().length > 0 ? (
                    <div className="space-y-4">
                        {otherListingGroups().map((group, index) => (
                            <div
                                key={"group" + index}
                                className="bg-ink-800/50 rounded-xl p-4 border border-ink-700"
                            >
                                <div className="mb-3">
                                    <p className="text-xs text-ink-500 uppercase tracking-wide">
                                        Seller
                                    </p>
                                    <p className="font-mono text-sm text-ink-200">
                                        <Address
                                            address={group.seller}
                                            shorten
                                            nChar={8}
                                        />
                                    </p>
                                </div>
                                <FulfillabilityInfo group={group} />
                                <div className="space-y-3 mt-4">
                                    {group.listings.map((listing) => (
                                        <div
                                            key={listing.id}
                                            className="border-t border-ink-700 pt-3 first:border-t-0 first:pt-0"
                                        >
                                            <Listing
                                                price={listing.price}
                                                amount={listing.amount}
                                                ethPrice={ethPrice}
                                            >
                                                {walletProvider ? (
                                                    <BuyButton
                                                        nftId={id}
                                                        listingId={listing.id}
                                                        price={listing.price}
                                                        maxAmount={
                                                            listing.amount
                                                        }
                                                        sellerBalance={
                                                            group.sellerBalance
                                                        }
                                                        onUpdate={onUpdate}
                                                    />
                                                ) : (
                                                    <button
                                                        className="px-4 py-2 bg-ink-700 text-ink-400 rounded-lg cursor-not-allowed text-sm"
                                                        disabled
                                                    >
                                                        Connect wallet to buy
                                                    </button>
                                                )}
                                            </Listing>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-ink-500 text-center py-8">
                        No listings available
                    </p>
                )
            ) : (
                <Skeleton
                    height={120}
                    className="rounded-xl"
                    baseColor="#27272a"
                    highlightColor="#3f3f46"
                />
            )}
        </div>
    );
}
