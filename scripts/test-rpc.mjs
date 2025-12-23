import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:3000';

async function testPage(page, path, waitFor = 5000) {
    // Set flag before page loads so tracker auto-enables
    await page.addInitScript(() => {
        window.__RPC_TRACKING_ENABLED__ = true;
    });

    // Navigate
    await page.goto(`${BASE_URL}${path}`, { waitUntil: 'networkidle' });

    // Wait for data to load
    await page.waitForTimeout(waitFor);

    // Get summary
    const summary = await page.evaluate(() => {
        const tracker = window.rpcTracker;
        if (!tracker) return { error: 'rpcTracker not found' };

        const byMethod = {};
        for (const call of tracker.calls) {
            const key = `${call.method}`;
            byMethod[key] = (byMethod[key] || 0) + 1;
        }

        // Group by unique call (method + args)
        const uniqueCalls = {};
        for (const call of tracker.calls) {
            const key = `${call.method}(${call.args})`;
            uniqueCalls[key] = (uniqueCalls[key] || 0) + 1;
        }

        // Find duplicates
        const duplicates = Object.entries(uniqueCalls)
            .filter(([_, count]) => count > 1)
            .map(([key, count]) => ({ call: key, count }));

        return {
            total: tracker.calls.length,
            byMethod,
            duplicates,
            calls: tracker.calls.map(c => ({ method: c.method, args: c.args }))
        };
    });

    return summary;
}

async function main() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    // Suppress console noise
    page.on('console', () => {});
    page.on('pageerror', () => {});

    console.log('='.repeat(60));
    console.log('RPC CALL ANALYSIS');
    console.log('='.repeat(60));

    // Test main page
    console.log('\n📄 MAIN PAGE (/)');
    console.log('-'.repeat(40));
    const mainResult = await testPage(page, '/', 6000);
    printResult(mainResult);

    // Test NFT page
    console.log('\n📄 NFT PAGE (/nft?id=13)');
    console.log('-'.repeat(40));
    const nftResult = await testPage(page, '/nft?id=13', 5000);
    printResult(nftResult);

    await browser.close();

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    console.log(`Main page: ${mainResult.total} RPC calls`);
    console.log(`NFT page:  ${nftResult.total} RPC calls`);

    const mainDupes = mainResult.duplicates?.length || 0;
    const nftDupes = nftResult.duplicates?.length || 0;

    if (mainDupes === 0 && nftDupes === 0) {
        console.log('\n✅ No duplicate RPC calls detected!');
    } else {
        console.log(`\n⚠️  Duplicates: Main=${mainDupes}, NFT=${nftDupes}`);
    }
}

function printResult(result) {
    if (result.error) {
        console.log(`❌ Error: ${result.error}`);
        return;
    }

    console.log(`Total RPC calls: ${result.total}`);
    console.log('\nBy method:');
    for (const [method, count] of Object.entries(result.byMethod)) {
        console.log(`  ${method}: ${count}`);
    }

    if (result.duplicates && result.duplicates.length > 0) {
        console.log('\n⚠️  DUPLICATE CALLS:');
        for (const dup of result.duplicates) {
            console.log(`  ${dup.call}: called ${dup.count}x`);
        }
    } else {
        console.log('\n✅ No duplicates');
    }
}

main().catch(console.error);
