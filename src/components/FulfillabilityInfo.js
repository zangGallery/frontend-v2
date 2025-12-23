import React from "react";
import { Tooltip } from "react-tooltip";

export default function FulfillabilityInfo({ group }) {
    const totalListedAmount = (group) =>
        group.listings.reduce((acc, listing) => acc + listing.amount, 0);

    return (
        <div>
            {group.sellerBalance !== undefined &&
            group.sellerBalance !== null &&
            group.sellerBalance < totalListedAmount(group) ? (
                group.sellerBalance === 0 ? (
                    <span
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30"
                        data-tooltip-id="fulfillability-tooltip"
                        data-tooltip-content="The listing is active but the seller doesn't have any token to sell."
                        data-tooltip-place="bottom"
                    >
                        Unfulfillable
                    </span>
                ) : (
                    <span
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30"
                        data-tooltip-id="fulfillability-tooltip"
                        data-tooltip-content="The listing is active but the seller doesn't have enough tokens to sell."
                        data-tooltip-place="bottom"
                    >
                        Partially fulfillable ({group.sellerBalance} available)
                    </span>
                )
            ) : null}
            <Tooltip id="fulfillability-tooltip" />
        </div>
    );
}
