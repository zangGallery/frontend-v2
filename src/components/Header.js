import { hexValue } from "ethers/lib/utils";
import React, { useEffect, useState } from "react";
import { RoutingLink, WalletButton } from ".";
import { useWalletProvider } from "../common/provider";
import config from "../config";

export default function Header() {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [walletProvider] = useWalletProvider();
    const [chainId, setChainId] = useState(null);

    useEffect(() => {
        const setupChain = async () => {
            if (walletProvider) {
                try {
                    window.ethereum.request({
                        method: "wallet_addEthereumChain",
                        params: [
                            {
                                chainId: hexValue(config.networks.main.chainId),
                                rpcUrls: [config.networks.main.rpcUrl],
                                chainName: "Base",
                                nativeCurrency: {
                                    name: "Ethereum",
                                    symbol: "ETH",
                                    decimals: 18,
                                },
                                blockExplorerUrls: [config.blockExplorer.url],
                            },
                        ],
                    });
                } catch (e) {
                    // Chain switch request failed - silent fail
                }

                const network = await walletProvider.getNetwork();
                const newChainId = network.chainId;

                if (chainId !== null && newChainId !== chainId) {
                    window.location.reload();
                }

                setChainId(newChainId);
            }
        };
        setupChain();
    }, [walletProvider, chainId]);

    const navLinks = [
        { href: "/", label: "Home" },
        { href: "/mint", label: "Mint" },
        { href: "/activity", label: "Activity" },
    ];

    if (walletProvider) {
        navLinks.push({ href: "/vault", label: "Vault" });
    }

    return (
        <header className="sticky top-0 z-50 bg-ink-950/80 backdrop-blur-md border-b border-ink-800/50">
            <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center h-16">
                    {/* Logo */}
                    <div className="flex-shrink-0 w-64">
                        <RoutingLink
                            href="/"
                            className="group flex items-center"
                        >
                            <span className="font-mono text-2xl font-bold text-ink-100 group-hover:text-white transition-colors duration-200">
                                .zang{"{"}
                            </span>
                        </RoutingLink>
                    </div>

                    {/* Desktop Navigation - centered */}
                    <div className="hidden md:flex flex-1 items-center justify-center space-x-8">
                        {navLinks.map((link) => (
                            <RoutingLink
                                key={link.href}
                                href={link.href}
                                className="nav-link text-sm font-medium uppercase tracking-wide"
                            >
                                {link.label}
                            </RoutingLink>
                        ))}
                    </div>

                    {/* Wallet Button */}
                    <div className="hidden md:flex flex-shrink-0 justify-end w-64">
                        <WalletButton />
                    </div>

                    {/* Mobile Menu Button */}
                    <button
                        className="md:hidden ml-auto p-2 rounded-lg text-ink-400 hover:text-white hover:bg-ink-800/50 transition-colors"
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        aria-label="Toggle menu"
                        aria-expanded={isMenuOpen}
                    >
                        <svg
                            className="w-6 h-6"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            {isMenuOpen ? (
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M6 18L18 6M6 6l12 12"
                                />
                            ) : (
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M4 6h16M4 12h16M4 18h16"
                                />
                            )}
                        </svg>
                    </button>
                </div>

                {/* Mobile Menu */}
                {isMenuOpen && (
                    <div className="md:hidden py-4 border-t border-ink-800/50 animate-fade-in">
                        <div className="flex flex-col space-y-4">
                            {navLinks.map((link) => (
                                <RoutingLink
                                    key={link.href}
                                    href={link.href}
                                    className="text-ink-300 hover:text-white text-sm font-medium uppercase tracking-wide py-2 transition-colors"
                                    onClick={() => setIsMenuOpen(false)}
                                >
                                    {link.label}
                                </RoutingLink>
                            ))}
                            <div className="pt-4 border-t border-ink-800/50">
                                <WalletButton />
                            </div>
                        </div>
                    </div>
                )}
            </nav>

            {/* Wrong Network Warning */}
            {chainId !== null && chainId !== config.networks.main.chainId && (
                <div className="bg-red-500/10 border-b border-red-500/20 px-4 py-3">
                    <p className="text-center text-red-400 text-sm">
                        Please switch to{" "}
                        <span className="font-semibold">
                            {config.networks.main.name}
                        </span>
                    </p>
                </div>
            )}
        </header>
    );
}
