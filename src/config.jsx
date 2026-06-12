const alchemyBaseKey = import.meta.env.VITE_ALCHEMY_BASE_API_KEY;
const alchemyMainnetKey = import.meta.env.VITE_ALCHEMY_MAINNET_API_KEY;

// RPC resolution: explicit URL > Alchemy key > free public RPC.
// The Base RPC must support eth_getLogs over multi-million block ranges
// (see scripts/test-base-rpcs.mjs for which free endpoints qualify).
const baseRpcUrl =
    import.meta.env.VITE_BASE_RPC_URL ||
    (alchemyBaseKey
        ? `https://base-mainnet.g.alchemy.com/v2/${alchemyBaseKey}`
        : "https://base.gateway.tenderly.co");

const mainnetRpcUrl =
    import.meta.env.VITE_MAINNET_RPC_URL ||
    (alchemyMainnetKey
        ? `https://eth-mainnet.g.alchemy.com/v2/${alchemyMainnetKey}`
        : "https://ethereum-rpc.publicnode.com");

const config = {
    contractAddresses: {
        v1: {
            zang: "0x5541ff300e9b01176b953EA3153006e36D4BA273",
            marketplace: "0xbD5C4612084eA90847DeB475529aC74B3521498d",
        },
    },
    firstBlocks: {
        v1: {
            base: {
                zang: 5300011,
                marketplace: 5300368,
            },
        },
    },
    networks: {
        main: {
            name: "Base",
            chainId: 8453,
            rpcUrl: baseRpcUrl,
        },
        ens: {
            name: "ENS",
            chainId: 1,
            rpcUrl: mainnetRpcUrl,
        },
    },
    ens: {
        cacheExpiration: 1000 * 60 * 2, // 2 minutes
    },
    blockExplorer: {
        name: "BaseScan",
        url: "https://basescan.org",
    },
};

export default config;
