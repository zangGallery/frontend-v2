// Test free Base RPC endpoints against zang.gallery's actual query patterns.
//
// Usage: node scripts/test-base-rpcs.mjs [extra-rpc-url ...]
//
// Tests per endpoint:
//   1. getBlockNumber            — basic health + latency
//   2. readContract uri(1)       — eth_call (NFT metadata reads)
//   3. getLogs over 500k blocks  — server sync catch-up pattern (sync.cjs MAX_BLOCK_RANGE)
//   4. getLogs 5.3M → latest     — frontend history fallback pattern (~40M+ block range)
//
// Event counts are compared across endpoints: a provider returning fewer
// events than the consensus for the same query is silently truncating.

import { createPublicClient, http } from "viem";
import { base } from "viem/chains";

const ZANG_CONTRACT = "0x5541ff300e9b01176b953EA3153006e36D4BA273";
const MARKETPLACE_ADDRESS = "0xbD5C4612084eA90847DeB475529aC74B3521498d";
const FIRST_ZANG_BLOCK = 5300011n;
const FIRST_MARKETPLACE_BLOCK = 5300368n;

const ENDPOINTS = [
    "https://mainnet.base.org",
    "https://base-rpc.publicnode.com",
    "https://base.llamarpc.com",
    "https://base.drpc.org",
    "https://1rpc.io/base",
    "https://base-mainnet.public.blastapi.io",
    "https://base.gateway.tenderly.co",
    "https://base.meowrpc.com",
    "https://base.blockpi.network/v1/rpc/public",
    "https://rpc.ankr.com/base",
    "https://base.lava.build",
    "https://endpoints.omniatech.io/v1/base/mainnet/public",
    "https://api.zan.top/base-mainnet",
    "https://base-pokt.nodies.app",
    ...process.argv.slice(2),
];

const ZANG_ABI = [
    {
        type: "function",
        name: "uri",
        inputs: [{ type: "uint256", name: "tokenId" }],
        outputs: [{ type: "string", name: "" }],
        stateMutability: "view",
    },
];

const ZANG_TRANSFER_ABI = [
    {
        type: "event",
        name: "TransferSingle",
        inputs: [
            { name: "operator", type: "address", indexed: true },
            { name: "from", type: "address", indexed: true },
            { name: "to", type: "address", indexed: true },
            { name: "id", type: "uint256", indexed: false },
            { name: "value", type: "uint256", indexed: false },
        ],
    },
];

const MARKETPLACE_ABI = [
    {
        type: "event",
        name: "TokenPurchased",
        inputs: [
            { name: "_tokenId", type: "uint256", indexed: true },
            { name: "_buyer", type: "address", indexed: true },
            { name: "_seller", type: "address", indexed: true },
            { name: "_listingId", type: "uint256", indexed: false },
            { name: "_amount", type: "uint256", indexed: false },
            { name: "_price", type: "uint256", indexed: false },
        ],
    },
];

function shortError(e) {
    const msg = (e.shortMessage || e.message || String(e)).split("\n")[0];
    return msg.slice(0, 110);
}

async function timed(fn) {
    const start = Date.now();
    try {
        const result = await fn();
        return { ok: true, ms: Date.now() - start, result };
    } catch (e) {
        return { ok: false, ms: Date.now() - start, error: shortError(e) };
    }
}

async function testEndpoint(url) {
    const client = createPublicClient({
        chain: base,
        transport: http(url, { timeout: 60_000, retryCount: 0 }),
    });

    const blockNumber = await timed(() => client.getBlockNumber());

    const ethCall = await timed(() =>
        client.readContract({
            address: ZANG_CONTRACT,
            abi: ZANG_ABI,
            functionName: "uri",
            args: [1n],
        }),
    );

    // Server sync catch-up pattern: 500k block range
    const logs500k = await timed(() =>
        client.getContractEvents({
            address: ZANG_CONTRACT,
            abi: ZANG_TRANSFER_ABI,
            eventName: "TransferSingle",
            fromBlock: FIRST_ZANG_BLOCK,
            toBlock: FIRST_ZANG_BLOCK + 500_000n,
        }),
    );

    // Frontend history fallback pattern: full range to latest
    const logsFull = await timed(() =>
        client.getContractEvents({
            address: MARKETPLACE_ADDRESS,
            abi: MARKETPLACE_ABI,
            eventName: "TokenPurchased",
            fromBlock: FIRST_MARKETPLACE_BLOCK,
        }),
    );

    return { url, blockNumber, ethCall, logs500k, logsFull };
}

function fmt(test, countMode = false) {
    if (!test.ok) return `FAIL ${test.ms}ms (${test.error})`;
    const value = countMode ? `${test.result.length} events` : "";
    return `ok ${test.ms}ms ${value}`.trim();
}

const results = await Promise.all(ENDPOINTS.map(testEndpoint));

console.log("=".repeat(100));
for (const r of results) {
    console.log(`\n${r.url}`);
    console.log(`  blockNumber:        ${fmt(r.blockNumber)}${r.blockNumber.ok ? ` (block ${r.blockNumber.result})` : ""}`);
    console.log(`  eth_call uri(1):    ${fmt(r.ethCall)}`);
    console.log(`  getLogs 500k range: ${fmt(r.logs500k, true)}`);
    console.log(`  getLogs full range: ${fmt(r.logsFull, true)}`);
}

// Consensus check for silent truncation
const counts500k = results.filter((r) => r.logs500k.ok).map((r) => r.logs500k.result.length);
const countsFull = results.filter((r) => r.logsFull.ok).map((r) => r.logsFull.result.length);
const mode = (arr) => {
    const freq = {};
    for (const n of arr) freq[n] = (freq[n] || 0) + 1;
    return Number(Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0]);
};

console.log("\n" + "=".repeat(100));
console.log(`Consensus event counts — 500k range: ${mode(counts500k)}, full range: ${mode(countsFull)}`);
console.log("\nVERDICT (passes all 4 tests with consensus counts):");
for (const r of results) {
    const pass =
        r.blockNumber.ok &&
        r.ethCall.ok &&
        r.logs500k.ok &&
        r.logsFull.ok &&
        r.logs500k.result.length === mode(counts500k) &&
        r.logsFull.result.length === mode(countsFull);
    const truncated =
        r.logs500k.ok && r.logs500k.result.length !== mode(counts500k) ||
        r.logsFull.ok && r.logsFull.result.length !== mode(countsFull);
    console.log(`  ${pass ? "✅" : truncated ? "⚠️ TRUNCATES" : "❌"} ${r.url}`);
}
