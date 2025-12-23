import { Fragment, useState } from "react";
import { useRecoilState } from "recoil";
import { v1 } from "../common/abi";
import config from "../config";
import getGasSettings from "../common/gas";
import { useAccount, useWriteContract } from "wagmi";

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

    const { isConnected } = useAccount();
    const { writeContractAsync } = useWriteContract();

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

        if (!isConnected) {
            setStandardError("Please connect a wallet.");
            return;
        }
        setStandardError(null);

        const transactionFunction = async () =>
            await writeContractAsync({
                address: zangAddress,
                abi: zangABI,
                functionName: "burn",
                args: [walletAddress, BigInt(id), BigInt(amount)],
                ...getGasSettings(),
            });

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
