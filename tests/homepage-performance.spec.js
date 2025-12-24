import { test, expect } from "@playwright/test";

test.describe("Homepage Performance", () => {
    test("loads home page sections efficiently", async ({ page }) => {
        // Track network requests by chain
        const mainnetRequests = [];
        const baseRequests = [];
        page.on("request", (request) => {
            const url = request.url();
            if (url.includes("eth-mainnet")) {
                mainnetRequests.push({ url, time: Date.now() });
            } else if (url.includes("base") || url.includes("alchemy.com")) {
                baseRequests.push({ url, time: Date.now() });
            }
        });

        const startTime = Date.now();

        // Navigate to home page
        await page.goto("http://localhost:3000", { waitUntil: "networkidle" });

        const loadTime = Date.now() - startTime;
        console.log(`Page load time: ${loadTime}ms`);

        // Check that Latest Works section exists and has items
        const latestWorksSection = page.locator("text=Latest Works");
        await expect(latestWorksSection).toBeVisible({ timeout: 10000 });

        // Check for NFT cards in Latest Works (should be limited to 12)
        const nftCards = page.locator('[class*="grid"] a[href*="/nft/"]');
        const cardCount = await nftCards.count();
        console.log(`NFT cards displayed: ${cardCount}`);
        expect(cardCount).toBeLessThanOrEqual(12);

        // Check Top Artists section exists
        const topArtistsSection = page.locator("text=Top Artists");
        await expect(topArtistsSection).toBeVisible({ timeout: 5000 });

        // Check Top Collectors section exists
        const topCollectorsSection = page.locator("text=Top Collectors");
        await expect(topCollectorsSection).toBeVisible({ timeout: 5000 });

        // Check "See All Works" button exists
        const seeAllButton = page.locator("text=See All Works");
        await expect(seeAllButton).toBeVisible();

        // Wait a bit for ENS requests to settle
        await page.waitForTimeout(3000);

        // Report requests by chain
        console.log(`Mainnet (eth-mainnet) requests: ${mainnetRequests.length}`);
        console.log(`Base/Alchemy requests: ${baseRequests.length}`);

        // Mainnet requests should be 0 now (we disabled mainnet ENS)
        expect(mainnetRequests.length).toBe(0);

        // Performance assertions
        expect(loadTime).toBeLessThan(15000); // Page should load within 15s
    });

    test("profile page loads without excessive requests", async ({ page }) => {
        const requests = [];
        page.on("request", (request) => {
            if (request.url().includes("alchemy.com")) {
                requests.push(request.url());
            }
        });

        const startTime = Date.now();

        await page.goto(
            "http://localhost:3000/profile?address=0x6bA78da5619359922bAcCb9850E9220C2cB027F3",
            { waitUntil: "networkidle" }
        );

        const loadTime = Date.now() - startTime;
        console.log(`Profile page load time: ${loadTime}ms`);

        // Profile should show address or ENS name
        const addressDisplay = page.locator("text=/0x6bA7|donnoh/i");
        await expect(addressDisplay.first()).toBeVisible({ timeout: 10000 });

        // Wait for ENS to resolve
        await page.waitForTimeout(2000);

        console.log(`Profile Alchemy requests: ${requests.length}`);

        // Profile should only make a few ENS requests
        expect(requests.length).toBeLessThan(10);
        expect(loadTime).toBeLessThan(10000);
    });
});
