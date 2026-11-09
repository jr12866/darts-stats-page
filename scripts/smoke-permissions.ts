import { chromium } from "playwright";

/**
 * Smoke test covering the read-only surfaces: dashboard tabs, admin areas,
 * platform admin and the player profile.
 * Run with the dev server on http://localhost:3000.
 */

const BASE = "http://localhost:3000";

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors: string[] = [];

  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));

  // --- Log in as the site owner ---
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill("#email", "owner@dartleague.test");
  await page.fill("#password", "dartleague");
  await Promise.all([
    page.waitForURL("**/leagues", { timeout: 30000 }),
    page.click('button[type="submit"]'),
  ]);
  console.log("PASS  logged in as site owner");

  // --- Platform admin ---
  await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
  const adminText = await page.innerText("body");
  if (adminText.includes("Site admin") && adminText.includes("Demo Dart League")) {
    console.log("PASS  platform admin lists leagues");
  } else {
    errors.push("platform admin page missing league list");
  }
  if (adminText.includes("Create league")) {
    console.log("PASS  platform admin can create leagues");
  } else {
    errors.push("platform admin missing create-league form");
  }

  // --- Player profile ---
  await page.goto(`${BASE}/l/demo-league?tab=players`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  const playerLink = page.locator('a[href*="/player/"]').first();
  if ((await playerLink.count()) === 0) {
    errors.push("no player links on the players tab");
  } else {
    await playerLink.click();
    await page.waitForURL("**/player/**", { timeout: 20000 });
    await page.waitForTimeout(1200);
    const cardText = await page.innerText("body");
    if (cardText.includes("Tracked stats")) {
      console.log("PASS  player profile renders stat card");
    } else {
      errors.push("player profile missing stat card");
    }
    if (cardText.includes("Night by night")) {
      console.log("PASS  player profile shows night history");
    } else {
      errors.push("player profile missing night history");
    }
  }

  // --- Season filter ---
  await page.goto(`${BASE}/l/demo-league?tab=standings`, {
    waitUntil: "networkidle",
  });
  await page.waitForTimeout(800);
  const seasonSelect = page.locator('select[name="season"]');
  if ((await seasonSelect.count()) > 0) {
    const options = await seasonSelect.locator("option").allTextContents();
    if (options.some((o) => o.includes("All time"))) {
      console.log("PASS  season filter present");
    } else {
      errors.push("season filter missing All time option");
    }
  } else {
    errors.push("season filter missing");
  }

  // --- Scorer permissions: a scorer must not reach league admin ---
  // Sign out first; the login page redirects away when already signed in.
  await page.goto(`${BASE}/leagues`, { waitUntil: "networkidle" });
  await page.locator('button:has-text("Sign out")').click();
  await page.waitForURL("**/login", { timeout: 20000 });
  await page.waitForTimeout(800);

  await page.fill("#email", "scorer@dartleague.test");
  await page.fill("#password", "dartleague");
  await Promise.all([
    page.waitForURL("**/leagues", { timeout: 30000 }),
    page.click('button[type="submit"]'),
  ]);
  await page.goto(`${BASE}/l/demo-league/admin`, { waitUntil: "networkidle" });
  const scorerAdminText = await page.innerText("body");
  if (
    scorerAdminText.includes("not found") ||
    scorerAdminText.includes("404") ||
    !scorerAdminText.includes("Tracked stats")
  ) {
    console.log("PASS  scorer cannot open league admin");
  } else {
    errors.push("scorer was able to open league admin");
  }

  await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
  const scorerSiteText = await page.innerText("body");
  if (!scorerSiteText.includes("Site admin")) {
    console.log("PASS  scorer cannot open site admin");
  } else {
    errors.push("scorer was able to open site admin");
  }

  // --- Scorer CAN enter results ---
  await page.goto(`${BASE}/l/demo-league/enter`, { waitUntil: "networkidle" });
  const enterText = await page.innerText("body");
  if (enterText.includes("Start a new night")) {
    console.log("PASS  scorer can reach the entry area");
  } else {
    errors.push("scorer could not reach the entry area");
  }

  await browser.close();

  if (errors.length > 0) {
    console.log("\nFAILURES:");
    for (const e of errors) console.log("  - " + e);
    process.exit(1);
  }
  console.log("\nAll read-only and permission checks passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
