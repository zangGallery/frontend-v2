import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { base, mainnet } from "wagmi/chains";
import { http } from "wagmi";

const alchemyBaseKey = import.meta.env.VITE_ALCHEMY_BASE_API_KEY;
const alchemyMainnetKey = import.meta.env.VITE_ALCHEMY_MAINNET_API_KEY;

export const config = getDefaultConfig({
    appName: "zang.gallery",
    projectId: "3a8170812b534d0ff9d794f19a901d64", // WalletConnect project ID
    chains: [base, mainnet],
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
