import { formatEther, zeroAddress } from "viem";
import { atom } from "recoil";
import { publicClient } from "./provider";
import { v1 } from "./abi";
import config from "../config";

const blockToDateState = atom({
    key: "blockToDateState",
    default: {},
});

const zangAddress = config.contractAddresses.v1.zang;
const marketplaceAddress = config.contractAddresses.v1.marketplace;

const getTransferEvents = async (id, relevantAddresses, firstZangBlock) => {
    relevantAddresses = [...relevantAddresses];
    const queriedAddresses = [];
    const foundEvents = [];

    const addAddress = (address) => {
        if (
            !relevantAddresses.includes(address) &&
            !queriedAddresses.includes(address) &&
            address !== zeroAddress
        ) {
            relevantAddresses.push(address);
        }
    };

    const addEvent = (event) => {
        const eventExists = foundEvents.some(
            (e) =>
                e.transactionHash === event.transactionHash &&
                e.logIndex === event.logIndex,
        );
        if (!eventExists) {
            foundEvents.push(event);
        }
    };

    while (relevantAddresses.length > 0) {
        const currentRelevantAddresses = [...relevantAddresses];
        relevantAddresses = [];

        const eventPromises = [];

        for (const address of currentRelevantAddresses) {
            queriedAddresses.push(address);

            if (address === null) {
                // Query all transfers
                eventPromises.push(
                    publicClient.getContractEvents({
                        address: zangAddress,
                        abi: v1.zang,
                        eventName: "TransferSingle",
                        fromBlock: BigInt(firstZangBlock),
                    }),
                );
            } else {
                // Query transfers where address is operator, from, or to
                eventPromises.push(
                    publicClient.getContractEvents({
                        address: zangAddress,
                        abi: v1.zang,
                        eventName: "TransferSingle",
                        args: { operator: address },
                        fromBlock: BigInt(firstZangBlock),
                    }),
                    publicClient.getContractEvents({
                        address: zangAddress,
                        abi: v1.zang,
                        eventName: "TransferSingle",
                        args: { from: address },
                        fromBlock: BigInt(firstZangBlock),
                    }),
                    publicClient.getContractEvents({
                        address: zangAddress,
                        abi: v1.zang,
                        eventName: "TransferSingle",
                        args: { to: address },
                        fromBlock: BigInt(firstZangBlock),
                    }),
                );
            }
        }

        const eventsArrays = await Promise.all(eventPromises);

        for (const events of eventsArrays) {
            for (const event of events) {
                const { from, to, operator, id: nftId } = event.args;

                if (nftId === id || id === null) {
                    addAddress(from);
                    addAddress(to);
                    addAddress(operator);
                    addEvent(event);
                }
            }
        }
    }

    return foundEvents;
};

// Try to fetch events from cached API first, fallback to RPC
const getEventsFromApi = async (id) => {
    try {
        const response = await fetch(`/api/events/${id}`);
        if (response.ok) {
            const { events, _meta } = await response.json();
            // Transform API format to match RPC format
            const transformedEvents = events.map(e => ({
                event: e.event_type,
                blockNumber: BigInt(e.block_number),
                transactionHash: e.tx_hash,
                logIndex: e.log_index,
                args: e.data,
            }));
            return { events: transformedEvents, _meta };
        }
    } catch {
        // Fallback to RPC
    }
    return null;
};

const getEvents = async (
    id,
    authorAddress,
    firstZangBlock,
    firstMarketplaceBlock,
) => {
    // Try API first for single token (much faster)
    if (id !== null) {
        const apiResult = await getEventsFromApi(id);
        if (apiResult && apiResult.events && apiResult.events.length > 0) {
            // Sort and return with metadata
            apiResult.events.sort((a, b) => {
                const aBlock = Number(a.blockNumber);
                const bBlock = Number(b.blockNumber);
                if (aBlock !== bBlock) return aBlock - bBlock;
                return a.logIndex - b.logIndex;
            });
            // Attach metadata to the array for consumers to access
            apiResult.events._meta = apiResult._meta;
            return apiResult.events;
        }
    }

    // Fallback to RPC for uncached data or when fetching all events
    const idArg = id !== null ? { _tokenId: BigInt(id) } : undefined;

    const [tokenListedEvents, tokenDelistedEvents, tokenPurchasedEvents] =
        await Promise.all([
            publicClient.getContractEvents({
                address: marketplaceAddress,
                abi: v1.marketplace,
                eventName: "TokenListed",
                args: idArg,
                fromBlock: BigInt(firstMarketplaceBlock),
            }),
            publicClient.getContractEvents({
                address: marketplaceAddress,
                abi: v1.marketplace,
                eventName: "TokenDelisted",
                args: idArg,
                fromBlock: BigInt(firstMarketplaceBlock),
            }),
            publicClient.getContractEvents({
                address: marketplaceAddress,
                abi: v1.marketplace,
                eventName: "TokenPurchased",
                args: idArg,
                fromBlock: BigInt(firstMarketplaceBlock),
            }),
        ]);

    const relevantAddresses = authorAddress ? [authorAddress] : [];

    const addRelevantAddress = (address) => {
        if (!relevantAddresses.includes(address) && address !== zeroAddress) {
            relevantAddresses.push(address);
        }
    };

    for (const event of tokenDelistedEvents) {
        addRelevantAddress(event.args._seller);
    }
    for (const event of tokenPurchasedEvents) {
        addRelevantAddress(event.args._buyer);
        addRelevantAddress(event.args._seller);
    }

    const transferEvents = await getTransferEvents(
        id !== null ? BigInt(id) : null,
        relevantAddresses,
        firstZangBlock,
    );

    const allEvents = [
        ...tokenListedEvents.map((e) => ({ ...e, event: "TokenListed" })),
        ...tokenDelistedEvents.map((e) => ({ ...e, event: "TokenDelisted" })),
        ...tokenPurchasedEvents.map((e) => ({ ...e, event: "TokenPurchased" })),
        ...transferEvents.map((e) => ({ ...e, event: "TransferSingle" })),
    ];

    allEvents.sort((a, b) => {
        const aElements = [
            Number(a.blockNumber),
            a.transactionIndex,
            a.logIndex,
        ];
        const bElements = [
            Number(b.blockNumber),
            b.transactionIndex,
            b.logIndex,
        ];

        for (let i = 0; i < aElements.length; i++) {
            if (aElements[i] < bElements[i]) return -1;
            if (aElements[i] > bElements[i]) return 1;
        }
        return 0;
    });

    return allEvents;
};

const getAllEvents = async (firstZangBlock, firstMarketplaceBlock) => {
    return await getEvents(null, null, firstZangBlock, firstMarketplaceBlock);
};

const computeBalances = (events) => {
    if (!events) return;

    const balances = {};

    const updateBalance = (address, variation) => {
        if (address === zeroAddress) return;
        if (balances[address] === undefined) balances[address] = 0;
        balances[address] += variation;
    };

    for (const event of events) {
        if (event.event === "TransferSingle") {
            const { from, to, value } = event.args;
            updateBalance(from, -Number(value));
            updateBalance(to, Number(value));
        }
    }

    return Object.fromEntries(
        Object.keys(balances)
            .filter((address) => balances[address] !== 0)
            .map((address) => [address, balances[address]]),
    );
};

const parseHistory = (events) => {
    if (!events) return;

    let parsedEvents = [];

    for (const event of events) {
        switch (event.event) {
            case "TokenListed":
                parsedEvents.push({
                    id: Number(event.args._tokenId),
                    type: "list",
                    seller: event.args._seller,
                    price: formatEther(event.args._price),
                    amount: Number(event.args.amount),
                    transactionHash: event.transactionHash,
                    blockNumber: Number(event.blockNumber),
                });
                break;
            case "TokenDelisted":
                parsedEvents.push({
                    id: Number(event.args._tokenId),
                    type: "delist",
                    seller: event.args._seller,
                    transactionHash: event.transactionHash,
                    blockNumber: Number(event.blockNumber),
                });
                break;
            case "TransferSingle": {
                let transferType = "transfer";
                if (event.args.from === zeroAddress) {
                    transferType = "mint";
                } else if (event.args.to === zeroAddress) {
                    transferType = "burn";
                }
                parsedEvents.push({
                    id: Number(event.args.id),
                    type: transferType,
                    from: event.args.from,
                    to: event.args.to,
                    amount: Number(event.args.value),
                    operator: event.args.operator,
                    transactionHash: event.transactionHash,
                    blockNumber: Number(event.blockNumber),
                });
                break;
            }
            case "TokenPurchased":
                parsedEvents.push({
                    id: Number(event.args._tokenId),
                    type: "purchase",
                    buyer: event.args._buyer,
                    seller: event.args._seller,
                    amount: Number(event.args._amount),
                    price: formatEther(event.args._price),
                    transactionHash: event.transactionHash,
                    blockNumber: Number(event.blockNumber),
                });
                break;
            default:
                break;
        }
    }

    // Filter out transfer and delist events that are part of purchases
    for (const event of parsedEvents.filter((e) => e.type === "purchase")) {
        parsedEvents = parsedEvents.filter(
            (otherEvent) =>
                !(
                    (otherEvent.type === "transfer" ||
                        otherEvent.type === "delist") &&
                    event.transactionHash === otherEvent.transactionHash
                ),
        );
    }

    return parsedEvents;
};

// In-memory cache for block timestamps to avoid duplicate fetches
const blockTimeCache = new Map();
const pendingBlockRequests = new Map();

const getBlockTime = async (blockNumber) => {
    // Check memory cache first
    if (blockTimeCache.has(blockNumber)) {
        return blockTimeCache.get(blockNumber);
    }

    // If there's already a pending request for this block, wait for it
    if (pendingBlockRequests.has(blockNumber)) {
        return pendingBlockRequests.get(blockNumber);
    }

    // Create the promise and store it
    const fetchPromise = (async () => {
        // Try API first (cached), fallback to RPC
        try {
            const response = await fetch(`/api/block/${blockNumber}`);
            if (response.ok) {
                const data = await response.json();
                const date = new Date(data.timestamp * 1000);
                blockTimeCache.set(blockNumber, date);
                return date;
            }
        } catch {
            // Fallback to RPC
        }

        const block = await publicClient.getBlock({
            blockNumber: BigInt(blockNumber),
        });
        const date = new Date(Number(block.timestamp) * 1000);
        blockTimeCache.set(blockNumber, date);
        return date;
    })();

    pendingBlockRequests.set(blockNumber, fetchPromise);

    try {
        const result = await fetchPromise;
        return result;
    } finally {
        pendingBlockRequests.delete(blockNumber);
    }
};

export {
    blockToDateState,
    getBlockTime,
    getEvents,
    getAllEvents,
    computeBalances,
    parseHistory,
};
