import { useState, useEffect } from "react";
import { ethers } from "ethers";
import config from "../config";

// Use JsonRpcProvider for Base network
const defaultReadProvider = new ethers.providers.JsonRpcProvider(
    config.networks.main.rpcUrl,
    {
        chainId: config.networks.main.chainId,
        name: config.networks.main.name.toLowerCase(),
    },
);

let _readProvider = defaultReadProvider;
let _walletProvider = null;
const _readListeners = [];
const _writeListeners = [];

const _useComponentWillUnmount = (action) => {
    useEffect(() => {
        return () => {
            action();
        };
    }, []);
};

const _useForceUpdate = (listeners) => {
    const [, updateState] = useState();
    const [ownListener, setOwnListener] = useState(null);
    useEffect(() => {
        const forceUpdate = () => updateState({});
        setOwnListener(forceUpdate);
        listeners.push(forceUpdate);
    }, []);

    _useComponentWillUnmount(() => {
        const index = listeners.indexOf(ownListener);
        listeners.splice(index, 1);
    });

    return () => {
        for (const listener of listeners) {
            listener();
        }
    };
};

const useReadProvider = () => {
    const update = _useForceUpdate(_readListeners);
    const setReadProvider = (newProvider) => {
        _readProvider = newProvider;
        update();
    };
    return [_readProvider, setReadProvider];
};

const useWalletProvider = () => {
    const update = _useForceUpdate(_writeListeners);

    const setWalletProvider = (newProvider) => {
        _walletProvider = newProvider;
        update();
    };

    return [_walletProvider, setWalletProvider];
};

const restoreDefaultReadProvider = () => {
    _readProvider = defaultReadProvider;
    for (const listener of _readListeners) {
        listener();
    }
};

// ENS provider for mainnet (for ENS resolution)
const ensProvider = config.api_keys.alchemy_mainnet
    ? new ethers.providers.AlchemyProvider(
          config.networks.ens.chainId,
          config.api_keys.alchemy_mainnet,
      )
    : new ethers.providers.JsonRpcProvider(
          "https://eth.llamarpc.com",
          config.networks.ens.chainId,
      );

export {
    defaultReadProvider,
    ensProvider,
    restoreDefaultReadProvider,
    useReadProvider,
    useWalletProvider,
};
