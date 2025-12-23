import { parseGwei } from "viem";

// Base L2 gas settings
// Based on actual network data:
// - baseFeePerGas: ~0.0005 gwei (500000 wei)
// - Many txs confirm with priorityFee as low as 1 wei
// - We use a small buffer for reliability

export const getGasSettings = () => ({
    maxPriorityFeePerGas: 10n, // 10 wei - minimal tip for Base L2
    maxFeePerGas: parseGwei("0.001"), // 1000000 wei - ~2x base fee headroom
});

export default getGasSettings;
