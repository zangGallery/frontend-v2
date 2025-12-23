import React from "react";
import { useForm } from "react-hook-form";
import { joiResolver } from "@hookform/resolvers/joi";
import ValidatedInput from "./ValidatedInput";
import { schemas } from "../common";

const defaultValues = {
    to: "",
    amount: 1,
};

export default function TransferModal({
    isOpen,
    setIsOpen,
    onClose,
    balance,
    availableAmount,
}) {
    const {
        register,
        formState: { isDirty, isValid, errors },
        handleSubmit,
        watch,
    } = useForm({
        defaultValues,
        mode: "onChange",
        resolver: joiResolver(schemas.transfer),
    });
    const watchAmount = watch("amount");

    const closeModal = (data) => {
        if (data) {
            onClose(data.to, data.amount);
        }
        setIsOpen(false);
    };

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
                        Gift NFT
                    </h3>
                </div>

                <div className="p-6 space-y-4">
                    <div className="flex justify-between text-sm">
                        <span className="text-ink-400">Balance</span>
                        <span className="text-white font-mono">{balance}</span>
                    </div>
                    {balance !== availableAmount && (
                        <div className="flex justify-between text-sm">
                            <span className="text-ink-400">
                                Available (not listed)
                            </span>
                            <span className="text-white font-mono">
                                {availableAmount}
                            </span>
                        </div>
                    )}

                    <ValidatedInput
                        label="Amount"
                        name="amount"
                        type="number"
                        step="1"
                        min="1"
                        errors={errors}
                        register={register}
                    />
                    <ValidatedInput
                        label="Recipient Address"
                        name="to"
                        type="string"
                        errors={errors}
                        register={register}
                        placeholder="0x... or ENS name"
                    />

                    {watchAmount > availableAmount &&
                        watchAmount <= balance && (
                            <div className="p-3 rounded-lg bg-amber-500/20 border border-amber-500/30">
                                <p className="text-amber-400 text-sm">
                                    <strong>Warning:</strong> You only have{" "}
                                    {availableAmount} free token
                                    {availableAmount === 1 ? "" : "s"}. This
                                    will use {watchAmount - availableAmount}{" "}
                                    token
                                    {watchAmount - availableAmount === 1
                                        ? ""
                                        : "s"}{" "}
                                    from listings.
                                </p>
                            </div>
                        )}

                    {watchAmount > balance && (
                        <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/30">
                            <p className="text-red-400 text-sm">
                                <strong>Error:</strong> Cannot gift more than
                                you own ({balance}).
                            </p>
                        </div>
                    )}
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
                            (!isValid && isDirty) || watchAmount > balance
                                ? "bg-ink-700 text-ink-500 cursor-not-allowed"
                                : "bg-accent-cyan text-ink-950 hover:bg-accent-cyan/90"
                        }`}
                        disabled={
                            (!isValid && isDirty) || watchAmount > balance
                        }
                        onClick={handleSubmit(closeModal)}
                    >
                        Gift
                    </button>
                </div>
            </div>
        </div>
    );
}
