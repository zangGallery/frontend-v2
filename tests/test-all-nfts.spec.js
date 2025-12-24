// @ts-check
import { test, expect } from "@playwright/test";

test("check all NFTs for rendering issues", async ({ page }) => {
    // First get the total count from gallery
    await page.goto("http://localhost:3000/gallery");
    await page.waitForLoadState('networkidle', { timeout: 15000 });

    // Get last NFT ID from the page
    const countText = await page.locator('text=/\\d+ works/').textContent().catch(() => '30 works');
    const totalNfts = parseInt(countText?.match(/(\d+)/)?.[1] || '30');
    console.log(`\nTotal NFTs: ${totalNfts}\n`);

    const issues = [];
    const results = [];

    // Test each NFT
    for (let id = 1; id <= totalNfts; id++) {
        await page.goto(`http://localhost:3000/nft?id=${id}`, { timeout: 10000 }).catch(() => {});
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(500);

        // Get title
        const title = await page.locator('h1').first().textContent().catch(() => 'unknown');

        // Check for HTML iframe
        const iframe = await page.locator('iframe[title="NFT HTML Content"]');
        const hasIframe = await iframe.isVisible().catch(() => false);

        // Check for markdown content
        const hasMarkdown = await page.locator('.prose, .markdown-body').isVisible().catch(() => false);

        // Check for plain text
        const hasText = await page.locator('pre, .whitespace-pre-wrap').isVisible().catch(() => false);

        let contentStatus = 'unknown';
        let contentLength = 0;
        let isEmpty = false;

        if (hasIframe) {
            contentStatus = 'HTML';
            const iframeHandle = await iframe.elementHandle();
            const frame = await iframeHandle?.contentFrame();
            if (frame) {
                const bodyHtml = await frame.locator('body').innerHTML().catch(() => '');
                contentLength = bodyHtml?.length || 0;
                isEmpty = contentLength < 20;
            }
        } else if (hasMarkdown) {
            contentStatus = 'Markdown';
            const mdContent = await page.locator('.prose, .markdown-body').textContent().catch(() => '');
            contentLength = mdContent?.length || 0;
            isEmpty = contentLength < 5;
        } else if (hasText) {
            contentStatus = 'Text';
            const textContent = await page.locator('pre, .whitespace-pre-wrap').textContent().catch(() => '');
            contentLength = textContent?.length || 0;
            isEmpty = contentLength < 5;
        }

        const status = isEmpty ? '❌ EMPTY' : '✓';
        console.log(`#${id.toString().padStart(2)} ${status} ${contentStatus.padEnd(8)} "${title?.substring(0, 25)}..." (${contentLength} chars)`);

        results.push({ id, title, contentStatus, contentLength, isEmpty });

        if (isEmpty && contentStatus !== 'unknown') {
            issues.push({ id, title, contentStatus });
        }
    }

    console.log(`\n========================================`);
    console.log(`SUMMARY`);
    console.log(`========================================`);
    console.log(`Total NFTs: ${results.length}`);
    console.log(`HTML: ${results.filter(r => r.contentStatus === 'HTML').length}`);
    console.log(`Markdown: ${results.filter(r => r.contentStatus === 'Markdown').length}`);
    console.log(`Text: ${results.filter(r => r.contentStatus === 'Text').length}`);
    console.log(`Unknown: ${results.filter(r => r.contentStatus === 'unknown').length}`);
    console.log(`Empty content issues: ${issues.length}`);

    if (issues.length > 0) {
        console.log(`\nNFTs with empty content:`);
        issues.forEach(i => console.log(`  #${i.id} - ${i.title} (${i.contentStatus})`));
    }
    console.log(`========================================\n`);

    // Expect no empty content issues
    expect(issues.length).toBe(0);
});
