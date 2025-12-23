import { Fragment, useState } from "react";
import { normalize } from "viem/ens";
import { zeroAddress } from "viem";
import { v1 } from "../common/abi";
import config from "../config";
import { mainnetClient, publicClient } from "../common/provider";
import "@uiw/react-md-editor/markdown-editor.css";
import "@uiw/react-markdown-preview/markdown.css";
import Decimal from "decimal.js";
import { useForm } from "react-hook-form";
import { joiResolver } from "@hookform/resolvers/joi";
import { schemas } from "../common";
import getGasSettings from "../common/gas";
import { MintConfirmModal, MultiEditor, RoutingLink } from "../components";
import { Header } from "../components";
import { useAccount, useWriteContract } from "wagmi";

import "../styles/tailwind.css";
import "../styles/globals.css";
import { useTransactionHelper } from "../common/transaction_status";
import { useRecoilState } from "recoil";
import { standardErrorState } from "../common/error";
import StandardErrorDisplay from "../components/StandardErrorDisplay";
import ValidatedInput from "../components/ValidatedInput";
import ViewOnExplorer from "../components/ViewOnExplorer";

const defaultValues = {
    editionSize: 1,
    royaltyPercentage: 10,
    useCustomRecipient: false,
    textType: "text/plain",
};

// Type selector card component
function TypeCard({
    value,
    label,
    icon,
    description,
    selected,
    onClick,
    color,
}) {
    const colorClasses = {
        blue: {
            border: "border-blue-500",
            bg: "bg-blue-500/10",
            icon: "text-blue-400",
        },
        purple: {
            border: "border-purple-500",
            bg: "bg-purple-500/10",
            icon: "text-purple-400",
        },
        amber: {
            border: "border-amber-500",
            bg: "bg-amber-500/10",
            icon: "text-amber-400",
        },
    };

    const colors = colorClasses[color] || colorClasses.blue;

    return (
        <button
            type="button"
            onClick={onClick}
            className={`flex-1 p-4 rounded-xl border-2 transition-all duration-200 text-left ${
                selected
                    ? `${colors.border} ${colors.bg}`
                    : "border-ink-700 bg-ink-900/50 hover:border-ink-500 hover:bg-ink-900"
            }`}
        >
            <div className="flex items-center gap-3 mb-2">
                <span
                    className={`text-2xl ${selected ? colors.icon : "text-ink-500"}`}
                >
                    {icon}
                </span>
                <span
                    className={`font-medium ${selected ? "text-white" : "text-ink-300"}`}
                >
                    {label}
                </span>
            </div>
            <p
                className={`text-sm ${selected ? "text-ink-300" : "text-ink-500"}`}
            >
                {description}
            </p>
        </button>
    );
}

export default function Mint() {
    const {
        register,
        formState: { errors, isValid },
        handleSubmit,
        watch,
        setValue: setFormValue,
    } = useForm({
        defaultValues: defaultValues,
        mode: "onChange",
        resolver: joiResolver(schemas.mint),
    });
    const [text, setText] = useState("");
    const { isConnected, address } = useAccount();
    const { writeContractAsync } = useWriteContract();
    const [transactionState] = useState({ status: "noTransaction" });
    const [confirmModalOpen, setConfirmModalOpen] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const watchUseCustomRecipient = watch(
        "useCustomRecipient",
        defaultValues.useCustomRecipient,
    );
    const watchTextType = watch("textType", defaultValues.textType);
    const handleTransaction = useTransactionHelper();
    const [, setStandardError] = useRecoilState(standardErrorState);

    const zangAddress = config.contractAddresses.v1.zang;

    const executeTransaction = (mintConfirmed) => async (data) => {
        if (!isConnected) {
            setStandardError("Please connect a wallet.");
            return;
        }
        // Add non-React Hook Form fields
        data = { ...data, text };

        if (!(data.title && data.description && data.text) && !mintConfirmed) {
            // Open the confirm modal (if it's not already open)
            if (!confirmModalOpen) {
                setConfirmModalOpen(true);
            }
            return;
        }

        const isUTF8 = () => {
            return [...data.text].some((char) => char.charCodeAt(0) > 127);
        };

        setStandardError(null);

        const uri =
            "data:" +
            data.textType +
            (isUTF8() && data.textType === "text/plain"
                ? ",charset=UTF-8"
                : "") +
            "," +
            encodeURIComponent(data.text);

        const effectiveRoyaltyPercentage = new Decimal(data.royaltyPercentage)
            .mul("100")
            .toNumber();

        let effectiveRoyaltyRecipient = null;

        if (data.useCustomRecipient) {
            effectiveRoyaltyRecipient = data.customRecipient;

            if (effectiveRoyaltyRecipient.includes(".eth")) {
                let resolvedAddress = null;
                try {
                    resolvedAddress = await mainnetClient.getEnsAddress({
                        name: normalize(effectiveRoyaltyRecipient),
                    });
                } catch (e) {
                    setStandardError(
                        'Invalid custom recipient address: "' +
                            e.message +
                            '".',
                    );
                    return;
                }

                if (resolvedAddress) {
                    effectiveRoyaltyRecipient = resolvedAddress;
                } else {
                    setStandardError("Could not resolve ENS name.");
                    return;
                }
            }
        } else {
            effectiveRoyaltyRecipient = address;
        }

        const contentFunction = async (status, transaction, success, receipt) => {
            if (status !== "success") {
                return null;
            }

            if (success && receipt && receipt.blockNumber) {
                // Parse logs to find TransferSingle event
                const transferLog = receipt.logs?.find((log) => {
                    try {
                        // TransferSingle event topic
                        return log.topics[0] === "0xc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f62";
                    } catch {
                        return false;
                    }
                });

                if (transferLog) {
                    // Token ID is in the 4th topic (index 3) for TransferSingle
                    const tokenId = BigInt(transferLog.topics[3]).toString();
                    return (
                        <div className="space-y-2">
                            <p>
                                <RoutingLink
                                    className="text-accent-cyan hover:underline"
                                    href={"/nft?id=" + tokenId}
                                >
                                    NFT #{tokenId}
                                </RoutingLink>{" "}
                                minted successfully!
                            </p>
                            <p>
                                <ViewOnExplorer hash={transaction.hash} />
                            </p>
                        </div>
                    );
                } else {
                    setStandardError(
                        "Could not find token ID in transaction receipt.",
                    );
                    return;
                }
            }
        };

        const transactionFunction = async () =>
            await writeContractAsync({
                address: zangAddress,
                abi: v1.zang,
                functionName: "mint",
                args: [
                    uri,
                    data.title || "",
                    data.description || "",
                    BigInt(data.editionSize),
                    BigInt(effectiveRoyaltyPercentage),
                    effectiveRoyaltyRecipient,
                    0n,
                ],
                ...getGasSettings(),
            });

        handleTransaction(transactionFunction, "Mint", contentFunction);
    };

    const types = [
        {
            value: "text/plain",
            label: "Plain Text",
            icon: "¶",
            description: "Simple text, poetry, prose",
            color: "blue",
        },
        {
            value: "text/markdown",
            label: "Markdown",
            icon: "#",
            description: "Formatted text with styling",
            color: "purple",
        },
        {
            value: "text/html",
            label: "HTML",
            icon: "<Fragment>",
            description: "Rich content with CSS (no scripts)",
            color: "amber",
        },
    ];

    return (
        <div className="min-h-screen bg-ink-950">
            <Header />
            <StandardErrorDisplay />

            <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                {/* Header */}
                <div className="text-center mb-12">
                    <p className="text-ink-500 font-mono text-sm mb-3">
                        $ create new
                    </p>
                    <h1 className="text-3xl sm:text-4xl font-mono text-white mb-4">
                        Mint Your Work
                    </h1>
                    <p className="text-ink-400 max-w-lg mx-auto">
                        Turn your text into a permanent, collectible NFT on
                        Base.
                    </p>
                </div>

                <form
                    onSubmit={handleSubmit(executeTransaction(false))}
                    className="space-y-8"
                >
                    {/* Step 1: Choose Medium */}
                    <section className="space-y-4">
                        <div className="flex items-center gap-3">
                            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-ink-800 text-ink-400 text-sm font-mono">
                                1
                            </span>
                            <h2 className="text-lg font-medium text-ink-200">
                                Choose your medium
                            </h2>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3">
                            {types.map((type) => (
                                <TypeCard
                                    key={type.value}
                                    {...type}
                                    selected={watchTextType === type.value}
                                    onClick={() =>
                                        setFormValue("textType", type.value)
                                    }
                                />
                            ))}
                        </div>
                        <input type="hidden" {...register("textType")} />
                    </section>

                    {/* Step 2: Write Content */}
                    <section className="space-y-4">
                        <div className="flex items-center gap-3">
                            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-ink-800 text-ink-400 text-sm font-mono">
                                2
                            </span>
                            <h2 className="text-lg font-medium text-ink-200">
                                Write your content
                            </h2>
                        </div>
                        <MultiEditor
                            textType={watchTextType}
                            value={text}
                            setValue={setText}
                        />
                    </section>

                    {/* Step 3: Details */}
                    <section className="space-y-4">
                        <div className="flex items-center gap-3">
                            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-ink-800 text-ink-400 text-sm font-mono">
                                3
                            </span>
                            <h2 className="text-lg font-medium text-ink-200">
                                Add details
                            </h2>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div className="sm:col-span-2">
                                <ValidatedInput
                                    label="Title"
                                    name="title"
                                    type="text"
                                    placeholder="Give your work a name"
                                    register={register}
                                    errors={errors}
                                />
                            </div>
                            <div className="sm:col-span-2">
                                <ValidatedInput
                                    label="Description"
                                    name="description"
                                    type="text"
                                    placeholder="What's it about? (optional)"
                                    register={register}
                                    errors={errors}
                                />
                            </div>
                            <ValidatedInput
                                label="Edition Size"
                                name="editionSize"
                                type="number"
                                hint="How many copies to mint"
                                register={register}
                                errors={errors}
                            />
                            <ValidatedInput
                                label="Royalty %"
                                name="royaltyPercentage"
                                type="number"
                                hint="You earn this on secondary sales"
                                register={register}
                                errors={errors}
                            />
                        </div>

                        {/* Advanced Options */}
                        <div className="pt-4">
                            <button
                                type="button"
                                onClick={() => setShowAdvanced(!showAdvanced)}
                                className="flex items-center gap-2 text-sm text-ink-500 hover:text-ink-300 transition-colors"
                            >
                                <svg
                                    className={`w-4 h-4 transition-transform ${showAdvanced ? "rotate-180" : ""}`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M19 9l-7 7-7-7"
                                    />
                                </svg>
                                Advanced options
                            </button>

                            {showAdvanced && (
                                <div className="mt-4 p-4 bg-ink-900/50 rounded-lg border border-ink-800 space-y-4">
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            {...register("useCustomRecipient")}
                                            className="w-4 h-4 rounded border-ink-600 bg-ink-800 text-accent-cyan focus:ring-accent-cyan focus:ring-offset-ink-900"
                                        />
                                        <span className="text-sm text-ink-300">
                                            Use custom royalty recipient
                                        </span>
                                    </label>
                                    {watchUseCustomRecipient && (
                                        <ValidatedInput
                                            label="Recipient Address"
                                            name="customRecipient"
                                            type="text"
                                            placeholder="0x... or ENS name"
                                            register={register}
                                            errors={errors}
                                        />
                                    )}
                                </div>
                            )}
                        </div>
                    </section>

                    {/* Network Notice */}
                    <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                        <svg
                            className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                        </svg>
                        <p className="text-sm text-amber-200/80">
                            This will create a transaction on{" "}
                            <strong className="text-amber-200">
                                {config.networks.main.name}
                            </strong>
                            . Make sure your wallet is connected to the right
                            network.
                        </p>
                    </div>

                    {/* Submit Button */}
                    <div className="pt-4">
                        {isConnected ? (
                            transactionState.status === "noTransaction" ||
                            transactionState.status === "error" ? (
                                <button
                                    type="submit"
                                    disabled={!isValid}
                                    className="w-full py-4 px-6 bg-white text-ink-950 font-medium rounded-lg hover:bg-ink-100 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                                >
                                    <span className="font-mono text-ink-500">
                                        $
                                    </span>
                                    Mint NFT
                                    <svg
                                        className="w-5 h-5"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M13 7l5 5m0 0l-5 5m5-5H6"
                                        />
                                    </svg>
                                </button>
                            ) : null
                        ) : (
                            <div className="text-center p-6 bg-ink-900/50 rounded-lg border border-ink-800">
                                <p className="text-ink-400 mb-4">
                                    Connect your wallet to mint
                                </p>
                                <p className="text-ink-600 text-sm">
                                    Use the button in the header to connect
                                </p>
                            </div>
                        )}
                    </div>
                </form>

                <MintConfirmModal
                    isOpen={confirmModalOpen}
                    setIsOpen={setConfirmModalOpen}
                    onClose={(confirmed) =>
                        handleSubmit(executeTransaction(confirmed))()
                    }
                />
            </div>
        </div>
    );
}

