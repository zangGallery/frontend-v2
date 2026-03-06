const { Pool } = require("pg");

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes("railway")
        ? { rejectUnauthorized: false }
        : false,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
});

async function initializeDatabase() {
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS nfts (
                token_id BIGINT PRIMARY KEY,
                uri TEXT NOT NULL,
                author VARCHAR(42) NOT NULL,
                name TEXT,
                description TEXT,
                text_uri TEXT,
                content_type VARCHAR(50),
                content TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_nfts_author ON nfts(author);

            CREATE TABLE IF NOT EXISTS blocks (
                block_number BIGINT PRIMARY KEY,
                timestamp BIGINT NOT NULL,
                created_at TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS events (
                id SERIAL PRIMARY KEY,
                tx_hash VARCHAR(66) NOT NULL,
                log_index INTEGER NOT NULL,
                block_number BIGINT NOT NULL,
                event_type VARCHAR(50) NOT NULL,
                token_id BIGINT NOT NULL,
                data JSONB NOT NULL,
                created_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(tx_hash, log_index)
            );
            CREATE INDEX IF NOT EXISTS idx_events_token_id ON events(token_id);
            CREATE INDEX IF NOT EXISTS idx_events_block ON events(block_number);
            CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);

            CREATE TABLE IF NOT EXISTS sync_status (
                key VARCHAR(50) PRIMARY KEY,
                last_block BIGINT NOT NULL,
                updated_at TIMESTAMP DEFAULT NOW()
            );

            -- Derived data: token stats (computed from events)
            CREATE TABLE IF NOT EXISTS token_stats (
                token_id BIGINT PRIMARY KEY,
                mint_block BIGINT,
                mint_timestamp BIGINT,
                transfer_count INT DEFAULT 0,
                last_sale_price TEXT,
                last_sale_block BIGINT,
                updated_at TIMESTAMP DEFAULT NOW()
            );

            -- Derived data: author profiles
            CREATE TABLE IF NOT EXISTS authors (
                address VARCHAR(42) PRIMARY KEY,
                total_minted INT DEFAULT 0,
                first_mint_block BIGINT,
                first_mint_timestamp BIGINT,
                updated_at TIMESTAMP DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_authors_minted ON authors(total_minted DESC);

            -- Pre-computed home page cache (single row with complete JSON payload)
            CREATE TABLE IF NOT EXISTS home_page_cache (
                id INTEGER PRIMARY KEY DEFAULT 1,
                data JSONB NOT NULL,
                last_nft_id BIGINT NOT NULL,
                updated_at TIMESTAMP DEFAULT NOW()
            );

            -- Pre-computed leaderboards
            CREATE TABLE IF NOT EXISTS leaderboards (
                type VARCHAR(20) PRIMARY KEY,
                data JSONB NOT NULL,
                updated_at TIMESTAMP DEFAULT NOW()
            );

            -- User profiles (custom display names, bio, social links)
            CREATE TABLE IF NOT EXISTS profiles (
                address VARCHAR(42) PRIMARY KEY,
                name VARCHAR(50),
                bio VARCHAR(160),
                x_username VARCHAR(50),
                instagram_username VARCHAR(50),
                base_username VARCHAR(50),
                updated_at TIMESTAMP DEFAULT NOW()
            );

            -- OG image generation tracking
            CREATE TABLE IF NOT EXISTS og_images (
                token_id BIGINT PRIMARY KEY,
                status VARCHAR(20) DEFAULT 'pending',
                file_path TEXT,
                error TEXT,
                created_at TIMESTAMP DEFAULT NOW(),
                generated_at TIMESTAMP
            );

            -- Enhanced index for recent events
            CREATE INDEX IF NOT EXISTS idx_events_recent ON events(block_number DESC, log_index DESC);
            CREATE INDEX IF NOT EXISTS idx_og_status ON og_images(status);

            -- Indexes on JSON fields for fast user lookups (address queries)
            CREATE INDEX IF NOT EXISTS idx_events_to ON events ((LOWER(data->>'to'))) WHERE event_type = 'TransferSingle';
            CREATE INDEX IF NOT EXISTS idx_events_from ON events ((LOWER(data->>'from'))) WHERE event_type = 'TransferSingle';
            CREATE INDEX IF NOT EXISTS idx_events_buyer ON events ((LOWER(data->>'_buyer'))) WHERE event_type = 'TokenPurchased';
            CREATE INDEX IF NOT EXISTS idx_events_seller ON events ((LOWER(data->>'_seller'))) WHERE event_type = 'TokenPurchased';
            CREATE INDEX IF NOT EXISTS idx_events_lister ON events ((LOWER(data->>'_seller'))) WHERE event_type = 'TokenListed';
            CREATE INDEX IF NOT EXISTS idx_events_delister ON events ((LOWER(data->>'_seller'))) WHERE event_type = 'TokenDelisted';
        `);

        // Add new columns to token_stats if they don't exist
        await client.query(`
            DO $$ BEGIN
                ALTER TABLE token_stats ADD COLUMN IF NOT EXISTS total_supply BIGINT;
                ALTER TABLE token_stats ADD COLUMN IF NOT EXISTS floor_price TEXT;
                ALTER TABLE token_stats ADD COLUMN IF NOT EXISTS listed_count INTEGER DEFAULT 0;
                ALTER TABLE token_stats ADD COLUMN IF NOT EXISTS total_volume TEXT DEFAULT '0';
                ALTER TABLE token_stats ADD COLUMN IF NOT EXISTS royalty_recipient VARCHAR(42);
                ALTER TABLE token_stats ADD COLUMN IF NOT EXISTS royalty_bps INTEGER;
            EXCEPTION WHEN others THEN NULL;
            END $$;
        `);
        console.log("Database tables initialized");
    } catch (error) {
        console.error("Failed to initialize database:", error.message);
    } finally {
        client.release();
    }
}

module.exports = { pool, initializeDatabase };
