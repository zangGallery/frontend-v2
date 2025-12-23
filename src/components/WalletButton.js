import React from "react";
import { ethers } from "ethers";
import Web3Modal from "web3modal";
import WalletConnectProvider from "@walletconnect/web3-provider";
import {
    ensProvider,
    restoreDefaultReadProvider,
    useReadProvider,
    useWalletProvider,
} from "../common/provider";
import config from "../config";
import ethProvider from "eth-provider";
import { RoutingLink } from ".";
import { atom, useRecoilState } from "recoil";
import { formatError, standardErrorState } from "../common/error";

const ensAddressState = atom({
    key: "ensAddress",
    default: null,
});

const ensAvatarState = atom({
    key: "ensAvatar",
    default: null,
});

const walletBalanceState = atom({
    key: "walletBalance",
    default: null,
});

const chainIdState = atom({
    key: "chainId",
    default: null,
});

const walletAddressState = atom({
    key: "walletAddress",
    default: null,
});

const truncateAddress = (address) => {
    if (!address) return "";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

export default function WalletButton() {
    const [readProvider, setReadProvider] = useReadProvider();
    const [walletProvider, setWalletProvider] = useWalletProvider();
    const [ensAddress, setEnsAddress] = useRecoilState(ensAddressState);
    const [ensAvatar, setEnsAvatar] = useRecoilState(ensAvatarState);
    const [balance, setBalance] = useRecoilState(walletBalanceState);
    const [, setStandardError] = useRecoilState(standardErrorState);
    const [chainId, setChainId] = useRecoilState(chainIdState);
    const [walletAddress, setWalletAddress] =
        useRecoilState(walletAddressState);

    const providerOptions = {
        walletconnect: {
            package: WalletConnectProvider,
            options: {
                rpc: {
                    8453: "https://mainnet.base.org",
                },
                network: "base",
            },
        },
        frame: {
            package: ethProvider,
        },
    };

    const connectWallet = async () => {
        const web3Modal = new Web3Modal({
            network: config.networks.main.chainId,
            cacheProvider: false,
            providerOptions,
            disableInjectedProvider: false,
        });
        web3Modal.clearCachedProvider();

        let wallet;

        try {
            wallet = await web3Modal.connect();
        } catch (e) {
            if (e?.message) {
                setStandardError(formatError(e));
            } else {
                console.log(e);
            }
            return;
        }

        setStandardError(null);

        delete wallet._events.accountsChanged;
        delete wallet._events.chainChanged;
        delete wallet._events.disconnect;
        delete wallet._events.network;
        wallet._eventsCount = 1;

        const handleDisconnect = () => {
            setWalletProvider(null);
            restoreDefaultReadProvider();
        };

        const handleChange = async () => {
            if (wallet.selectedAddress) {
                const regeneratedProvider = new ethers.providers.Web3Provider(
                    wallet,
                );
                setReadProvider(regeneratedProvider);
                setWalletProvider(regeneratedProvider);
            } else {
                handleDisconnect();
            }
        };

        wallet.on("disconnect", handleDisconnect);
        wallet.on("accountsChanged", handleChange);
        wallet.on("chainChanged", handleChange);

        wallet.on("network", (newNetwork, oldNetwork) => {
            if (oldNetwork) {
                window.location.reload();
            }
        });

        const newProvider = new ethers.providers.Web3Provider(wallet);
        setReadProvider(newProvider);
        setWalletProvider(newProvider);
        const network = await newProvider.getNetwork();
        setChainId(network?.chainId);

        try {
            const address = await newProvider.getSigner().getAddress();
            setWalletAddress(address);
            newProvider.getBalance(address).then((balance) => {
                const balanceFormatted = ethers.utils.formatEther(balance);
                setBalance(balanceFormatted);
            });
            const _ensAddress = await ensProvider.lookupAddress(address);
            setEnsAddress(_ensAddress);

            if (_ensAddress) {
                const _ensAvatar = await ensProvider.getAvatar(_ensAddress);
                setEnsAvatar(_ensAvatar);
            }
        } catch (e) {
            console.log(e);
        }
    };

    return (
        <div className="flex flex-col items-end gap-1">
            <div className="flex items-center bg-ink-800/50 rounded-lg border border-ink-700/50 overflow-hidden">
                {/* Balance Display */}
                {balance && chainId === config.networks.main.chainId && (
                    <div className="px-3 py-2 flex items-center gap-2 text-ink-300 text-sm border-r border-ink-700/50">
                        <span className="font-mono">
                            {parseFloat(balance).toFixed(4)} ETH
                        </span>
                    </div>
                )}

                {/* Connect Button */}
                <button
                    onClick={connectWallet}
                    className="px-4 py-2 flex items-center gap-2 text-sm font-medium text-ink-100 hover:bg-ink-700/50 transition-colors"
                >
                    {walletProvider ? (
                        <>
                            {ensAvatar && (
                                <img
                                    className="w-5 h-5 rounded-full object-cover"
                                    src={ensAvatar}
                                    alt=""
                                />
                            )}
                            <span className="font-mono text-xs">
                                {ensAddress || truncateAddress(walletAddress)}
                            </span>
                        </>
                    ) : (
                        <>
                            <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
                                />
                            </svg>
                            <span>Connect</span>
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}
