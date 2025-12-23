import React, { useState } from "react";
import { ethers } from "ethers";
import { v1 } from "../common/abi";
import { ListModal } from ".";
import { parseEther } from "@ethersproject/units";
import config from "../config";
import getGasSettings from "../common/gas";
import { useWalletProvider } from "../common/provider";
import { useTransactionHelper } from "../common/transaction_status";

import { useRecoilState } from "recoil";
import { standardErrorState } from "../common/error";

export default function ListButton({
    id,
    userBalance,
    userAvailableAmount,
    onUpdate,
    walletAddress,
    fullWidth = false,
}) {
    const marketplaceAddress = config.contractAddresses.v1.marketplace;
    const marketplaceABI = v1.marketplace;

    const [walletProvider, setWalletProvider] = useWalletProvider();
    const handleTransaction = useTransactionHelper();

    const [listModalOpen, setListModalOpen] = useState(false);
    const [_, setStandardError] = useRecoilState(standardErrorState);

    const list = async (amount, price) => {
        if (amount === null) {
            setStandardError("Please enter an amount.");
            return;
        }
        if (price === null) {
            setStandardError("Please enter a price.");
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
            marketplaceAddress,
            marketplaceABI,
            walletProvider,
        );
        const contractWithSigner = contract.connect(walletProvider.getSigner());
        const transactionFunction = async () =>
            await contractWithSigner.listToken(
                id,
                parseEther(price),
                amount,
                getGasSettings(),
            );

        const { success } = await handleTransaction(
            transactionFunction,
            `List NFT #${id}`,
        );
        if (success && onUpdate) {
            onUpdate(id);
        }
    };

    return (
        <>
            <button
                className={`px-4 py-2.5 text-sm font-medium rounded-lg bg-accent-cyan text-ink-950 hover:bg-accent-cyan/90 transition-colors ${fullWidth ? "w-full" : ""}`}
                onClick={() => setListModalOpen(true)}
            >
                List for Sale
            </button>
            <ListModal
                isOpen={listModalOpen}
                setIsOpen={setListModalOpen}
                onClose={list}
                balance={userBalance}
                availableAmount={userAvailableAmount}
                id={id}
                walletAddress={walletAddress}
                onUpdate={onUpdate}
            />
        </>
    );
}
