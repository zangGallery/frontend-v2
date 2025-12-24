import { test, expect } from "@playwright/test";

test.describe("Prefetch Metrics", () => {
    test.setTimeout(60000);

    test("measure component load times", async ({ page }) => {
        console.log("\n" + "=".repeat(60));
        console.log("PREFETCH PERFORMANCE METRICS");
        console.log("=".repeat(60));

        // TEST 1: Direct navigation (baseline)
        console.log("\n--- TEST 1: Direct Navigation (no prefetch) ---\n");

        const directStart = Date.now();
        await page.goto("http://localhost:8000/nft?id=10", { waitUntil: "domcontentloaded" });

        const directTimes = {};

        // Title
        let start = Date.now();
        await page.waitForFunction(() => {
            const h1 = document.querySelector("h1");
            return h1 && h1.textContent && !h1.textContent.includes("loading");
        }, { timeout: 15000 });
        directTimes["Title"] = Date.now() - directStart;

        // Content (iframe or pre)
        start = Date.now();
        await page.waitForSelector("iframe, pre.font-mono", { timeout: 15000 });
        directTimes["Content"] = Date.now() - directStart;

        // Edition
        try {
            await page.waitForSelector("text=/Edition:/", { timeout: 5000 });
            directTimes["Edition"] = Date.now() - directStart;
        } catch { directTimes["Edition"] = ">5000"; }

        // Royalty
        try {
            await page.waitForSelector("text=/royalty/", { timeout: 5000 });
            directTimes["Royalty"] = Date.now() - directStart;
        } catch { directTimes["Royalty"] = ">5000"; }

        const directTotal = Date.now() - directStart;

        console.log("Load times (ms from navigation):");
        for (const [name, time] of Object.entries(directTimes)) {
            console.log(`  ${name.padEnd(15)} ${time}`);
        }
        console.log(`  ${"TOTAL".padEnd(15)} ${directTotal}`);

        // TEST 2: With prefetch
        console.log("\n--- TEST 2: With Prefetch ---\n");

        await page.goto("http://localhost:8000", { waitUntil: "domcontentloaded" });
        await page.waitForSelector('[role="button"]', { timeout: 10000 });

        // Find first NFT card and extract its ID
        const nftCard = page.locator('[role="button"]').first();
        const idText = await nftCard.locator(".font-mono").first().textContent();
        const nftId = idText.replace("#", "");
        console.log(`Testing with NFT #${nftId}`);

        // Hover and wait for prefetch
        console.log("Hovering to trigger prefetch...");
        await nftCard.hover();
        await page.waitForTimeout(600); // Wait for prefetch to complete

        // Click and measure
        const clickStart = Date.now();
        await nftCard.click();
        await page.waitForURL(new RegExp(`/nft\\?id=${nftId}`), { timeout: 5000 });

        const prefetchTimes = {};

        // Title
        await page.waitForFunction(() => {
            const h1 = document.querySelector("h1");
            return h1 && h1.textContent && !h1.textContent.includes("loading");
        }, { timeout: 15000 });
        prefetchTimes["Title"] = Date.now() - clickStart;

        // Content
        await page.waitForSelector("iframe, pre.font-mono", { timeout: 15000 });
        prefetchTimes["Content"] = Date.now() - clickStart;

        // Edition
        try {
            await page.waitForSelector("text=/Edition:/", { timeout: 5000 });
            prefetchTimes["Edition"] = Date.now() - clickStart;
        } catch { prefetchTimes["Edition"] = ">5000"; }

        // Royalty
        try {
            await page.waitForSelector("text=/royalty/", { timeout: 5000 });
            prefetchTimes["Royalty"] = Date.now() - clickStart;
        } catch { prefetchTimes["Royalty"] = ">5000"; }

        const prefetchTotal = Date.now() - clickStart;

        console.log("Load times (ms from click):");
        for (const [name, time] of Object.entries(prefetchTimes)) {
            console.log(`  ${name.padEnd(15)} ${time}`);
        }
        console.log(`  ${"TOTAL".padEnd(15)} ${prefetchTotal}`);

        // Summary table
        console.log("\n" + "=".repeat(60));
        console.log("COMPARISON");
        console.log("=".repeat(60));
        console.log("\nComponent       Direct    Prefetch  Improvement");
        console.log("-".repeat(50));

        for (const name of Object.keys(directTimes)) {
            const direct = directTimes[name];
            const prefetch = prefetchTimes[name];
            let improvement = "N/A";
            if (typeof direct === "number" && typeof prefetch === "number") {
                improvement = `${direct - prefetch}ms (${Math.round((1 - prefetch/direct) * 100)}%)`;
            }
            console.log(
                `${name.padEnd(15)} ${String(direct).padEnd(9)} ${String(prefetch).padEnd(9)} ${improvement}`
            );
        }
        console.log("-".repeat(50));
        console.log(
            `${"TOTAL".padEnd(15)} ${String(directTotal).padEnd(9)} ${String(prefetchTotal).padEnd(9)} ` +
            `${directTotal - prefetchTotal}ms (${Math.round((1 - prefetchTotal/directTotal) * 100)}%)`
        );
        console.log("=".repeat(60));

        // Assertions
        expect(prefetchTimes["Title"]).toBeLessThan(directTimes["Title"]);
    });
});
