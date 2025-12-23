import { useState, useEffect } from "react";

export default function EditModal({
    isOpen,
    setIsOpen,
    onClose,
    balance,
    availableAmount,
    oldAmount,
    oldPrice,
    ethPrice,
}) {
    const [newAmount, setNewAmount] = useState("");
    const [newPrice, setNewPrice] = useState("");

    // Reset form when modal opens
    useEffect(() => {
        if (isOpen) {
            setNewAmount(oldAmount?.toString() || "");
            setNewPrice(oldPrice?.toString() || "");
        }
    }, [isOpen, oldAmount, oldPrice]);

    const effectiveAvailableAmount = Math.min(
        availableAmount + oldAmount,
        balance,
    );

    const amountChanged = newAmount !== "" && parseInt(newAmount) !== oldAmount;
    const priceChanged = newPrice !== "" && newPrice !== oldPrice;
    const hasChanges = amountChanged || priceChanged;

    const amountNum = parseInt(newAmount) || 0;
    const amountExceedsBalance = amountNum > balance;
    const amountExceedsAvailable = amountNum > effectiveAvailableAmount;

    const isValid =
        hasChanges &&
        !amountExceedsBalance &&
        amountNum > 0 &&
        parseFloat(newPrice) >= 0;

    const closeModal = () => {
        setIsOpen(false);
    };

    const handleSubmit = () => {
        if (!isValid) return;

        const finalAmount = amountChanged ? newAmount : null;
        const finalPrice = priceChanged ? newPrice : null;

        setIsOpen(false);
        onClose(finalAmount, finalPrice);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={closeModal}
            />
            <div className="relative bg-ink-900 border border-ink-700 rounded-xl shadow-2xl max-w-sm w-full mx-4 overflow-hidden">
                {/* Header */}
                <div className="px-5 py-4 border-b border-ink-800">
                    <h3 className="text-lg font-semibold text-white">
                        Edit Listing
                    </h3>
                    <p className="text-ink-400 text-sm mt-0.5">
                        Update the price or amount for this listing
                    </p>
                </div>

                {/* Form */}
                <div className="p-5 space-y-5">
                    {/* Price Field */}
                    <div className="space-y-2">
                        <label className="flex items-center justify-between">
                            <span className="text-sm font-medium text-ink-200">
                                Price per edition
                            </span>
                            {priceChanged && (
                                <span className="text-xs text-accent-cyan">
                                    Changed
                                </span>
                            )}
                        </label>
                        <div className="relative">
                            <input
                                type="number"
                                min="0"
                                step="0.001"
                                value={newPrice}
                                onChange={(e) => setNewPrice(e.target.value)}
                                className={`w-full px-3 py-2.5 pr-12 bg-ink-800 border rounded-lg text-white font-mono placeholder-ink-500 focus:outline-none focus:ring-2 focus:ring-accent-cyan/50 transition-colors ${
                                    priceChanged
                                        ? "border-accent-cyan/50"
                                        : "border-ink-700"
                                }`}
                                placeholder="0.00"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 text-sm font-medium">
                                ETH
                            </span>
                        </div>
                        <div className="flex justify-between text-xs">
                            {oldPrice && (
                                <span className="text-ink-500">
                                    Currently: {oldPrice} ETH
                                    {ethPrice && (
                                        <span className="text-ink-600 ml-1">
                                            (${(parseFloat(oldPrice) * ethPrice).toFixed(2)})
                                        </span>
                                    )}
                                </span>
                            )}
                            {ethPrice && newPrice && parseFloat(newPrice) > 0 && (
                                <span className="text-ink-400">
                                    ≈ ${(parseFloat(newPrice) * ethPrice).toFixed(2)}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Amount Field */}
                    <div className="space-y-2">
                        <label className="flex items-center justify-between">
                            <span className="text-sm font-medium text-ink-200">
                                Amount to list
                            </span>
                            {amountChanged && (
                                <span className="text-xs text-accent-cyan">
                                    Changed
                                </span>
                            )}
                        </label>
                        <div className="relative">
                            <input
                                type="number"
                                min="1"
                                step="1"
                                max={balance}
                                value={newAmount}
                                onChange={(e) => setNewAmount(e.target.value)}
                                className={`w-full px-3 py-2.5 bg-ink-800 border rounded-lg text-white font-mono placeholder-ink-500 focus:outline-none focus:ring-2 focus:ring-accent-cyan/50 transition-colors ${
                                    amountExceedsBalance
                                        ? "border-red-500"
                                        : amountChanged
                                          ? "border-accent-cyan/50"
                                          : "border-ink-700"
                                }`}
                                placeholder="1"
                            />
                        </div>
                        <div className="flex justify-between text-xs">
                            <span className="text-ink-500">
                                Currently: {oldAmount} edition
                                {oldAmount !== 1 ? "s" : ""}
                            </span>
                            <span className="text-ink-500">
                                You own: {balance}
                            </span>
                        </div>
                    </div>

                    {/* Warnings */}
                    {amountExceedsBalance && (
                        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                            <p className="text-red-400 text-sm">
                                You can't list more than you own ({balance}{" "}
                                editions).
                            </p>
                        </div>
                    )}

                    {!amountExceedsBalance &&
                        amountExceedsAvailable &&
                        amountNum > 0 && (
                            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                                <p className="text-amber-400 text-sm">
                                    <strong>Note:</strong> This will use{" "}
                                    {amountNum - effectiveAvailableAmount}{" "}
                                    edition
                                    {amountNum - effectiveAvailableAmount !== 1
                                        ? "s"
                                        : ""}{" "}
                                    from other listings, which may make them
                                    unfulfillable.
                                </p>
                            </div>
                        )}

                    {/* Summary of changes */}
                    {hasChanges && isValid && (
                        <div className="p-3 rounded-lg bg-ink-800/50 border border-ink-700">
                            <p className="text-ink-300 text-sm">
                                {priceChanged && amountChanged ? (
                                    <>
                                        Updating price to{" "}
                                        <span className="text-white font-mono">
                                            {newPrice} ETH
                                        </span>{" "}
                                        and amount to{" "}
                                        <span className="text-white font-mono">
                                            {newAmount}
                                        </span>
                                    </>
                                ) : priceChanged ? (
                                    <>
                                        Updating price to{" "}
                                        <span className="text-white font-mono">
                                            {newPrice} ETH
                                        </span>
                                    </>
                                ) : (
                                    <>
                                        Updating amount to{" "}
                                        <span className="text-white font-mono">
                                            {newAmount}
                                        </span>{" "}
                                        edition{newAmount !== "1" ? "s" : ""}
                                    </>
                                )}
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 py-4 border-t border-ink-800 flex justify-end gap-3">
                    <button
                        className="px-4 py-2 text-sm font-medium rounded-lg text-ink-300 hover:text-white hover:bg-ink-800 transition-colors"
                        onClick={closeModal}
                    >
                        Cancel
                    </button>
                    <button
                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                            isValid
                                ? "bg-accent-cyan text-ink-950 hover:bg-accent-cyan/90"
                                : "bg-ink-700 text-ink-500 cursor-not-allowed"
                        }`}
                        disabled={!isValid}
                        onClick={handleSubmit}
                    >
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
}
