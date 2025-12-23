import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { joiResolver } from "@hookform/resolvers/joi";
import { schemas } from "../common";

const defaultValues = {
    amount: "",
    price: "",
};

export default function EditModal({
    isOpen,
    setIsOpen,
    onClose,
    balance,
    availableAmount,
    oldAmount,
}) {
    const effectiveAvailableAmount = Math.min(
        availableAmount + oldAmount,
        balance,
    );

    const [editAmount, setEditAmount] = useState(false);
    const [editPrice, setEditPrice] = useState(false);

    const {
        register,
        formState: { isDirty, isValid, errors },
        handleSubmit,
        watch,
    } = useForm({
        defaultValues,
        mode: "onChange",
        resolver: joiResolver(schemas.edit),
    });

    const watchAmount = watch("amount");
    const watchPrice = watch("price");

    const closeModal = (data) => {
        setIsOpen(false);
        if (data) {
            const amount = editAmount ? data.amount : null;
            const price = editPrice ? data.price : null;
            onClose(amount, price);
        }
    };

    const warningMessage = () => {
        let message = "";
        if (effectiveAvailableAmount === 0) {
            message +=
                'You don\'t have any "free" (not tied to listings) tokens. ';
        } else {
            message += `You only have ${effectiveAvailableAmount} "free" (not tied to listings) token${
                effectiveAvailableAmount === 1 ? "" : "s"
            }. `;
        }

        message += `Proceeding will use ${
            watchAmount - effectiveAvailableAmount
        } token${watchAmount - effectiveAvailableAmount === 1 ? "" : "s"} `;
        message +=
            "tied to existing listings, making some listings unfulfillable.";

        return message;
    };

    const validCheckboxes = () =>
        (editAmount || editPrice) &&
        !(editAmount && watchAmount === "") &&
        !(editPrice && watchPrice === "");

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={() => closeModal(null)}
            />
            <div className="relative bg-ink-900 border border-ink-700 rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
                <div className="px-6 py-4 border-b border-ink-700">
                    <h3 className="text-lg font-semibold text-white">
                        Edit Listing
                    </h3>
                </div>

                <div className="p-6 space-y-4">
                    <div className="flex justify-between text-sm">
                        <span className="text-ink-400">Balance</span>
                        <span className="text-white font-mono">{balance}</span>
                    </div>
                    {balance !== effectiveAvailableAmount && (
                        <div className="flex justify-between text-sm">
                            <span className="text-ink-400">
                                Available (not listed)
                            </span>
                            <span className="text-white font-mono">
                                {effectiveAvailableAmount}
                            </span>
                        </div>
                    )}

                    {/* Amount Checkbox and Input */}
                    <div className="space-y-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={editAmount}
                                onChange={(e) =>
                                    setEditAmount(e.target.checked)
                                }
                                className="w-4 h-4 rounded border-ink-600 bg-ink-800 text-accent-cyan focus:ring-accent-cyan focus:ring-offset-ink-900"
                            />
                            <span className="text-sm font-medium text-ink-200">
                                Edit Amount
                            </span>
                        </label>

                        {editAmount && (
                            <div>
                                <input
                                    className={`w-full px-3 py-2 bg-ink-800 border rounded-lg text-white placeholder-ink-500 focus:outline-none focus:ring-2 focus:ring-accent-cyan/50 ${
                                        errors.amount
                                            ? "border-red-500"
                                            : "border-ink-700"
                                    }`}
                                    type="number"
                                    min="1"
                                    step="1"
                                    placeholder="New amount"
                                    {...register("amount")}
                                />
                                {errors.amount && (
                                    <p className="mt-1 text-xs text-red-400">
                                        {errors.amount.message}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Price Checkbox and Input */}
                    <div className="space-y-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={editPrice}
                                onChange={(e) => setEditPrice(e.target.checked)}
                                className="w-4 h-4 rounded border-ink-600 bg-ink-800 text-accent-cyan focus:ring-accent-cyan focus:ring-offset-ink-900"
                            />
                            <span className="text-sm font-medium text-ink-200">
                                Edit Price
                            </span>
                        </label>

                        {editPrice && (
                            <div>
                                <input
                                    className={`w-full px-3 py-2 bg-ink-800 border rounded-lg text-white placeholder-ink-500 focus:outline-none focus:ring-2 focus:ring-accent-cyan/50 ${
                                        errors.price
                                            ? "border-red-500"
                                            : "border-ink-700"
                                    }`}
                                    type="number"
                                    min="0"
                                    step="0.001"
                                    placeholder="New price in ETH"
                                    {...register("price")}
                                />
                                {errors.price && (
                                    <p className="mt-1 text-xs text-red-400">
                                        {errors.price.message}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>

                    {editAmount &&
                        watchAmount >
                            Math.min(balance, effectiveAvailableAmount) &&
                        (watchAmount <= balance ? (
                            <div className="p-3 rounded-lg bg-amber-500/20 border border-amber-500/30">
                                <p className="text-amber-400 text-sm">
                                    <strong>Warning:</strong> {warningMessage()}
                                </p>
                            </div>
                        ) : (
                            <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/30">
                                <p className="text-red-400 text-sm">
                                    <strong>Error:</strong> Cannot list more
                                    than you own ({balance}).
                                </p>
                            </div>
                        ))}
                </div>

                <div className="px-6 py-4 border-t border-ink-700 flex justify-end gap-3">
                    <button
                        className="px-4 py-2 text-sm font-medium rounded-lg text-ink-300 hover:text-white hover:bg-ink-800 transition-colors"
                        onClick={() => closeModal(null)}
                    >
                        Cancel
                    </button>
                    <button
                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                            (!isValid && isDirty) ||
                            !validCheckboxes() ||
                            watchAmount > balance
                                ? "bg-ink-700 text-ink-500 cursor-not-allowed"
                                : "bg-accent-cyan text-ink-950 hover:bg-accent-cyan/90"
                        }`}
                        disabled={
                            (!isValid && isDirty) ||
                            !validCheckboxes() ||
                            watchAmount > balance
                        }
                        onClick={handleSubmit(closeModal)}
                    >
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
}
