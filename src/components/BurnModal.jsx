import { useForm } from "react-hook-form";
import { joiResolver } from "@hookform/resolvers/joi";
import ValidatedInput from "./ValidatedInput";
import { schemas } from "../common";

const defaultValues = {
    amount: 1,
};

export default function BurnModal({
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
        resolver: joiResolver(schemas.burn),
    });
    const watchAmount = watch("amount");

    const closeModal = (data) => {
        if (data) {
            onClose(data.amount);
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
                <div className="px-6 py-4 border-b border-ink-700 flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-red-500/20">
                        <svg
                            className="w-5 h-5 text-red-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z"
                            />
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z"
                            />
                        </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-white">
                        Burn NFT
                    </h3>
                </div>

                <div className="p-6 space-y-4">
                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                        <p className="text-red-400 text-sm">
                            This action is irreversible. Burned tokens are
                            permanently destroyed.
                        </p>
                    </div>

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
                        label="Amount to Burn"
                        name="amount"
                        type="number"
                        step="1"
                        min="1"
                        errors={errors}
                        register={register}
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
                                <strong>Error:</strong> Cannot burn more than
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
                                : "bg-red-500 text-white hover:bg-red-600"
                        }`}
                        disabled={
                            (!isValid && isDirty) || watchAmount > balance
                        }
                        onClick={handleSubmit(closeModal)}
                    >
                        Burn
                    </button>
                </div>
            </div>
        </div>
    );
}
