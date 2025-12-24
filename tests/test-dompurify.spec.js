// @ts-check
import { test, expect } from "@playwright/test";

test("test DOMPurify style tag handling", async ({ page }) => {
    // Go to any page to get browser context
    await page.goto("http://localhost:3000");

    // Test DOMPurify directly in browser
    const result = await page.evaluate(() => {
        // @ts-ignore
        const DOMPurify = window.DOMPurify;
        if (!DOMPurify) {
            return { error: "DOMPurify not found on window" };
        }

        const testContent = `<style>.test { color: red; }</style><div class="test">Hello</div>`;

        // Test with different configs
        const configs = [
            { name: "default", config: {} },
            { name: "ADD_TAGS style", config: { ADD_TAGS: ["style"] } },
            { name: "FORCE_BODY false", config: { ADD_TAGS: ["style"], FORCE_BODY: false } },
            { name: "WHOLE_DOCUMENT", config: { ADD_TAGS: ["style"], WHOLE_DOCUMENT: true } },
        ];

        const results = {};
        for (const { name, config } of configs) {
            results[name] = DOMPurify.sanitize(testContent, config);
        }

        return results;
    });

    console.log("\n=== DOMPurify Test Results ===");
    for (const [name, output] of Object.entries(result)) {
        console.log(`\n${name}:`);
        console.log(output);
        console.log(`Has style: ${output.includes("<style>")}`);
    }
});
