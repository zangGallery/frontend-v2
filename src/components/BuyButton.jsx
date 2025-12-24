import { Fragment, useState } from "react";
import config from "../config";
import getGasSettings from "../common/gas";
import { parseEther } from "viem";
import { v1 } from "../common/abi";
import { useRecoilState } from "recoil";
import { standardErrorState } from "../common/error";
import { useAccount, useWriteContract } from "wagmi";

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

    const { isConnected } = useAccount();
    const { writeContractAsync } = useWriteContract();
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
        if (!isConnected) {
            setStandardError("Please connect a wallet.");
            return;
        }

        setStandardError(null);

        // Convert price to wei and calculate total value
        const priceWei = parseEther(price);
        const totalValue = priceWei * BigInt(amount);

        const transactionFunction = async () =>
            await writeContractAsync({
                address: marketplaceAddress,
                abi: marketplaceABI,
                functionName: "buyToken",
                args: [BigInt(nftId), BigInt(listingId), BigInt(amount)],
                value: totalValue,
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
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                    sellerBalance === 0
                        ? "text-ink-600 cursor-not-allowed"
                        : "bg-white/10 text-white hover:bg-white/20"
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
