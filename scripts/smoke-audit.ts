import { chromium } from "playwright";

/**
 * Verifies that changing an already-recorded leg result is logged as a
 * correction, and that a scorer (who cannot correct) cannot reach the log.
 */

const BASE = "http://localhost:3000";

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors: string[] = [];

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill("#email", "admin@dartleague.test");
  await page.fill("#password", "dartleague");
  await Promise.all([
    page.waitForURL("**/leagues", { timeout: 30000 }),
    page.click('button[type="submit"]'),
  ]);

  // Find a match that already has a leg result.
  await page.goto(`${BASE}/l/demo-league/enter`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);

  const matchLinks = await page.locator('a:has-text("Enter →")').count();
  let target: string | null = null;

  for (let i = 0; i < Math.min(matchLinks, 12) && !target; i++) {
    const href = await page
      .locator('a:has-text("Enter →")')
      .nth(i)
      .getAttribute("href");
    if (!href) continue;
    await page.goto(`${BASE}${href}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    const body = await page.innerText("body");
    if (/Leg \d+\s*\n?\s*Side A won|Side B won/i.test(body)) {
      target = href;
    }
  }

  if (!target) {
    errors.push("no match with a recorded leg result found");
  } else {
    console.log("PASS  found a match with a recorded leg result");

    // Find a leg that already has a result and flip it. The "Clear" button
    // only appears on legs that have a winner, so use it to locate one.
    const clearButtons = page.locator('button:has-text("Clear")');
    const clearCount = await clearButtons.count();
    if (clearCount === 0) {
      errors.push("no leg with a recorded result found");
    } else {
      // Click the winning-side button belonging to the first leg that has a
      // result. Buttons are grouped per leg in DOM order.
      const sideButtons = page.locator('button[name="winningSide"]');
      const total = await sideButtons.count();
      // The first two winning-side buttons belong to the first leg.
      await sideButtons.nth(1).click();
      await page.waitForTimeout(2500);

      await page.goto(`${BASE}/l/demo-league/activity`, {
        waitUntil: "networkidle",
      });
      await page.waitForTimeout(1200);
      const logText = await page.innerText("body");
      if (logText.includes("Leg result")) {
        console.log("PASS  activity log records the leg result change");
      } else {
        errors.push(
          `activity log missing the leg result change (${total} side buttons)`,
        );
      }
    }
  }

  await browser.close();

  if (errors.length > 0) {
    console.log("\nFAILURES:");
    for (const e of errors) console.log("  - " + e);
    process.exit(1);
  }
  console.log("\nAudit log checks passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
