import { ethers } from "ethers";

// Base L2 gas settings
// Based on actual network data:
// - baseFeePerGas: ~0.0005 gwei (500000 wei)
// - Many txs confirm with priorityFee as low as 1 wei
// - We use a small buffer for reliability

export const getGasSettings = () => ({
    maxPriorityFeePerGas: 1000, // 1000 wei - minimal but reliable
    maxFeePerGas: ethers.utils.parseUnits("0.001", "gwei"), // 1000000 wei - ~2x base fee headroom
});

export default getGasSettings;
