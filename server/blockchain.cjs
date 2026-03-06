const { createPublicClient, http: viemHttp } = require("viem");
const { base } = require("viem/chains");
const { pool } = require("./db.cjs");

// Contract addresses
const ZANG_CONTRACT = "0x5541ff300e9b01176b953EA3153006e36D4BA273";
const MARKETPLACE_ADDRESS = "0xbD5C4612084eA90847DeB475529aC74B3521498d";
const FIRST_ZANG_BLOCK = 5300011;

// RPC setup
const ALCHEMY_KEY =
    process.env.ALCHEMY_BASE_API_KEY || process.env.VITE_ALCHEMY_BASE_API_KEY;
const BASE_RPC = ALCHEMY_KEY
    ? `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`
    : "https://mainnet.base.org";
const SITE_URL = process.env.SITE_URL || "https://www.zang.gallery";

const publicClient = createPublicClient({
    chain: base,
    transport: viemHttp(BASE_RPC),
});

// ABIs
const ZANG_ABI = [
    {
        type: "function",
        name: "uri",
        inputs: [{ type: "uint256", name: "tokenId" }],
        outputs: [{ type: "string", name: "" }],
        stateMutability: "view",
    },
    {
        type: "function",
        name: "authorOf",
        inputs: [{ type: "uint256", name: "_tokenId" }],
        outputs: [{ type: "address", name: "" }],
        stateMutability: "view",
    },
];

const MARKETPLACE_ABI = [
    {
        type: "event",
        name: "TokenListed",
        inputs: [
            { name: "_tokenId", type: "uint256", indexed: true },
            { name: "_seller", type: "address", indexed: true },
            { name: "_listingId", type: "uint256", indexed: false },
            { name: "amount", type: "uint256", indexed: false },
            { name: "_price", type: "uint256", indexed: false },
        ],
    },
    {
        type: "event",
        name: "TokenDelisted",
        inputs: [
            { name: "_tokenId", type: "uint256", indexed: true },
            { name: "_seller", type: "address", indexed: true },
            { name: "_listingId", type: "uint256", indexed: false },
        ],
    },
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

const MARKETPLACE_READ_ABI = [
    {
        type: "function",
        name: "listingCount",
        inputs: [{ name: "_tokenId", type: "uint256" }],
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
    },
    {
        type: "function",
        name: "listings",
        inputs: [
            { name: "_tokenId", type: "uint256" },
            { name: "_index", type: "uint256" },
        ],
        outputs: [
            { name: "price", type: "uint256" },
            { name: "seller", type: "address" },
            { name: "amount", type: "uint256" },
        ],
        stateMutability: "view",
    },
];

const ZANG_READ_ABI = [
    {
        type: "function",
        name: "totalSupply",
        inputs: [{ name: "_tokenId", type: "uint256" }],
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
    },
    {
        type: "function",
        name: "royaltyInfo",
        inputs: [
            { name: "_tokenId", type: "uint256" },
            { name: "_salePrice", type: "uint256" },
        ],
        outputs: [
            { name: "", type: "address" },
            { name: "", type: "uint256" },
        ],
        stateMutability: "view",
    },
];

// Helper functions
function isValidAddress(address) {
    return (
        typeof address === "string" &&
        address.length === 42 &&
        address.startsWith("0x") &&
        /^0x[a-fA-F0-9]{40}$/.test(address)
    );
}

function validateNftData(data) {
    const errors = [];
    if (!isValidAddress(data.author)) {
        errors.push(`Invalid author address: ${data.author}`);
    }
    if (!data.uri || typeof data.uri !== "string") {
        errors.push("Missing or invalid URI");
    }
    if (data.content && data.content.length > 10 * 1024 * 1024) {
        errors.push("Content exceeds 10MB limit");
    }
    return errors;
}

async function fetchNFTMetadata(tokenId) {
    try {
        const uri = await publicClient.readContract({
            address: ZANG_CONTRACT,
            abi: ZANG_ABI,
            functionName: "uri",
            args: [BigInt(tokenId)],
        });

        let metadata;
        if (uri.startsWith("data:")) {
            const commaIndex = uri.indexOf(",");
            const header = uri.substring(0, commaIndex);
            const data = uri.substring(commaIndex + 1);

            if (header.includes("base64")) {
                metadata = JSON.parse(Buffer.from(data, "base64").toString());
            } else {
                metadata = JSON.parse(decodeURIComponent(data));
            }
        } else {
            const response = await fetch(uri);
            metadata = await response.json();
        }

        return metadata;
    } catch (error) {
        console.error(`Failed to fetch NFT ${tokenId}:`, error.message);
        return null;
    }
}

async function fetchNFTContent(textUri) {
    try {
        if (!textUri) return { content: null, contentType: null };

        if (textUri.startsWith("data:")) {
            const commaIndex = textUri.indexOf(",");
            const header = textUri.substring(0, commaIndex);
            const data = textUri.substring(commaIndex + 1);
            const contentType = header.split(";")[0].replace("data:", "");

            let content;
            if (header.includes("base64")) {
                content = Buffer.from(data, "base64").toString("utf-8");
            } else {
                content = decodeURIComponent(
                    data.replace("charset=UTF-8,", ""),
                );
            }

            return { content, contentType };
        }

        const response = await fetch(textUri);
        const content = await response.text();
        const contentType =
            response.headers.get("content-type")?.split(";")[0] || "text/plain";

        return { content, contentType };
    } catch (error) {
        console.error("Failed to fetch NFT content:", error.message);
        return { content: null, contentType: null };
    }
}

async function getNFTData(tokenId) {
    const cached = await pool.query("SELECT * FROM nfts WHERE token_id = $1", [
        tokenId,
    ]);

    if (cached.rows.length > 0 && cached.rows[0].content !== null) {
        return cached.rows[0];
    }

    if (cached.rows.length > 0) {
        await pool.query("DELETE FROM nfts WHERE token_id = $1", [tokenId]);
    }

    try {
        const [uri, author] = await Promise.all([
            publicClient.readContract({
                address: ZANG_CONTRACT,
                abi: ZANG_ABI,
                functionName: "uri",
                args: [BigInt(tokenId)],
            }),
            publicClient.readContract({
                address: ZANG_CONTRACT,
                abi: ZANG_ABI,
                functionName: "authorOf",
                args: [BigInt(tokenId)],
            }),
        ]);

        const metadata = await fetchNFTMetadata(tokenId);
        const textUri = metadata?.text_uri;
        const { content, contentType } = await fetchNFTContent(textUri);

        const validationErrors = validateNftData({ uri, author, content });
        if (validationErrors.length > 0) {
            console.error(
                `NFT ${tokenId} validation failed:`,
                validationErrors.join(", "),
            );
            throw new Error(
                `Validation failed: ${validationErrors.join(", ")}`,
            );
        }

        if (content === null) {
            return {
                token_id: tokenId.toString(),
                uri,
                author,
                name: metadata?.name || null,
                description: metadata?.description || null,
                text_uri: textUri || null,
                content_type: contentType,
                content: null,
            };
        }

        const result = await pool.query(
            `INSERT INTO nfts (token_id, uri, author, name, description, text_uri, content_type, content)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (token_id) DO UPDATE SET
                uri = EXCLUDED.uri,
                author = EXCLUDED.author,
                name = EXCLUDED.name,
                description = EXCLUDED.description,
                text_uri = EXCLUDED.text_uri,
                content_type = EXCLUDED.content_type,
                content = EXCLUDED.content
             RETURNING *`,
            [
                tokenId,
                uri,
                author,
                metadata?.name || null,
                metadata?.description || null,
                textUri || null,
                contentType,
                content,
            ],
        );

        return result.rows[0];
    } catch (error) {
        if (
            error.message?.includes("does not exist") ||
            error.message?.includes("reverted")
        ) {
            throw new Error(`Token ${tokenId} does not exist`);
        }
        throw error;
    }
}

async function getBlockTimestamp(blockNumber) {
    const cached = await pool.query(
        "SELECT timestamp FROM blocks WHERE block_number = $1",
        [blockNumber],
    );

    if (cached.rows.length > 0) {
        return cached.rows[0].timestamp;
    }

    try {
        const block = await publicClient.getBlock({
            blockNumber: BigInt(blockNumber),
        });
        const timestamp = Number(block.timestamp);

        await pool.query(
            `INSERT INTO blocks (block_number, timestamp)
             VALUES ($1, $2)
             ON CONFLICT (block_number) DO NOTHING`,
            [blockNumber, timestamp],
        );

        return timestamp;
    } catch (error) {
        console.error(`Failed to fetch block ${blockNumber}:`, error.message);
        throw error;
    }
}

module.exports = {
    publicClient,
    ZANG_CONTRACT,
    MARKETPLACE_ADDRESS,
    FIRST_ZANG_BLOCK,
    SITE_URL,
    ZANG_ABI,
    MARKETPLACE_ABI,
    ZANG_TRANSFER_ABI,
    MARKETPLACE_READ_ABI,
    ZANG_READ_ABI,
    fetchNFTMetadata,
    fetchNFTContent,
    getNFTData,
    getBlockTimestamp,
    isValidAddress,
};
