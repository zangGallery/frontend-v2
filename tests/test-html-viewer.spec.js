// @ts-check
import { test, expect } from "@playwright/test";

test.describe("HTML Artwork Display", () => {
    test("test specific NFT pages for HTML content", async ({ page }) => {
        // Test a few NFT IDs to find HTML ones
        const testIds = [1, 5, 10, 15, 20, 25, 30];

        for (const id of testIds) {
            await page.goto(`http://localhost:3000/nft?id=${id}`);

            // Wait for page to load
            await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

            // Check for iframe (HTML content)
            const iframe = await page.locator('iframe[title="NFT HTML Content"]');
            const hasIframe = await iframe.isVisible().catch(() => false);

            // Check for any visible content
            const title = await page.locator('h1').first().textContent().catch(() => 'unknown');

            console.log(`NFT #${id}: title="${title?.substring(0, 30)}", hasIframe=${hasIframe}`);

            if (hasIframe) {
                const iframeHandle = await iframe.elementHandle();
                const frame = await iframeHandle?.contentFrame();
                if (frame) {
                    const bodyHtml = await frame.locator('body').innerHTML().catch(() => '');
                    const isEmpty = !bodyHtml || bodyHtml.trim().length < 10;
                    console.log(`  -> Content length: ${bodyHtml?.length || 0}, empty: ${isEmpty}`);

                    if (!isEmpty && bodyHtml.length < 500) {
                        console.log(`  -> Content: ${bodyHtml}`);
                    } else if (!isEmpty) {
                        console.log(`  -> Preview: ${bodyHtml.substring(0, 200)}...`);
                    }
                }
            }
        }
    });

    test("check SVG rendering in HTML viewer", async ({ page }) => {
        // Go to mint page and check HTML editor
        await page.goto("http://localhost:3000/mint");
        await page.waitForLoadState('domcontentloaded');

        // Select HTML type
        const htmlButton = await page.locator('button:has-text("HTML")');
        await htmlButton.click();

        // Wait for editor
        await page.waitForTimeout(2000);

        // Check guidelines
        const svgAllowed = await page.locator('text=SVG graphics').isVisible().catch(() => false);
        console.log(`SVG mentioned as allowed in guidelines: ${svgAllowed}`);

        expect(svgAllowed).toBe(true);
    });
});
