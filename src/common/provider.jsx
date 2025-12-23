import { createPublicClient, http } from "viem";
import { base, mainnet } from "viem/chains";
import config from "../config";

// RPC call tracking for debugging (disabled by default, enable via console or test script)
const rpcTracker = {
    calls: [],
    enabled: typeof window !== 'undefined' && window.__RPC_TRACKING_ENABLED__ === true,
    enable() {
        this.enabled = true;
        this.calls = [];
        console.log("[RPC] Tracking enabled. Refresh page to capture all calls.");
    },
    disable() {
        this.enabled = false;
        console.log("[RPC] Tracking disabled");
    },
    reset() {
        this.calls = [];
        console.log("[RPC] Counter reset");
    },
    log(method, args) {
        if (!this.enabled) return;
        // Handle BigInt serialization
        const safeArgs = JSON.stringify(args, (_, v) =>
            typeof v === 'bigint' ? v.toString() : v
        );
        const call = {
            id: this.calls.length + 1,
            method,
            args: safeArgs,
            time: new Date().toISOString(),
        };
        this.calls.push(call);
        console.log(`[RPC #${call.id}] ${method}`, args);
    },
    summary() {
        const byMethod = {};
        for (const call of this.calls) {
            const key = `${call.method}(${call.args})`;
            byMethod[key] = (byMethod[key] || 0) + 1;
        }
        console.log("[RPC Summary] Total calls:", this.calls.length);
        console.table(byMethod);
        return { total: this.calls.length, byMethod };
    }
};

// Expose to window for console access
if (typeof window !== 'undefined') {
    window.rpcTracker = rpcTracker;
}

// Base public client (internal)
const _baseClient = createPublicClient({
    chain: base,
    transport: config.api_keys.alchemy_base
        ? http(
              `https://base-mainnet.g.alchemy.com/v2/${config.api_keys.alchemy_base}`,
          )
        : http(),
});

// Wrapped public client with RPC tracking
export const publicClient = new Proxy(_baseClient, {
    get(target, prop) {
        const value = target[prop];
        if (typeof value === 'function') {
            return async (...args) => {
                if (prop === 'readContract') {
                    rpcTracker.log(args[0].functionName, {
                        address: args[0].address?.slice(0, 10),
                        args: args[0].args
                    });
                } else if (prop === 'getContractEvents') {
                    rpcTracker.log('getContractEvents', {
                        address: args[0].address?.slice(0, 10),
                        eventName: args[0].eventName
                    });
                } else if (prop === 'getBlockNumber') {
                    rpcTracker.log('getBlockNumber', {});
                }
                return value.apply(target, args);
            };
        }
        return value;
    }
});

// Public client for Mainnet (ENS resolution)
export const mainnetClient = createPublicClient({
    chain: mainnet,
    transport: config.api_keys.alchemy_mainnet
        ? http(
              `https://eth-mainnet.g.alchemy.com/v2/${config.api_keys.alchemy_mainnet}`,
          )
        : http("https://eth.llamarpc.com"),
});
