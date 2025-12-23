# zang

[zang](https://zang.gallery) is an onchain text NFT platform on Base.

## Tech Stack

- **Frontend**: React 18 + Vite
- **Wallet**: wagmi v2 + RainbowKit
- **Blockchain**: viem (Base network)
- **Styling**: Tailwind CSS

## Development

### Prerequisites

- Node.js 18+
- npm

### Setup

```bash
git clone https://github.com/zangGallery/frontend
cd frontend
npm install
```

### Environment Variables

Create a `.env` file:

```
VITE_ALCHEMY_BASE_API_KEY=your_alchemy_key
VITE_ALCHEMY_MAINNET_API_KEY=your_alchemy_key
```

### Running Locally

**Development (uses production build + Express server):**

```bash
npm run build
npm start
```

Server runs at http://localhost:3000

### Testing RPC Performance

Run the automated RPC call analysis:

```bash
node scripts/test-rpc.mjs
```

This uses Playwright to load pages and measure RPC calls, identifying any duplicates.

**Manual testing in browser:**

1. Open browser console
2. Run `rpcTracker.enable()` then refresh the page
3. Run `rpcTracker.summary()` to see call counts

## Deployment (Railway)

The app is deployed on Railway. The Express server (`server.cjs`) handles:
- Static file serving from `dist/`
- Server-side rendering of Open Graph tags for social sharing

### Required Environment Variables on Railway

```
VITE_ALCHEMY_BASE_API_KEY=your_alchemy_key    # For client-side RPC
VITE_ALCHEMY_MAINNET_API_KEY=your_alchemy_key # For ENS resolution
ALCHEMY_BASE_API_KEY=your_alchemy_key         # For server-side OG tags (optional, falls back to public RPC)
```

### Deploy Commands (configured in railway.json)

- **Build**: `npm run build`
- **Start**: `node server.cjs`

## Project Structure

```
src/
  common/        # Shared utilities (provider, abi, ens, etc.)
  components/    # React components
  pages/         # Page components (index, nft, mint, vault, etc.)
  styles/        # CSS/Tailwind styles
scripts/
  test-rpc.mjs   # Playwright RPC performance tests
server.cjs       # Express production server
vite.config.js   # Vite configuration
```
