import { Fragment } from "react";
import { useState } from "react";
import config from "../config";
import getGasSettings from "../common/gas";
import { ethers } from "ethers";
import { v1 } from "../common/abi";
import { useRecoilState } from "recoil";
import { standardErrorState } from "../common/error";

import { parseEther } from "@ethersproject/units";

import { useReadProvider, useWalletProvider } from "../common/provider";

import BuyModal from "./BuyModal";
import { useTransactionHelper } from "../common/transaction_status";

export default function BuyButton({
    nftId,
    listingId,
    price,
    maxAmount,
    sellerBalance,
    onUpdate,
}) {
    sellerBalance = sellerBalance || 0;

    const marketplaceAddress = config.contractAddresses.v1.marketplace;
    const marketplaceABI = v1.marketplace;

    const [readProvider, setReadProvider] = useReadProvider();
    const [walletProvider, setWalletProvider] = useWalletProvider();
    const [_, setStandardError] = useRecoilState(standardErrorState);

    const handleTransaction = useTransactionHelper();

    const [buyModalOpen, setBuyModalOpen] = useState(false);

    const buy = async (amount) => {
        if (amount === null) {
            setStandardError("Please enter an amount.");
            return;
        }

        if (!nftId) {
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

        // Convert to wei
        price = parseEther(price);

        const transactionFunction = async () =>
            await contractWithSigner.buyToken(nftId, listingId, amount, {
                value: price.mul(amount),
                ...getGasSettings(),
            });
        const { success } = await handleTransaction(
            transactionFunction,
            `Buy NFTs #${nftId}`,
        );
        if (success && onUpdate) {
            onUpdate(nftId);
        }
    };

    return (
        <Fragment>
            <button
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    sellerBalance === 0
                        ? "bg-ink-700 text-ink-500 cursor-not-allowed"
                        : "bg-accent-cyan text-ink-950 hover:bg-accent-cyan/90"
                }`}
                disabled={sellerBalance === 0}
                onClick={() => setBuyModalOpen(true)}
            >
                Buy
            </button>
            <BuyModal
                isOpen={buyModalOpen}
                setIsOpen={setBuyModalOpen}
                onClose={buy}
                maxAmount={maxAmount}
                sellerBalance={sellerBalance}
                price={price}
            />
        </Fragment>
    );
}
