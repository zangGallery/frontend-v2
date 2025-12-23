import { v1 } from "../common/abi";
import config from "../config";
import getGasSettings from "../common/gas";
import { useRecoilState } from "recoil";
import { standardErrorState } from "../common/error";
import { useAccount, useWriteContract } from "wagmi";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrashAlt } from "@fortawesome/free-solid-svg-icons";
import { useTransactionHelper } from "../common/transaction_status";

export default function DelistButton({
    nftId,
    listingId,
    onUpdate,
    minimal = false,
}) {
    const marketplaceAddress = config.contractAddresses.v1.marketplace;
    const marketplaceABI = v1.marketplace;

    const { isConnected } = useAccount();
    const { writeContractAsync } = useWriteContract();
    const [_, setStandardError] = useRecoilState(standardErrorState);

    const handleTransaction = useTransactionHelper();

    const delist = async () => {
        if (!nftId) {
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
                functionName: "delistToken",
                args: [BigInt(nftId), BigInt(listingId)],
                ...getGasSettings(),
            });

        const { success } = await handleTransaction(
            transactionFunction,
            `Delist NFT #${nftId}`,
        );
        if (success && onUpdate) {
            onUpdate(nftId);
        }
    };

    return (
        <button
            className={
                minimal
                    ? "text-ink-500 hover:text-red-400 transition-colors text-sm"
                    : "px-3 py-1.5 text-sm font-medium rounded-lg bg-ink-700 text-ink-200 hover:bg-ink-600 hover:text-white transition-colors"
            }
            onClick={() => delist()}
            title="Remove listing"
        >
            {minimal ? "Remove" : "Delist"}
        </button>
    );
}
