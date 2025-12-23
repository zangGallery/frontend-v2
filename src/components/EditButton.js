import { Fragment } from "react";
import { useState } from "react";
import config from "../config";
import getGasSettings from "../common/gas";
import { ethers } from "ethers";
import { v1 } from "../common/abi";

import { parseEther } from "@ethersproject/units";

import { useWalletProvider } from "../common/provider";

import EditModal from "./EditModal";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEdit as editIcon } from "@fortawesome/free-solid-svg-icons";
import { useTransactionHelper } from "../common/transaction_status";

import { useRecoilState } from "recoil";
import { standardErrorState } from "../common/error";

export default function EditButton({
    nftId,
    listingId,
    availableAmount,
    balance,
    onUpdate,
    oldAmount,
    minimal = false,
}) {
    const marketplaceAddress = config.contractAddresses.v1.marketplace;
    const marketplaceABI = v1.marketplace;

    const [walletProvider, setWalletProvider] = useWalletProvider();

    const handleTransaction = useTransactionHelper();

    const [buyModalOpen, setBuyModalOpen] = useState(false);
    const [_, setStandardError] = useRecoilState(standardErrorState);

    const edit = async (newAmount, newPrice) => {
        if (newAmount === null && newPrice === null) {
            setStandardError("Please enter an amount or a price.");
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
        let transactionFunction = null;

        if (newAmount === null && newPrice !== null) {
            // Replacing only price
            transactionFunction = async () =>
                contractWithSigner.editListingPrice(
                    nftId,
                    listingId,
                    parseEther(newPrice).toString(),
                    getGasSettings(),
                );
        } else if (newAmount !== null && newPrice === null) {
            // Replacing only amount
            transactionFunction = async () =>
                contractWithSigner.editListingAmount(
                    nftId,
                    listingId,
                    newAmount,
                    oldAmount,
                    getGasSettings(),
                );
        } else if (newAmount !== null && newPrice !== null) {
            // Replacing both
            transactionFunction = async () =>
                await contractWithSigner.editListing(
                    nftId,
                    listingId,
                    parseEther(newPrice).toString(),
                    newAmount,
                    oldAmount,
                    getGasSettings(),
                );
        }

        const { success } = await handleTransaction(
            transactionFunction,
            `Edit listing for NFT #${nftId}`,
        );
        if (success && onUpdate) {
            onUpdate(nftId);
        }
    };

    return (
        <Fragment>
            <button
                className={
                    minimal
                        ? "text-ink-500 hover:text-ink-300 transition-colors text-sm"
                        : "px-3 py-1.5 text-sm font-medium rounded-lg bg-ink-700 text-ink-200 hover:bg-ink-600 hover:text-white transition-colors"
                }
                onClick={() => setBuyModalOpen(true)}
                title="Edit listing"
            >
                {minimal ? "Edit" : "Edit"}
            </button>
            <EditModal
                isOpen={buyModalOpen}
                setIsOpen={setBuyModalOpen}
                onClose={edit}
                balance={balance}
                availableAmount={availableAmount}
                oldAmount={oldAmount}
            />
        </Fragment>
    );
}
