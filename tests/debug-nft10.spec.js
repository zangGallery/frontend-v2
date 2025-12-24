// @ts-check
import { test, expect } from "@playwright/test";

test("debug NFT #10 rendering", async ({ page }) => {
    await page.goto("http://localhost:3000/nft?id=10");
    await page.waitForLoadState('networkidle', { timeout: 15000 });

    // Get the iframe
    const iframe = await page.locator('iframe[title="NFT HTML Content"]');
    const isVisible = await iframe.isVisible();
    console.log(`Iframe visible: ${isVisible}`);

    // Get iframe dimensions
    const box = await iframe.boundingBox();
    console.log(`Iframe dimensions: ${box?.width}x${box?.height}`);

    // Get iframe content
    const iframeHandle = await iframe.elementHandle();
    const frame = await iframeHandle?.contentFrame();

    if (frame) {
        // Get full HTML
        const html = await frame.locator('html').innerHTML();
        console.log('\n=== FULL IFRAME HTML ===');
        console.log(html);
        console.log('=== END ===\n');

        // Check if style tag exists
        const hasStyle = html.includes('<style>');
        console.log(`Has <style> tag: ${hasStyle}`);

        // Check if classes exist
        const hasSkyClass = html.includes('class="sky"');
        console.log(`Has sky class: ${hasSkyClass}`);

        // Get computed styles
        const skyDiv = frame.locator('.sky');
        const skyExists = await skyDiv.count() > 0;
        console.log(`Sky div exists: ${skyExists}`);

        if (skyExists) {
            const bgColor = await skyDiv.evaluate(el => getComputedStyle(el).background);
            console.log(`Sky background: ${bgColor}`);

            const height = await skyDiv.evaluate(el => getComputedStyle(el).height);
            console.log(`Sky height: ${height}`);
        }

        // Check body background
        const bodyBg = await frame.locator('body').evaluate(el => getComputedStyle(el).backgroundColor);
        console.log(`Body background: ${bodyBg}`);
    }
});
