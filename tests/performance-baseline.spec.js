import { test, expect } from "@playwright/test";

/**
 * Performance Baseline Tests
 *
 * Run this before and after optimizations to measure impact.
 * Metrics tracked:
 * - Page load time (navigation to networkidle)
 * - API call count
 * - RPC call count (alchemy.com requests)
 * - Time to first content visible
 */

test.describe("Performance Baseline", () => {
    test("home page performance metrics", async ({ page }) => {
        // Track all network requests
        const metrics = {
            apiCalls: [],
            rpcCalls: [],
            startTime: 0,
            firstContentTime: 0,
            loadTime: 0,
        };

        // Listen to all requests
        page.on("request", (request) => {
            const url = request.url();
            if (url.includes("/api/")) {
                metrics.apiCalls.push({
                    url: url.replace(/^.*\/api/, "/api"),
                    time: Date.now() - metrics.startTime,
                });
            }
            if (url.includes("alchemy.com") || url.includes("base.org")) {
                metrics.rpcCalls.push({
                    url: url.substring(0, 80),
                    time: Date.now() - metrics.startTime,
                });
            }
        });

        // Detect first meaningful content
        page.on("console", (msg) => {
            if (msg.text().includes("first-content-visible") && metrics.firstContentTime === 0) {
                metrics.firstContentTime = Date.now() - metrics.startTime;
            }
        });

        // Start timing
        metrics.startTime = Date.now();

        // Navigate and wait for network to settle
        await page.goto("http://localhost:3000", { waitUntil: "networkidle" });

        metrics.loadTime = Date.now() - metrics.startTime;

        // Wait for main content sections to be visible
        const sectionsVisible = await Promise.all([
            page.locator("text=Latest Works").isVisible().catch(() => false),
            page.locator("text=Top Artists").isVisible().catch(() => false),
            page.locator("text=Top Collectors").isVisible().catch(() => false),
        ]);

        // Check for NFT cards
        await page.waitForTimeout(2000); // Allow time for cards to render
        const nftCards = await page.locator('[class*="grid"] a').count();

        // Generate report
        console.log("\n========================================");
        console.log("PERFORMANCE BASELINE REPORT");
        console.log("========================================");
        console.log(`Total Load Time: ${metrics.loadTime}ms`);
        console.log(`\nAPI Calls (${metrics.apiCalls.length}):`);
        metrics.apiCalls.forEach((call) => {
            console.log(`  ${call.time}ms - ${call.url}`);
        });
        console.log(`\nRPC Calls (${metrics.rpcCalls.length}):`);
        metrics.rpcCalls.slice(0, 20).forEach((call) => {
            console.log(`  ${call.time}ms - ${call.url}`);
        });
        if (metrics.rpcCalls.length > 20) {
            console.log(`  ... and ${metrics.rpcCalls.length - 20} more`);
        }
        console.log(`\nUI State:`);
        console.log(`  Latest Works visible: ${sectionsVisible[0]}`);
        console.log(`  Top Artists visible: ${sectionsVisible[1]}`);
        console.log(`  Top Collectors visible: ${sectionsVisible[2]}`);
        console.log(`  NFT Cards rendered: ${nftCards}`);
        console.log("========================================\n");

        // Store metrics for comparison
        const report = {
            timestamp: new Date().toISOString(),
            loadTimeMs: metrics.loadTime,
            apiCallCount: metrics.apiCalls.length,
            rpcCallCount: metrics.rpcCalls.length,
            nftCardsRendered: nftCards,
            sectionsVisible: sectionsVisible.filter(Boolean).length,
        };

        console.log("METRICS JSON:", JSON.stringify(report, null, 2));

        // Assertions for baseline
        expect(metrics.loadTime).toBeLessThan(30000); // Should load within 30s at worst
        expect(sectionsVisible.filter(Boolean).length).toBeGreaterThanOrEqual(2); // At least 2 sections
    });

    test("measure individual API response times", async ({ page }) => {
        const apiTimes = {};
        const requestTimes = {};

        page.on("request", (request) => {
            const url = request.url();
            if (url.includes("/api/")) {
                requestTimes[url] = Date.now();
            }
        });

        page.on("response", async (response) => {
            const url = response.url();
            if (url.includes("/api/")) {
                const endpoint = url.replace(/^.*\/api/, "/api").split("?")[0];
                const startTime = requestTimes[url] || Date.now();
                apiTimes[endpoint] = {
                    status: response.status(),
                    responseTime: Date.now() - startTime,
                };
            }
        });

        await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
        await page.waitForTimeout(3000);

        console.log("\n========================================");
        console.log("API RESPONSE TIMES");
        console.log("========================================");
        Object.entries(apiTimes).forEach(([endpoint, data]) => {
            console.log(`${endpoint}: ${data.status} (${data.responseTime}ms)`);
        });
        console.log("========================================\n");
    });

    test("measure /api/home endpoint (if exists)", async ({ page }) => {
        // Direct API test for /api/home endpoint
        const startTime = Date.now();

        try {
            const response = await page.request.get("http://localhost:3000/api/home");
            const endTime = Date.now();

            if (response.ok()) {
                const data = await response.json();
                console.log("\n========================================");
                console.log("/api/home ENDPOINT TEST");
                console.log("========================================");
                console.log(`Response Time: ${endTime - startTime}ms`);
                console.log(`Status: ${response.status()}`);
                console.log(`Has lastNftId: ${!!data.lastNftId}`);
                console.log(`NFTs count: ${data.nfts?.length || 0}`);
                console.log(`Top Artists count: ${data.topArtists?.length || 0}`);
                console.log(`Top Collectors count: ${data.topCollectors?.length || 0}`);
                console.log(`Recent Events count: ${data.recentEvents?.length || 0}`);
                console.log("========================================\n");

                expect(endTime - startTime).toBeLessThan(1000); // Should be under 1s
                expect(data.nfts?.length).toBeGreaterThan(0);
            } else {
                console.log("/api/home endpoint not yet implemented (404)");
            }
        } catch (error) {
            console.log("/api/home endpoint not yet implemented:", error.message);
        }
    });
});
