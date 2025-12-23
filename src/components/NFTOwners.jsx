import Skeleton from "react-loading-skeleton";
import Address from "./Address";

export default function NFTOwners({ balances }) {
    return (
        <div className="space-y-2">
            {balances ? (
                Object.keys(balances).length > 0 ? (
                    Object.keys(balances).map((owner, index) => (
                        <div
                            key={index}
                            className="flex items-center justify-between py-2 border-b border-ink-800 last:border-b-0"
                        >
                            <span className="font-mono text-sm text-ink-300">
                                <Address address={owner} shorten nChar={8} />
                            </span>
                            <span className="text-white font-medium">
                                {balances[owner]}
                            </span>
                        </div>
                    ))
                ) : (
                    <p className="text-ink-500 text-sm text-center py-4">
                        No owners found
                    </p>
                )
            ) : (
                <Skeleton
                    count={3}
                    baseColor="#27272a"
                    highlightColor="#3f3f46"
                />
            )}
        </div>
    );
}
