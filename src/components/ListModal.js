import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { joiResolver } from "@hookform/resolvers/joi";
import ValidatedInput from "./ValidatedInput";
import { schemas } from "../common";
import { useWalletProvider } from "../common/provider";
import { useTransactionHelper } from "../common/transaction_status";
import { useRecoilState } from "recoil";
import { formatError, standardErrorState } from "../common/error";
import { ethers } from "ethers";
import { v1 } from "../common/abi";
import config from "../config";
import getGasSettings from "../common/gas";

const defaultValues = {
    amount: 1,
    price: "0.1",
};

export default function ListModal({
    isOpen,
    setIsOpen,
    onClose,
    balance,
    availableAmount,
    id,
    walletAddress,
    onUpdate,
}) {
    const zangAddress = config.contractAddresses.v1.zang;
    const zangABI = v1.zang;

    const marketplaceAddress = config.contractAddresses.v1.marketplace;
    const {
        register,
        formState: { isDirty, isValid, errors },
        handleSubmit,
        watch,
    } = useForm({
        defaultValues,
        mode: "onChange",
        resolver: joiResolver(schemas.list),
    });

    const watchAmount = watch("amount");

    const closeModal = (data) => {
        setIsOpen(false);
        if (data) {
            onClose(data.amount, data.price);
        }
    };

    const warningMessage = () => {
        let message = "";
        if (availableAmount === 0) {
            message +=
                'You don\'t have any "free" (not tied to listings) tokens. ';
        } else {
            message += `You only have ${availableAmount} "free" (not tied to listings) token${
                availableAmount === 1 ? "" : "s"
            }. `;
        }

        message += `Proceeding will use ${watchAmount - availableAmount} token${
            watchAmount - availableAmount === 1 ? "" : "s"
        } `;
        message +=
            "tied to existing listings, making some listings unfulfillable.";

        return message;
    };

    const handleTransaction = useTransactionHelper();
    const [, setStandardError] = useRecoilState(standardErrorState);
    const [isApproved, setIsApproved] = useState(false);
    const [walletProvider] = useWalletProvider();

    const approveMarketplace = async () => {
        if (!walletProvider) {
            setStandardError("No wallet provider.");
            return;
        }
        if (!id) {
            setStandardError("No id specified.");
            return;
        }

        const contract = new ethers.Contract(
            zangAddress,
            zangABI,
            walletProvider,
        );
        const contractWithSigner = contract.connect(walletProvider.getSigner());
        const transactionFunction = async () =>
            await contractWithSigner.setApprovalForAll(
                marketplaceAddress,
                true,
                getGasSettings(),
            );

        const { success } = await handleTransaction(
            transactionFunction,
            "Approve Marketplace",
        );

        if (success) {
            setIsApproved(true);
            if (onUpdate) {
                onUpdate(id);
            }
        }
    };

    const checkApproval = async () => {
        if (!id || !walletAddress) return;

        const zangContract = new ethers.Contract(
            zangAddress,
            zangABI,
            walletProvider,
        );

        try {
            const approved = await zangContract.isApprovedForAll(
                walletAddress,
                marketplaceAddress,
            );
            setIsApproved(approved);
        } catch (e) {
            setStandardError(formatError(e));
        }
    };

    useEffect(() => {
        checkApproval();
    }, [id, walletAddress]);

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
                        List NFT for Sale
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
                        label="Price per item (ETH)"
                        name="price"
                        type="number"
                        step="0.001"
                        min="0"
                        errors={errors}
                        register={register}
                    />

                    {watchAmount > Math.min(balance, availableAmount) &&
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

                    {!isApproved && (
                        <div className="p-3 rounded-lg bg-ink-800/50 border border-ink-700">
                            <p className="text-ink-300 text-sm">
                                You need to approve the marketplace to list your
                                NFTs. This is a one-time approval.
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
                    {!isApproved ? (
                        <button
                            className="px-4 py-2 text-sm font-medium rounded-lg bg-accent-cyan text-ink-950 hover:bg-accent-cyan/90 transition-colors"
                            onClick={approveMarketplace}
                        >
                            Approve Marketplace
                        </button>
                    ) : (
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
                            List for Sale
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
