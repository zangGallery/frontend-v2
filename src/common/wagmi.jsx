import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
    rainbowWallet,
    walletConnectWallet,
    metaMaskWallet,
    coinbaseWallet,
    portoWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { base, mainnet } from "wagmi/chains";
import { http, createConfig } from "wagmi";

// Custom Base chain with optimized fee settings
const baseOptimized = {
    ...base,
    fees: {
        // Base L2 has very low fees - we only need minimal priority fee
        defaultPriorityFee: 10n, // 10 wei
    },
};

const alchemyBaseKey = import.meta.env.VITE_ALCHEMY_BASE_API_KEY;
const alchemyMainnetKey = import.meta.env.VITE_ALCHEMY_MAINNET_API_KEY;

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
    ],
    {
        appName: "zang.gallery",
        projectId,
    }
);

export const config = createConfig({
    connectors,
    chains: [baseOptimized, mainnet],
    transports: {
        [base.id]: alchemyBaseKey
            ? http(`https://base-mainnet.g.alchemy.com/v2/${alchemyBaseKey}`)
            : http(),
        [mainnet.id]: alchemyMainnetKey
            ? http(
                  `https://eth-mainnet.g.alchemy.com/v2/${alchemyMainnetKey}`,
              )
            : http(),
    },
    ssr: false,
});
