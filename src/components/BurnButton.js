import { Fragment } from "react";
import React, { useState } from "react";
import { useRecoilState } from "recoil";
import { ethers } from "ethers";
import { v1 } from "../common/abi";
import config from "../config";
import getGasSettings from "../common/gas";

import { useWalletProvider } from "../common/provider";

import BurnModal from "./BurnModal";
import { useTransactionHelper } from "../common/transaction_status";
import { standardErrorState } from "../common/error";

export default function BurnButton({
    id,
    walletAddress,
    balance,
    availableAmount,
    onUpdate,
}) {
    const handleTransaction = useTransactionHelper();
    const zangAddress = config.contractAddresses.v1.zang;
    const zangABI = v1.zang;
    const [_, setStandardError] = useRecoilState(standardErrorState);

    const [walletProvider, setWalletProvider] = useWalletProvider();

    const [burnModalOpen, setBurnModalOpen] = useState(false);

    const burn = async (amount) => {
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

        const contract = new ethers.Contract(
            zangAddress,
            zangABI,
            walletProvider,
        );
        const contractWithSigner = contract.connect(walletProvider.getSigner());
        const transactionFunction = async () =>
            await contractWithSigner.burn(
                walletAddress,
                id,
                amount,
                getGasSettings(),
            );
        const { success } = await handleTransaction(
            transactionFunction,
            `Burn NFT #${id}`,
        );
        if (success && onUpdate) {
            onUpdate(id);
        }
    };

    return (
        <Fragment>
            <button
                className="px-3 py-1.5 text-sm font-medium rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-colors"
                onClick={() => setBurnModalOpen(true)}
            >
                Burn
            </button>
            <BurnModal
                isOpen={burnModalOpen}
                setIsOpen={setBurnModalOpen}
                onClose={burn}
                balance={balance}
                availableAmount={availableAmount}
            />
        </Fragment>
    );
}
