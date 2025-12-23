export default function Listing({ price, amount, ethPrice, children }) {
    const usdValue = ethPrice
        ? (parseFloat(price) * ethPrice).toFixed(2)
        : null;

    return (
        <div className="flex flex-col items-center">
            <div className="w-full flex justify-around py-3">
                <div className="text-center">
                    <p className="text-xs text-ink-500 uppercase tracking-wide mb-1">
                        Price
                    </p>
                    <p className="text-2xl font-semibold text-white">
                        {price}{" "}
                        <span className="text-ink-400 text-lg">ETH</span>
                    </p>
                    {usdValue && (
                        <p className="text-sm text-ink-500 mt-0.5">
                            ${usdValue}
                        </p>
                    )}
                </div>
                <div className="text-center">
                    <p className="text-xs text-ink-500 uppercase tracking-wide mb-1">
                        Amount
                    </p>
                    <p className="text-2xl font-semibold text-white">
                        {amount}
                    </p>
                </div>
            </div>
            {children}
        </div>
    );
}
