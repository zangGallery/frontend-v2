// @ts-check
import { test, expect } from "@playwright/test";

test.describe("Profile Page Performance", () => {
    test("profile page performance metrics", async ({ page }) => {
        // Use a known address with NFTs
        const testAddress = "0xC04689227Fa24785609B1174698DBe481437f1A3";

        const apiCalls = [];
        const rpcCalls = [];

        // Track network requests
        page.on("request", (request) => {
            const url = request.url();
            if (url.includes("/api/")) {
                apiCalls.push({
                    url,
                    time: Date.now(),
                });
            }
            if (url.includes("alchemy.com") || url.includes("infura.io")) {
                rpcCalls.push({
                    url,
                    time: Date.now(),
                });
            }
        });

        page.on("response", (response) => {
            const url = response.url();
            const call = apiCalls.find((c) => c.url === url && !c.responseTime);
            if (call) {
                call.responseTime = Date.now() - call.time;
                call.status = response.status();
            }
        });

        const startTime = Date.now();

        await page.goto(`http://localhost:3000/profile?address=${testAddress}`);

        // Wait for content to load
        await page.waitForSelector('[class*="grid"]', { timeout: 15000 });

        // Wait a bit for any lazy RPC calls
        await page.waitForTimeout(3000);

        const loadTime = Date.now() - startTime;

        // Check UI state
        const nftCards = await page.locator('[class*="NFTCard"], [class*="cursor-pointer"]').count();
        const statsVisible = await page.locator('text=/Created|Collected|Volume/').first().isVisible();

        console.log("\n========================================");
        console.log("PROFILE PAGE PERFORMANCE REPORT");
        console.log("========================================");
        console.log(`Total Load Time: ${loadTime}ms`);
        console.log(`\nAPI Calls (${apiCalls.length}):`);
        apiCalls.forEach((call) => {
            const path = new URL(call.url).pathname;
            console.log(`  ${call.responseTime || "?"}ms - ${path}`);
        });
        console.log(`\nRPC Calls (${rpcCalls.length}):`);
        rpcCalls.slice(0, 10).forEach((call) => {
            console.log(`  ${call.time - startTime}ms - ${new URL(call.url).hostname}`);
        });
        if (rpcCalls.length > 10) {
            console.log(`  ... and ${rpcCalls.length - 10} more`);
        }
        console.log(`\nUI State:`);
        console.log(`  Stats visible: ${statsVisible}`);
        console.log(`  NFT Cards rendered: ${nftCards}`);
        console.log("========================================\n");

        console.log(`METRICS JSON: ${JSON.stringify({
            timestamp: new Date().toISOString(),
            loadTimeMs: loadTime,
            apiCallCount: apiCalls.length,
            rpcCallCount: rpcCalls.length,
            nftCardsRendered: nftCards,
        })}`);

        // Assertions
        expect(loadTime).toBeLessThan(10000); // Should load in under 10s
        expect(apiCalls.length).toBeGreaterThan(0);
    });

    test("measure /api/author endpoint", async ({ page }) => {
        const testAddress = "0xC04689227Fa24785609B1174698DBe481437f1A3";

        const startTime = Date.now();
        const response = await page.request.get(
            `http://localhost:3000/api/author/${testAddress}`
        );
        const responseTime = Date.now() - startTime;

        const data = await response.json();

        console.log("\n========================================");
        console.log("/api/author ENDPOINT TEST");
        console.log("========================================");
        console.log(`Response Time: ${responseTime}ms`);
        console.log(`Status: ${response.status()}`);
        console.log(`Created NFTs: ${data.created?.length || 0}`);
        console.log(`Collected NFTs: ${data.collected?.length || 0}`);
        console.log(`Has content in NFTs: ${data.created?.[0]?.content ? 'yes' : 'no'}`);
        console.log(`Has stats in NFTs: ${data.created?.[0]?.total_supply !== undefined ? 'yes' : 'no'}`);
        console.log("========================================\n");

        expect(response.status()).toBe(200);
        expect(responseTime).toBeLessThan(3000);
    });
});
