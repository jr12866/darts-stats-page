import { chromium, type Page } from "playwright";

/**
 * Smoke test for the three additions:
 *   1. Audit log (corrections are recorded and visible)
 *   2. Editing a recorded stat value in place
 *   3. The public read-only league page
 *
 * Run with the dev server on http://localhost:3000.
 */

const BASE = "http://localhost:3000";

async function login(page: Page, email: string) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill("#email", email);
  await page.fill("#password", "dartleague");
  await Promise.all([
    page.waitForURL("**/leagues", { timeout: 30000 }),
    page.click('button[type="submit"]'),
  ]);
}

async function signOut(page: Page) {
  await page.goto(`${BASE}/leagues`, { waitUntil: "networkidle" });
  await page.locator('button:has-text("Sign out")').click();
  await page.waitForURL("**/login", { timeout: 20000 });
  await page.waitForTimeout(600);
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors: string[] = [];

  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));

  // ---------------------------------------------------------------------
  // Public page: reachable without logging in
  // ---------------------------------------------------------------------
  await page.goto(`${BASE}/public/demo-league`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  let text = await page.innerText("body");
  if (text.includes("Demo Dart League") && text.includes("Team standings")) {
    console.log("PASS  public page shows standings without logging in");
  } else {
    errors.push("public page did not render standings");
  }
  if (text.includes("Enter results")) {
    errors.push("public page shows the 'Enter results' link");
  } else {
    console.log("PASS  public page hides member-only controls");
  }

  // Public page should not link into private areas.
  const privateLinks = await page
    .locator('a[href*="/enter"], a[href*="/admin"], a[href*="/activity"]')
    .count();
  if (privateLinks === 0) {
    console.log("PASS  public page has no links to private areas");
  } else {
    errors.push(`public page exposes ${privateLinks} private link(s)`);
  }

  // Tabs and filters work on the public page.
  await page.click('a:has-text("High Scores")');
  await page.waitForTimeout(1200);
  if (page.url().includes("/public/demo-league")) {
    console.log("PASS  public tabs stay on the public route");
  } else {
    errors.push(`public tab navigated to ${page.url()}`);
  }

  // Public player profile.
  await page.goto(`${BASE}/public/demo-league?tab=players`, {
    waitUntil: "networkidle",
  });
  await page.waitForTimeout(1200);
  const publicPlayerLink = page.locator('a[href*="/public/demo-league/player/"]').first();
  if ((await publicPlayerLink.count()) === 0) {
    errors.push("no public player links");
  } else {
    await publicPlayerLink.click();
    await page.waitForURL("**/public/**/player/**", { timeout: 20000 });
    await page.waitForTimeout(1200);
    text = await page.innerText("body");
    if (text.includes("Tracked stats")) {
      console.log("PASS  public player profile renders");
    } else {
      errors.push("public player profile missing stat card");
    }
  }

  // ---------------------------------------------------------------------
  // Editing a recorded stat value, and the audit log
  // ---------------------------------------------------------------------
  await login(page, "admin@dartleague.test");

  // Find a match with a recorded stat event by walking the entry area.
  await page.goto(`${BASE}/l/demo-league/enter`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);

    const matchLinks = await page.locator('a:has-text("Enter →")').count();
  let foundMatch: string | null = null;

  for (let i = 0; i < Math.min(matchLinks, 12) && !foundMatch; i++) {
    const href = await page
      .locator('a:has-text("Enter →")')
      .nth(i)
      .getAttribute("href");
    if (!href) continue;
    await page.goto(`${BASE}${href}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(700);
    if ((await page.locator('button:has-text("Edit value")').count()) > 0) {
      foundMatch = href;
    }
  }

  if (!foundMatch) {
    errors.push("no match with a recorded stat event found");
  } else {
    console.log("PASS  found a match with a recorded stat event");

    // --- Edit the value in place ---
    await page.locator('button:has-text("Edit value")').first().click();
    await page.waitForTimeout(500);

    const valueInput = page.locator('[data-testid="stat-value-input"]');
    await valueInput.fill("77");
    await page.getByRole("button", { name: "Save value" }).click();
    await page.waitForTimeout(2500);

    const afterText = await page.innerText("body");
    if (afterText.includes("77")) {
      console.log("PASS  stat value edited in place");
    } else {
      errors.push("edited value not shown after save");
    }

    // --- The activity log should record the correction ---
    await page.goto(`${BASE}/l/demo-league/activity`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);
    const logText = await page.innerText("body");
    if (logText.includes("Activity") && logText.includes("Change log")) {
      console.log("PASS  activity log page renders");
    } else {
      errors.push("activity log page did not render");
    }
    if (logText.includes("77")) {
      console.log("PASS  activity log records the new value");
    } else {
      errors.push("activity log missing the new value");
    }
    if (logText.includes("High score")) {
      console.log("PASS  activity log describes what changed");
    } else {
      errors.push("activity log does not describe the change");
    }
  }

  // ---------------------------------------------------------------------
  // The activity log is admin-only
  // ---------------------------------------------------------------------
  await signOut(page);
  await login(page, "scorer@dartleague.test");
  await page.goto(`${BASE}/l/demo-league/activity`, { waitUntil: "networkidle" });
  const scorerActivity = await page.innerText("body");
  if (!scorerActivity.includes("Change log")) {
    console.log("PASS  scorer cannot open the activity log");
  } else {
    errors.push("scorer was able to open the activity log");
  }

  await browser.close();

  if (errors.length > 0) {
    console.log("\nFAILURES:");
    for (const e of errors) console.log("  - " + e);
    process.exit(1);
  }
  console.log("\nAll additions checks passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
