import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
    rainbowWallet,
    walletConnectWallet,
    metaMaskWallet,
    coinbaseWallet,
    portoWallet,
    trustWallet,
    ledgerWallet,
    phantomWallet,
    zerionWallet,
    okxWallet,
    braveWallet,
    safeWallet,
    frameWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { base, mainnet } from "wagmi/chains";
import { http, createConfig } from "wagmi";
import appConfig from "../config";

// Custom Base chain with optimized fee settings
const baseOptimized = {
    ...base,
    fees: {
        // Base L2 has very low fees - we only need minimal priority fee
        defaultPriorityFee: 10n, // 10 wei
    },
};

const projectId = "3a8170812b534d0ff9d794f19a901d64"; // WalletConnect project ID

const connectors = connectorsForWallets(
    [
        {
            groupName: "Recommended",
            wallets: [
                portoWallet,
                rainbowWallet,
                coinbaseWallet,
                metaMaskWallet,
                walletConnectWallet,
            ],
        },
        {
            groupName: "More Wallets",
            wallets: [
                trustWallet,
                phantomWallet,
                zerionWallet,
                okxWallet,
                braveWallet,
                ledgerWallet,
                safeWallet,
                frameWallet,
            ],
        },
    ],
    {
        appName: "zang.gallery",
        projectId,
    }
);

// Export chains for use elsewhere (ensures consistency)
export const chains = [baseOptimized, mainnet];

export const config = createConfig({
    connectors,
    chains,
    transports: {
        [baseOptimized.id]: http(appConfig.networks.main.rpcUrl),
        [mainnet.id]: http(appConfig.networks.ens.rpcUrl),
    },
    ssr: false,
});
