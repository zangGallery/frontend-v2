import { useMemo, useState, useRef } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { parseEther } from "viem";
import { useWriteContract } from "wagmi";
import { useRecoilState } from "recoil";
import config from "../config";
import { v1 } from "../common/abi";
import { standardErrorState } from "../common/error";
import getGasSettings from "../common/gas";
import { useTransactionHelper } from "../common/transaction_status";

import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";

// Mini step chart showing price depth
function DepthChart({ tiers, buyAmounts, totalAvailable, onSelectQuantity }) {
    const [hoveredTier, setHoveredTier] = useState(null);
    const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
    const containerRef = useRef(null);

    if (!tiers || tiers.length === 0) return null;

    const height = 40;
    const maxPrice = Math.max(...tiers.map(t => parseFloat(t.price)));
    const minPrice = Math.min(...tiers.map(t => parseFloat(t.price)));
    const priceRange = maxPrice - minPrice || 1;

    // Calculate cumulative positions for step chart
    let cumX = 0;
    let cumQty = 0;
    const steps = tiers.map((tier) => {
        const widthPercent = (tier.quantity / totalAvailable) * 100;
        const heightPercent = tiers.length === 1
            ? 30
            : 20 + ((parseFloat(tier.price) - minPrice) / priceRange) * 60;
        const buyAmount = buyAmounts[tier.price] || 0;
        const buyWidthPercent = (buyAmount / totalAvailable) * 100;

        const step = {
            x: cumX,
            width: widthPercent,
            height: heightPercent,
            buyWidth: buyWidthPercent,
            price: tier.price,
            quantity: tier.quantity,
            cumQtyStart: cumQty,
            cumQtyEnd: cumQty + tier.quantity,
        };
        cumX += widthPercent;
        cumQty += tier.quantity;
        return step;
    });

    const handleMouseMove = (e, step) => {
        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            setTooltipPos({
                x: e.clientX - rect.left,
                y: e.clientY - rect.top,
            });
        }
        setHoveredTier(step);
    };

    const handleClick = (e, step) => {
        if (!containerRef.current || !onSelectQuantity) return;

        const rect = containerRef.current.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const containerWidth = rect.width;

        // Calculate position within this step (0 to 1)
        const stepStartPx = (step.x / 100) * containerWidth;
        const stepWidthPx = (step.width / 100) * containerWidth;
        const posInStep = Math.max(0, Math.min(1, (clickX - stepStartPx) / stepWidthPx));

        // Calculate quantity: all previous tiers + portion of this tier
        const qtyInThisStep = Math.max(1, Math.round(posInStep * step.quantity));
        const totalQty = step.cumQtyStart + qtyInThisStep;

        onSelectQuantity(totalQty);
    };

    return (
        <div className="relative" style={{ height }} ref={containerRef}>
            <svg
                viewBox={`0 0 100 ${height}`}
                preserveAspectRatio="none"
                className="w-full h-full"
            >
                {steps.map((step, i) => (
                    <g key={i}>
                        {/* Background bar (available) */}
                        <rect
                            x={step.x}
                            y={height - (step.height * height / 100)}
                            width={step.width}
                            height={(step.height * height / 100)}
                            className={`transition-colors ${hoveredTier === step ? 'fill-ink-600' : 'fill-ink-700'}`}
                        />
                        {/* Highlighted portion (selected to buy) */}
                        {step.buyWidth > 0 && (
                            <rect
                                x={step.x}
                                y={height - (step.height * height / 100)}
                                width={step.buyWidth}
                                height={(step.height * height / 100)}
                                className="fill-white/80"
                            />
                        )}
                        {/* Invisible hover target */}
                        <rect
                            x={step.x}
                            y={0}
                            width={step.width}
                            height={height}
                            className="fill-transparent cursor-pointer"
                            onMouseMove={(e) => handleMouseMove(e, step)}
                            onMouseLeave={() => setHoveredTier(null)}
                            onClick={(e) => handleClick(e, step)}
                        />
                    </g>
                ))}
            </svg>

            {/* Vertical line */}
            {hoveredTier && (
                <div
                    className="absolute top-0 bottom-0 w-px bg-white/50 pointer-events-none"
                    style={{ left: tooltipPos.x }}
                />
            )}

            {/* Tooltip */}
            {hoveredTier && (
                <div
                    className="absolute z-10 pointer-events-none bg-ink-900 border border-ink-700 rounded px-2 py-1 text-xs whitespace-nowrap shadow-lg"
                    style={{
                        left: Math.min(tooltipPos.x + 8, containerRef.current?.offsetWidth - 80 || 0),
                        top: -32,
                    }}
                >
                    <span className="text-white font-medium">{hoveredTier.quantity}×</span>
                    <span className="text-ink-400 ml-1">at</span>
                    <span className="text-white font-medium ml-1">{hoveredTier.price} ETH</span>
                </div>
            )}

            {/* Price labels for first and last tier if different */}
            {tiers.length > 1 && (
                <div className="absolute inset-x-0 -bottom-4 flex justify-between text-[9px] text-ink-600 tabular-nums">
                    <span>{tiers[0].price}</span>
                    <span>{tiers[tiers.length - 1].price}</span>
                </div>
            )}
        </div>
    );
}

export default function Listings({
    isConnected,
    id,
    listingGroups,
    walletAddress,
    onUpdate,
    showOnlyOthers = false,
    ethPrice = null,
}) {
    const [quantity, setQuantity] = useState(1);
    const [isBuying, setIsBuying] = useState(false);

    const marketplaceAddress = config.contractAddresses.v1.marketplace;
    const marketplaceABI = v1.marketplace;
    const { writeContractAsync } = useWriteContract();
    const [, setStandardError] = useRecoilState(standardErrorState);
    const handleTransaction = useTransactionHelper();

    // Flatten all listings with seller info, sorted by price
    const allListings = useMemo(() => {
        if (!listingGroups) return null;

        // Check if any seller balance is still loading
        const hasLoadingBalances = listingGroups.some(
            group => group.sellerBalance === undefined || group.sellerBalance === null
        );
        if (hasLoadingBalances) return null;

        const listings = [];
        for (const group of listingGroups) {
            if (showOnlyOthers && group.seller?.toLowerCase() === walletAddress?.toLowerCase()) {
                continue;
            }
            for (const listing of group.listings) {
                // Only include listings that can be fulfilled
                const fulfillable = Math.min(listing.amount, group.sellerBalance);
                if (fulfillable > 0) {
                    listings.push({
                        ...listing,
                        seller: group.seller,
                        sellerBalance: group.sellerBalance,
                        fulfillable,
                    });
                }
            }
        }
        return listings.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
    }, [listingGroups, showOnlyOthers, walletAddress]);

    // Group listings by price tier for the depth chart
    const priceTiers = useMemo(() => {
        if (!allListings || allListings.length === 0) return [];

        const tiers = {};
        for (const listing of allListings) {
            const price = listing.price;
            if (!tiers[price]) {
                tiers[price] = { price, quantity: 0, listings: [] };
            }
            tiers[price].quantity += listing.fulfillable;
            tiers[price].listings.push(listing);
        }

        return Object.values(tiers).sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
    }, [allListings]);

    // Calculate sweep: which listings to buy and total cost
    const sweepInfo = useMemo(() => {
        if (!allListings || allListings.length === 0) return null;

        let remaining = quantity;
        let totalCost = 0;
        const orders = [];

        for (const listing of allListings) {
            if (remaining <= 0) break;

            const buyAmount = Math.min(remaining, listing.fulfillable);
            totalCost += buyAmount * parseFloat(listing.price);
            orders.push({
                listingId: listing.id,
                amount: buyAmount,
                price: listing.price,
            });
            remaining -= buyAmount;
        }

        // Calculate how much of each tier is being bought
        let buyRemaining = quantity;
        const tierBuyAmounts = {};
        for (const tier of priceTiers) {
            if (buyRemaining <= 0) break;
            const buyFromTier = Math.min(buyRemaining, tier.quantity);
            tierBuyAmounts[tier.price] = buyFromTier;
            buyRemaining -= buyFromTier;
        }

        return {
            orders,
            totalCost: totalCost.toFixed(6).replace(/\.?0+$/, ''),
            totalAvailable: allListings.reduce((sum, l) => sum + l.fulfillable, 0),
            floorPrice: allListings[0]?.price,
            canFulfill: remaining === 0,
            tierBuyAmounts,
        };
    }, [allListings, quantity, priceTiers]);

    const formatUsd = (ethAmount) => {
        if (!ethPrice) return null;
        return (parseFloat(ethAmount) * ethPrice).toFixed(2);
    };

    const handleBuy = async () => {
        if (!sweepInfo || sweepInfo.orders.length === 0) return;

        setIsBuying(true);
        setStandardError(null);

        try {
            // Execute buys sequentially (could batch if contract supports it)
            for (const order of sweepInfo.orders) {
                const priceWei = parseEther(order.price);
                const totalValue = priceWei * BigInt(order.amount);

                const transactionFunction = async () =>
                    await writeContractAsync({
                        address: marketplaceAddress,
                        abi: marketplaceABI,
                        functionName: "buyToken",
                        args: [BigInt(id), BigInt(order.listingId), BigInt(order.amount)],
                        value: totalValue,
                        ...getGasSettings(),
                    });

                const { success } = await handleTransaction(
                    transactionFunction,
                    `Buy ${order.amount} × NFT #${id}`,
                );

                if (!success) {
                    break;
                }
            }

            if (onUpdate) {
                onUpdate(id);
            }
        } finally {
            setIsBuying(false);
            setQuantity(1);
        }
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
            </div>
        );
    }

    if (allListings.length === 0 || !sweepInfo) {
        return (
            <div className="py-8 text-center">
                <p className="text-ink-500 text-sm">No listings available</p>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            {/* Stats row */}
            <div className="flex items-baseline justify-between">
                <div>
                    <p className="text-xs text-ink-500 uppercase tracking-wide mb-1">Floor</p>
                    <div className="flex items-baseline gap-1.5">
                        <span className="text-2xl font-semibold text-white tabular-nums">
                            {sweepInfo.floorPrice}
                        </span>
                        <span className="text-sm text-ink-500">ETH</span>
                    </div>
                    {ethPrice && (
                        <p className="text-sm text-ink-500 mt-0.5">${formatUsd(sweepInfo.floorPrice)}</p>
                    )}
                </div>
                <div className="text-right">
                    <p className="text-xs text-ink-500 uppercase tracking-wide mb-1">Available</p>
                    <p className="text-2xl font-semibold text-ink-300 tabular-nums">{sweepInfo.totalAvailable}</p>
                </div>
            </div>

            {/* Depth chart - full width */}
            {priceTiers.length > 1 && (
                <div className="py-2">
                    <DepthChart
                        tiers={priceTiers}
                        buyAmounts={sweepInfo.tierBuyAmounts}
                        totalAvailable={sweepInfo.totalAvailable}
                        onSelectQuantity={setQuantity}
                    />
                </div>
            )}

            {/* Buy controls - stacked on mobile */}
            <div className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                    {/* Quantity selector */}
                    <div className="flex items-center bg-ink-800 rounded-lg">
                        <button
                            onClick={() => setQuantity(Math.max(1, quantity - 1))}
                            disabled={quantity <= 1}
                            className="px-3 py-2 text-ink-400 hover:text-white disabled:text-ink-600 disabled:cursor-not-allowed transition-colors"
                        >
                            −
                        </button>
                        <input
                            type="number"
                            min="1"
                            max={sweepInfo.totalAvailable}
                            value={quantity}
                            onChange={(e) => setQuantity(Math.max(1, Math.min(sweepInfo.totalAvailable, parseInt(e.target.value) || 1)))}
                            className="w-12 text-center bg-transparent text-white font-medium tabular-nums focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <button
                            onClick={() => setQuantity(Math.min(sweepInfo.totalAvailable, quantity + 1))}
                            disabled={quantity >= sweepInfo.totalAvailable}
                            className="px-3 py-2 text-ink-400 hover:text-white disabled:text-ink-600 disabled:cursor-not-allowed transition-colors"
                        >
                            +
                        </button>
                    </div>

                    {/* Total */}
                    <div className="text-right">
                        <p className="text-white font-medium tabular-nums">
                            {sweepInfo.totalCost} <span className="text-ink-500">ETH</span>
                        </p>
                        {ethPrice && (
                            <p className="text-xs text-ink-500 tabular-nums">${formatUsd(sweepInfo.totalCost)}</p>
                        )}
                    </div>
                </div>

                {/* Multi-tx warning */}
                {sweepInfo.orders.length > 1 && (
                    <p className="text-xs text-amber-500/80 text-center">
                        This purchase spans {sweepInfo.orders.length} listings — you'll need to sign {sweepInfo.orders.length} transactions
                    </p>
                )}

                {/* Buy button - full width */}
                {isConnected ? (
                    <button
                        onClick={handleBuy}
                        disabled={isBuying || !sweepInfo.canFulfill}
                        className={`w-full py-3 text-sm font-medium rounded-lg transition-colors ${
                            isBuying || !sweepInfo.canFulfill
                                ? "bg-ink-700 text-ink-500 cursor-not-allowed"
                                : "bg-white text-ink-950 hover:bg-ink-200"
                        }`}
                    >
                        {isBuying ? "Buying..." : sweepInfo.orders.length > 1 ? `Buy (${sweepInfo.orders.length} txs)` : "Buy"}
                    </button>
                ) : (
                    <ConnectButton.Custom>
                        {({ openConnectModal }) => (
                            <button
                                onClick={openConnectModal}
                                className="w-full py-3 text-sm font-medium rounded-lg bg-white text-ink-950 hover:bg-ink-200 transition-colors"
                            >
                                Connect to Buy
                            </button>
                        )}
                    </ConnectButton.Custom>
                )}
            </div>
        </div>
    );
}
