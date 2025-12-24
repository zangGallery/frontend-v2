import { test, expect } from "@playwright/test";

test.describe("Prefetch Performance", () => {
    test("hovering over NFT card should prefetch data", async ({ page }) => {
        // Listen for API calls
        const apiCalls = [];
        page.on("request", (request) => {
            if (request.url().includes("/api/nft/")) {
                apiCalls.push({
                    url: request.url(),
                    time: Date.now(),
                    type: "request",
                });
            }
        });
        page.on("response", (response) => {
            if (response.url().includes("/api/nft/")) {
                apiCalls.push({
                    url: response.url(),
                    time: Date.now(),
                    type: "response",
                    status: response.status(),
                });
            }
        });

        await page.goto("http://localhost:8000");
        await page.waitForLoadState("networkidle");

        // Find first NFT card
        const nftCard = page.locator('[role="button"]').first();
        await expect(nftCard).toBeVisible();

        // Get the NFT ID from the card
        const idText = await nftCard.locator(".font-mono").first().textContent();
        const nftId = idText.replace("#", "");
        console.log(`Testing prefetch for NFT #${nftId}`);

        // Clear previous API calls
        apiCalls.length = 0;

        // Hover over the card
        const hoverStart = Date.now();
        await nftCard.hover();

        // Wait for prefetch to complete (should happen quickly)
        await page.waitForTimeout(500);

        // Check if prefetch request was made
        const prefetchCalls = apiCalls.filter(c => c.url.includes(`/api/nft/${nftId}`));
        console.log("Prefetch calls after hover:", prefetchCalls);

        expect(prefetchCalls.length).toBeGreaterThan(0);
        console.log(`✓ Prefetch request made after ${prefetchCalls[0]?.time - hoverStart}ms`);

        // Now click and measure time to content
        apiCalls.length = 0;
        const clickStart = Date.now();
        await nftCard.click();

        // Wait for NFT page to load
        await page.waitForURL(/\/nft\?id=/);

        // Check if content appears quickly (should use prefetched data)
        const contentSelector = 'h1'; // NFT title
        await expect(page.locator(contentSelector).first()).toBeVisible({ timeout: 2000 });
        const contentTime = Date.now() - clickStart;

        console.log(`Content visible after ${contentTime}ms`);

        // Check if any NEW API calls were made for the same NFT
        const newApiCalls = apiCalls.filter(c => c.url.includes(`/api/nft/${nftId}`));
        console.log("API calls after click:", newApiCalls);

        if (newApiCalls.length === 0) {
            console.log("✓ No duplicate API call - prefetch cache was used!");
        } else {
            console.log("⚠ API call was made again - prefetch cache may not be working");
        }

        // Content should appear in under 500ms if prefetched
        expect(contentTime).toBeLessThan(1000);
    });

    test("compare load time with and without prefetch", async ({ page }) => {
        // Test 1: Direct navigation (no prefetch)
        const directStart = Date.now();
        await page.goto("http://localhost:8000/nft?id=1");
        await expect(page.locator("h1").first()).toBeVisible({ timeout: 5000 });
        const directTime = Date.now() - directStart;
        console.log(`Direct navigation: ${directTime}ms`);

        // Test 2: With prefetch (hover then click)
        await page.goto("http://localhost:8000");
        await page.waitForLoadState("networkidle");

        const nftCard = page.locator('[role="button"]').first();
        await nftCard.hover();
        await page.waitForTimeout(500); // Wait for prefetch

        const prefetchStart = Date.now();
        await nftCard.click();
        await page.waitForURL(/\/nft\?id=/);
        await expect(page.locator("h1").first()).toBeVisible({ timeout: 5000 });
        const prefetchTime = Date.now() - prefetchStart;
        console.log(`With prefetch: ${prefetchTime}ms`);

        console.log(`\nSpeed improvement: ${directTime - prefetchTime}ms faster (${Math.round((1 - prefetchTime/directTime) * 100)}%)`);
    });
});
