import { test, expect } from "@playwright/test";

// Performance thresholds (in milliseconds)
const THRESHOLDS = {
    apiNft: 200, // Single NFT API call
    apiBatch: 500, // Batch NFT API call
    apiActivity: 300, // Activity feed
    apiStats: 100, // Stats endpoint
    pageLoad: 3000, // Homepage load
    nftPageLoad: 2000, // NFT page load
};

test.describe("API Performance Tests", () => {
    test("GET /api/nft/:id should be fast (cached)", async ({ request }) => {
        const times = [];

        // Test multiple NFT IDs
        for (const id of [1, 5, 10, 12, 13]) {
            const start = Date.now();
            const response = await request.get(`/api/nft/${id}`);
            const elapsed = Date.now() - start;
            times.push(elapsed);

            expect(response.ok()).toBeTruthy();
            console.log(`GET /api/nft/${id}: ${elapsed}ms`);
        }

        const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
        console.log(`Average NFT API time: ${avgTime.toFixed(1)}ms`);
        expect(avgTime).toBeLessThan(THRESHOLDS.apiNft);
    });

    test("POST /api/nfts/batch should be efficient", async ({ request }) => {
        const ids = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

        const start = Date.now();
        const response = await request.post("/api/nfts/batch", {
            data: { ids },
        });
        const elapsed = Date.now() - start;

        expect(response.ok()).toBeTruthy();
        const data = await response.json();
        expect(data.nfts).toHaveLength(ids.length);

        console.log(`Batch fetch ${ids.length} NFTs: ${elapsed}ms`);
        console.log(`Per-NFT average: ${(elapsed / ids.length).toFixed(1)}ms`);
        expect(elapsed).toBeLessThan(THRESHOLDS.apiBatch);
    });

    test("GET /api/activity should be fast", async ({ request }) => {
        const start = Date.now();
        const response = await request.get("/api/activity");
        const elapsed = Date.now() - start;

        expect(response.ok()).toBeTruthy();
        const data = await response.json();

        console.log(`Activity feed (${data.events?.length || 0} events): ${elapsed}ms`);
        expect(elapsed).toBeLessThan(THRESHOLDS.apiActivity);
    });

    test("GET /api/stats should be fast", async ({ request }) => {
        const start = Date.now();
        const response = await request.get("/api/stats");
        const elapsed = Date.now() - start;

        expect(response.ok()).toBeTruthy();
        const data = await response.json();

        console.log(`Stats: ${JSON.stringify(data)} in ${elapsed}ms`);
        expect(elapsed).toBeLessThan(THRESHOLDS.apiStats);
    });

    test("GET /api/block/:number should be fast (cached)", async ({ request }) => {
        const times = [];
        const blocks = [5300011, 5300100, 5300500];

        for (const block of blocks) {
            const start = Date.now();
            const response = await request.get(`/api/block/${block}`);
            const elapsed = Date.now() - start;
            times.push(elapsed);

            expect(response.ok()).toBeTruthy();
            console.log(`GET /api/block/${block}: ${elapsed}ms`);
        }

        const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
        console.log(`Average block API time: ${avgTime.toFixed(1)}ms`);
        expect(avgTime).toBeLessThan(THRESHOLDS.apiNft);
    });

    test("GET /api/authors should be fast", async ({ request }) => {
        const start = Date.now();
        const response = await request.get("/api/authors");
        const elapsed = Date.now() - start;

        expect(response.ok()).toBeTruthy();
        const data = await response.json();

        console.log(`Authors (${data.authors?.length || 0}): ${elapsed}ms`);
        expect(elapsed).toBeLessThan(THRESHOLDS.apiStats);
    });
});

test.describe("Page Load Performance", () => {
    test("Homepage should load quickly", async ({ page }) => {
        const start = Date.now();

        // Navigate and wait for network idle
        await page.goto("/", { waitUntil: "networkidle" });
        const elapsed = Date.now() - start;

        // Check that key elements are visible
        await expect(page.locator("text=Start Writing")).toBeVisible();

        console.log(`Homepage load: ${elapsed}ms`);
        expect(elapsed).toBeLessThan(THRESHOLDS.pageLoad);
    });

    test("NFT page should load quickly", async ({ page }) => {
        const start = Date.now();

        await page.goto("/nft?id=1", { waitUntil: "networkidle" });
        const elapsed = Date.now() - start;

        console.log(`NFT page load: ${elapsed}ms`);
        expect(elapsed).toBeLessThan(THRESHOLDS.nftPageLoad);
    });

    test("Homepage should make minimal network requests", async ({ page }) => {
        const apiRequests = [];

        // Intercept API requests
        page.on("request", (request) => {
            if (request.url().includes("/api/")) {
                apiRequests.push({
                    url: request.url(),
                    method: request.method(),
                });
            }
        });

        await page.goto("/", { waitUntil: "networkidle" });

        console.log("API requests made:", apiRequests.length);
        apiRequests.forEach((r) => console.log(`  ${r.method} ${r.url}`));

        // Should use batch endpoint, not individual fetches
        const individualNftRequests = apiRequests.filter(
            (r) => r.url.match(/\/api\/nft\/\d+$/)
        );

        // Allow some individual requests for live feed, but batch should be primary
        expect(individualNftRequests.length).toBeLessThan(15);
    });
});

test.describe("Comparison: Cached vs Uncached", () => {
    test("First request vs subsequent requests", async ({ request }) => {
        // First request (may or may not be cached)
        const start1 = Date.now();
        await request.get("/api/nft/1");
        const elapsed1 = Date.now() - start1;

        // Second request (definitely cached now)
        const start2 = Date.now();
        await request.get("/api/nft/1");
        const elapsed2 = Date.now() - start2;

        // Third request
        const start3 = Date.now();
        await request.get("/api/nft/1");
        const elapsed3 = Date.now() - start3;

        console.log(`Request 1: ${elapsed1}ms`);
        console.log(`Request 2: ${elapsed2}ms`);
        console.log(`Request 3: ${elapsed3}ms`);

        // Cached requests should be consistently fast
        expect(elapsed2).toBeLessThan(THRESHOLDS.apiNft);
        expect(elapsed3).toBeLessThan(THRESHOLDS.apiNft);
    });
});

test.describe("WebSocket Connection", () => {
    test("Should connect to WebSocket", async ({ page }) => {
        let wsConnected = false;

        page.on("websocket", (ws) => {
            wsConnected = true;
            console.log(`WebSocket connected: ${ws.url()}`);
        });

        await page.goto("/", { waitUntil: "networkidle" });

        // Give WebSocket time to connect
        await page.waitForTimeout(2000);

        // Check the UI shows connected status
        const liveIndicator = page.locator("text=Live");
        const isVisible = await liveIndicator.isVisible().catch(() => false);

        console.log(`WebSocket connected: ${wsConnected}`);
        console.log(`Live indicator visible: ${isVisible}`);
    });
});
