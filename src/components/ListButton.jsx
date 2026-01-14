import { Fragment, useState } from "react";
import { parseEther } from "viem";
import { v1 } from "../common/abi";
import { ListModal } from ".";
import config from "../config";
import getGasSettings from "../common/gas";
import { useTransactionHelper } from "../common/transaction_status";
import { useAccount, useWriteContract, useConnections } from "wagmi";

import { useRecoilState } from "recoil";
import { standardErrorState } from "../common/error";

export default function ListButton({
    id,
    userBalance,
    userAvailableAmount,
    onUpdate,
    walletAddress,
    fullWidth = false,
    ethPrice = null,
}) {
    const marketplaceAddress = config.contractAddresses.v1.marketplace;
    const marketplaceABI = v1.marketplace;

    const { isConnected } = useAccount();
    const { writeContractAsync } = useWriteContract();
    const connections = useConnections();
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
        if (!isConnected) {
            setStandardError("Please connect a wallet.");
            return;
        }

        setStandardError(null);

        const transactionFunction = async () =>
            await writeContractAsync({
                address: marketplaceAddress,
                abi: marketplaceABI,
                functionName: "listToken",
                args: [BigInt(id), parseEther(price), BigInt(amount)],
                ...getGasSettings(),
            });

        const { success } = await handleTransaction(
            transactionFunction,
            `List NFT #${id}`,
        );
        if (success && onUpdate) {
            onUpdate(id);
        }
    };

    return (
        <Fragment>
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
                ethPrice={ethPrice}
            />
        </Fragment>
    );
}
