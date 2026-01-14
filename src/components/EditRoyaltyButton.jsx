import { Fragment, useState } from "react";
import { v1 } from "../common/abi";
import config from "../config";
import getGasSettings from "../common/gas";
import Decimal from "decimal.js";
import { useAccount, useWriteContract, useConnections } from "wagmi";

import EditRoyaltyModal from "./EditRoyaltyModal";
import { useTransactionHelper } from "../common/transaction_status";

import { useRecoilState } from "recoil";
import { standardErrorState } from "../common/error";

export default function EditRoyaltyButton({
    id,
    currentRoyaltyPercentage,
    onUpdate,
    minimal = false,
}) {
    const zangAddress = config.contractAddresses.v1.zang;
    const zangABI = v1.zang;

    const { isConnected } = useAccount();
    const { writeContractAsync } = useWriteContract();
    const connections = useConnections();
    const handleTransaction = useTransactionHelper();
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [_, setStandardError] = useRecoilState(standardErrorState);

    if (
        currentRoyaltyPercentage === null ||
        currentRoyaltyPercentage === undefined
    ) {
        return <Fragment></Fragment>;
    }

    const editRoyalty = async (royaltyPercentage) => {
        if (royaltyPercentage === null) {
            setStandardError("Please enter a royalty percentage.");
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

        const effectiveRoyaltyPercentage = new Decimal(royaltyPercentage)
            .mul("100")
            .toNumber();

        if (!id) return;

        const transactionFunction = async () =>
            await writeContractAsync({
                address: zangAddress,
                abi: zangABI,
                functionName: "decreaseRoyaltyNumerator",
                args: [BigInt(id), BigInt(effectiveRoyaltyPercentage)],
                ...getGasSettings(),
            });

        const { success } = await handleTransaction(
            transactionFunction,
            `Edit royalty for NFT #${id}`,
        );
        if (success && onUpdate) {
            onUpdate(id);
        }
    };

    return (
        <Fragment>
            <button
                className={
                    minimal
                        ? "text-ink-500 hover:text-ink-300 transition-colors"
                        : "px-3 py-1.5 text-sm font-medium rounded-lg bg-ink-700 text-ink-200 hover:bg-ink-600 hover:text-white transition-colors"
                }
                onClick={() => setEditModalOpen(true)}
                title="Edit royalty"
            >
                {minimal ? (
                    <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                        />
                    </svg>
                ) : (
                    "Edit Royalty"
                )}
            </button>
            <EditRoyaltyModal
                isOpen={editModalOpen}
                setIsOpen={setEditModalOpen}
                onClose={editRoyalty}
                currentRoyaltyPercentage={currentRoyaltyPercentage}
            />
        </Fragment>
    );
}
