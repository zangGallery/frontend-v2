import { useForm } from "react-hook-form";
import { joiResolver } from "@hookform/resolvers/joi";
import ValidatedInput from "./ValidatedInput";
import { schemas } from "../common";
import { FixedNumber } from "ethers";

const defaultValues = {
    amount: 1,
};

export default function BuyModal({
    isOpen,
    setIsOpen,
    onClose,
    maxAmount,
    sellerBalance,
    price,
}) {
    const {
        register,
        formState: { isDirty, isValid, errors },
        handleSubmit,
        watch,
    } = useForm({
        defaultValues,
        mode: "onChange",
        resolver: joiResolver(schemas.buy),
    });

    const watchAmount = watch("amount", defaultValues.amount);

    const validAmount = () => watchAmount <= Math.min(maxAmount, sellerBalance);

    const closeModal = (data) => {
        if (data) {
            onClose(data.amount);
        }
        setIsOpen(false);
    };

    const total = () => {
        if (!watchAmount || price <= 0) {
            return undefined;
        }
        try {
            return FixedNumber.from(watchAmount)
                .mulUnsafe(FixedNumber.from(price))
                .toString();
        } catch (e) {
            return undefined;
        }
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
                        Buy NFT
                    </h3>
                </div>

                <div className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 rounded-lg bg-ink-800/50">
                            <p className="text-xs text-ink-500 uppercase tracking-wide mb-1">
                                Listed
                            </p>
                            <p className="text-white font-mono">{maxAmount}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-ink-800/50">
                            <p className="text-xs text-ink-500 uppercase tracking-wide mb-1">
                                Price Each
                            </p>
                            <p className="text-white font-mono">{price} ETH</p>
                        </div>
                    </div>

                    {sellerBalance < maxAmount && (
                        <div className="p-3 rounded-lg bg-amber-500/20 border border-amber-500/30">
                            <p className="text-amber-400 text-sm">
                                Seller only has {sellerBalance} available
                            </p>
                        </div>
                    )}

                    <ValidatedInput
                        label="Amount to Buy"
                        name="amount"
                        type="number"
                        step="1"
                        min="1"
                        errors={errors}
                        register={register}
                    />

                    <div className="p-4 rounded-lg bg-accent-cyan/10 border border-accent-cyan/20">
                        <p className="text-xs text-ink-400 uppercase tracking-wide mb-1">
                            Total
                        </p>
                        <p className="text-2xl font-bold text-accent-cyan font-mono">
                            {total() && errors.amount === undefined
                                ? `${total()} ETH`
                                : "—"}
                        </p>
                    </div>

                    {!validAmount() && (
                        <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/30">
                            <p className="text-red-400 text-sm">
                                <strong>Error:</strong>
                                {watchAmount <= maxAmount
                                    ? ` Cannot buy more than seller's balance (${sellerBalance}).`
                                    : ` Cannot buy more than listed amount (${maxAmount}).`}
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
                            (!isValid && isDirty) || !validAmount()
                                ? "bg-ink-700 text-ink-500 cursor-not-allowed"
                                : "bg-accent-cyan text-ink-950 hover:bg-accent-cyan/90"
                        }`}
                        disabled={(!isValid && isDirty) || !validAmount()}
                        onClick={handleSubmit(closeModal)}
                    >
                        Buy Now
                    </button>
                </div>
            </div>
        </div>
    );
}
