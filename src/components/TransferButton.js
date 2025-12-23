import React, { useState } from "react";
import { ethers } from "ethers";
import { v1 } from "../common/abi";
import config from "../config";
import getGasSettings from "../common/gas";

import { useWalletProvider, ensProvider } from "../common/provider";

import TransferModal from "./TransferModal";
import { useTransactionHelper } from "../common/transaction_status";
import { useRecoilState } from "recoil";
import { standardErrorState } from "../common/error";

export default function TransferButton({
    id,
    walletAddress,
    balance,
    availableAmount,
    onUpdate,
    secondary = false,
}) {
    const zangAddress = config.contractAddresses.v1.zang;
    const zangABI = v1.zang;

    const [walletProvider, setWalletProvider] = useWalletProvider();

    const handleTransaction = useTransactionHelper();

    const [transferModalOpen, setTransferModalOpen] = useState(false);

    const [_, setStandardError] = useRecoilState(standardErrorState);

    const transfer = async (to, amount) => {
        if (to === null) {
            setStandardError("Please enter a valid address.");
            return;
        }

        if (amount === null) {
            setStandardError("Please enter an amount.");
            return;
        }

        if (!id) {
            setStandardError("Could not determine the ID of the NFT.");
            return;
        }
        if (!walletProvider) {
            setStandardError("Please connect a wallet.");
            return;
        }

        setStandardError(null);

        if (to.includes(".eth")) {
            try {
                const resolvedAddress = await ensProvider.resolveName(to);
                if (!resolvedAddress) {
                    setStandardError("Could not resolve ENS name.");
                    return;
                }
                to = resolvedAddress;
            } catch (e) {
                setStandardError("ENS resolution failed: " + e.message);
                return;
            }
        }

        const contract = new ethers.Contract(
            zangAddress,
            zangABI,
            walletProvider,
        );
        const contractWithSigner = contract.connect(walletProvider.getSigner());

        const transactionFunction = async () =>
            await contractWithSigner.safeTransferFrom(
                walletAddress,
                to,
                id,
                amount,
                [],
                getGasSettings(),
            );
        const { success } = await handleTransaction(
            transactionFunction,
            `Transfer NFT #${id}`,
        );
        if (success && onUpdate) {
            onUpdate(id);
        }
    };

    return (
        <>
            <button
                className={
                    secondary
                        ? "w-full mt-2 py-2 text-sm text-ink-400 hover:text-white transition-colors"
                        : "px-3 py-1.5 text-sm font-medium rounded-lg bg-ink-700 text-ink-200 hover:bg-ink-600 hover:text-white transition-colors"
                }
                onClick={() => setTransferModalOpen(true)}
            >
                {secondary ? "or transfer to someone" : "Gift"}
            </button>
            <TransferModal
                isOpen={transferModalOpen}
                setIsOpen={setTransferModalOpen}
                onClose={transfer}
                balance={balance}
                availableAmount={availableAmount}
            />
        </>
    );
}
