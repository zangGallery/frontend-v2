import { useEffect } from "react";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { base } from "wagmi/chains";
import TransactionNotifications from "./components/TransactionNotifications";

function ChainSwitcher() {
    const { isConnected } = useAccount();
    const chainId = useChainId();
    const { switchChain } = useSwitchChain();

    useEffect(() => {
        if (isConnected && chainId !== base.id) {
            switchChain?.({ chainId: base.id });
        }
    }, [isConnected, chainId, switchChain]);

    return null;
}

export default function Wrapper({ children, props }) {
    return (
        <div className="min-h-screen flex flex-col bg-ink-950">
            {/* Auto-switch to Base chain */}
            <ChainSwitcher />

            {/* Main Content */}
            <main className="flex-1">{children}</main>

            {/* Transaction Notifications */}
            <TransactionNotifications />

            {/* Footer */}
            <footer className="bg-ink-900/50 border-t border-ink-800/50 mt-auto">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {/* Brand Column */}
                        <div className="space-y-4">
                            <span className="font-mono text-xl font-bold text-ink-100">
                                .zang{"{"}
                            </span>
                            <p className="text-ink-400 text-sm">
                                Text-based NFTs on Base.
                                <br />
                                By artists, for artists.
                            </p>
                            <p className="text-ink-500 text-xs">
                                Platform fee: 5%
                            </p>
                        </div>

                        {/* Contact Column */}
                        <div className="space-y-4">
                            <h4 className="text-ink-300 font-medium text-sm uppercase tracking-wide">
                                Contact
                            </h4>
                            <a
                                href="mailto:team@zang.gallery"
                                className="block text-ink-400 hover:text-accent-cyan transition-colors text-sm"
                            >
                                team@zang.gallery
                            </a>
                        </div>

                        {/* Social Column */}
                        <div className="space-y-4">
                            <h4 className="text-ink-300 font-medium text-sm uppercase tracking-wide">
                                Community
                            </h4>
                            <div className="flex flex-col space-y-2">
                                <a
                                    href="https://twitter.com/zanggallery"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-ink-400 hover:text-accent-cyan transition-colors text-sm inline-flex items-center gap-2"
                                >
                                    <svg
                                        className="w-4 h-4"
                                        fill="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                                    </svg>
                                    Twitter
                                </a>
                                <a
                                    href="https://github.com/zanggallery"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-ink-400 hover:text-accent-cyan transition-colors text-sm inline-flex items-center gap-2"
                                >
                                    <svg
                                        className="w-4 h-4"
                                        fill="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            fillRule="evenodd"
                                            clipRule="evenodd"
                                            d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                                        />
                                    </svg>
                                    GitHub
                                </a>
                                <a
                                    href="https://discord.gg/jnpCz9R3gf"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-ink-400 hover:text-accent-cyan transition-colors text-sm inline-flex items-center gap-2"
                                >
                                    <svg
                                        className="w-4 h-4"
                                        fill="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z" />
                                    </svg>
                                    Discord
                                </a>
                            </div>
                        </div>
                    </div>

                    {/* Copyright */}
                    <div className="mt-8 pt-8 border-t border-ink-800/50">
                        <p className="text-ink-500 text-xs text-center">
                            Built on Base
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    );
}
