import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { joiResolver } from "@hookform/resolvers/joi";
import ValidatedInput from "./ValidatedInput";
import { schemas } from "../common";

const defaultValues = {
    royaltyPercentage: 1,
};

export default function EditRoyaltyModal({
    isOpen,
    setIsOpen,
    onClose,
    currentRoyaltyPercentage,
}) {
    const {
        register,
        formState: { isDirty, isValid, errors },
        handleSubmit,
        setValue,
        watch,
    } = useForm({
        defaultValues,
        mode: "onChange",
        resolver: joiResolver(schemas.editRoyalty),
    });
    const watchRoyaltyPercentage = watch("royaltyPercentage");

    useEffect(() => {
        setValue("royaltyPercentage", currentRoyaltyPercentage - 0.01);
    }, [currentRoyaltyPercentage, setValue]);

    const closeModal = (data) => {
        if (data) {
            onClose(data.royaltyPercentage);
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
                        Edit Royalty
                    </h3>
                </div>

                <div className="p-6 space-y-4">
                    <div className="p-3 rounded-lg bg-ink-800/50">
                        <p className="text-xs text-ink-500 uppercase tracking-wide mb-1">
                            Current Royalty
                        </p>
                        <p className="text-white font-mono text-lg">
                            {currentRoyaltyPercentage.toFixed(2)}%
                        </p>
                    </div>

                    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                        <p className="text-amber-400 text-sm">
                            Royalty percentage can only be decreased, not
                            increased.
                        </p>
                    </div>

                    <ValidatedInput
                        label="New Royalty Percentage"
                        name="royaltyPercentage"
                        type="number"
                        defaultValue={currentRoyaltyPercentage - 0.01}
                        min="0"
                        max={currentRoyaltyPercentage - 0.01}
                        step="0.01"
                        errors={errors}
                        register={register}
                    />

                    {watchRoyaltyPercentage >= currentRoyaltyPercentage && (
                        <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/30">
                            <p className="text-red-400 text-sm">
                                <strong>Error:</strong> The royalty percentage
                                can only be decreased.
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
                            (!isValid && isDirty) ||
                            watchRoyaltyPercentage >= currentRoyaltyPercentage
                                ? "bg-ink-700 text-ink-500 cursor-not-allowed"
                                : "bg-accent-cyan text-ink-950 hover:bg-accent-cyan/90"
                        }`}
                        disabled={
                            (!isValid && isDirty) ||
                            watchRoyaltyPercentage >= currentRoyaltyPercentage
                        }
                        onClick={handleSubmit(closeModal)}
                    >
                        Update Royalty
                    </button>
                </div>
            </div>
        </div>
    );
}
