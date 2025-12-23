import { ConnectButton } from "@rainbow-me/rainbowkit";
import config from "../config";

export default function WalletButton() {
    return (
        <ConnectButton.Custom>
            {({
                account,
                chain,
                openAccountModal,
                openChainModal,
                openConnectModal,
                mounted,
            }) => {
                const ready = mounted;
                const connected = ready && account && chain;

                return (
                    <div
                        {...(!ready && {
                            "aria-hidden": true,
                            style: {
                                opacity: 0,
                                pointerEvents: "none",
                                userSelect: "none",
                            },
                        })}
                    >
                        {(() => {
                            if (!connected) {
                                return (
                                    <button
                                        onClick={openConnectModal}
                                        className="px-4 py-2 flex items-center gap-2 text-sm font-medium text-ink-100 bg-ink-800/50 rounded-lg border border-ink-700/50 hover:bg-ink-700/50 transition-colors"
                                    >
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
                                    </button>
                                );
                            }

                            if (chain.unsupported) {
                                return (
                                    <button
                                        onClick={openChainModal}
                                        className="px-4 py-2 flex items-center gap-2 text-sm font-medium text-red-400 bg-red-900/20 rounded-lg border border-red-700/50 hover:bg-red-900/30 transition-colors"
                                    >
                                        Wrong network
                                    </button>
                                );
                            }

                            return (
                                <div className="flex items-center bg-ink-800/50 rounded-lg border border-ink-700/50 overflow-hidden">
                                    {/* Balance Display */}
                                    {account.displayBalance &&
                                        chain.id ===
                                            config.networks.main.chainId && (
                                            <div className="px-3 py-2 flex items-center gap-2 text-ink-300 text-sm border-r border-ink-700/50">
                                                <span className="font-mono">
                                                    {account.displayBalance}
                                                </span>
                                            </div>
                                        )}

                                    {/* Account Button */}
                                    <button
                                        onClick={openAccountModal}
                                        className="px-4 py-2 flex items-center gap-2 text-sm font-medium text-ink-100 hover:bg-ink-700/50 transition-colors"
                                    >
                                        {account.ensAvatar && (
                                            <img
                                                className="w-5 h-5 rounded-full object-cover"
                                                src={account.ensAvatar}
                                                alt=""
                                            />
                                        )}
                                        <span className="font-mono text-xs">
                                            {account.ensName ||
                                                account.displayName}
                                        </span>
                                    </button>
                                </div>
                            );
                        })()}
                    </div>
                );
            }}
        </ConnectButton.Custom>
    );
}
