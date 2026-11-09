import { chromium } from "playwright";

/**
 * End-to-end smoke test of the main flows.
 * Run with the dev server on http://localhost:3000.
 */

const BASE = "http://localhost:3000";

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors: string[] = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
  });
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));

  // --- Log in ---
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill("#email", "admin@dartleague.test");
  await page.fill("#password", "dartleague");
  await Promise.all([
    page.waitForURL("**/leagues", { timeout: 30000 }),
    page.click('button[type="submit"]'),
  ]);
  console.log("PASS  login redirects to /leagues");

  await page.waitForSelector("text=Demo Dart League", { timeout: 15000 });
  console.log("PASS  league appears in list");

  // --- Open the league dashboard ---
  await Promise.all([
    page.waitForURL("**/l/demo-league*", { timeout: 30000 }),
    page.click("text=Demo Dart League"),
  ]);
  await page.waitForSelector("text=Team standings", { timeout: 20000 });
  console.log("PASS  dashboard shows team standings");

  const bodyText = await page.innerText("body");
  if (bodyText.includes("Team Alpha") && bodyText.includes("Team Bravo")) {
    console.log("PASS  teams listed in standings");
  } else {
    errors.push("teams missing from standings");
  }

  // --- Player standings tab ---
  await page.click('a:has-text("Players")');
  await page.waitForSelector("text=Player standings", { timeout: 20000 });
  const playerText = await page.innerText("body");
  if (playerText.includes("Alex Rivera")) {
    console.log("PASS  player standings lists players");
  } else {
    errors.push("players missing from player standings");
  }

  // --- High scores tab ---
  await page.click('a:has-text("High Scores")');
  await page.waitForTimeout(1500);
  const highText = await page.innerText("body");
  if (highText.includes("High Scores") || highText.includes("No high scores")) {
    console.log("PASS  high scores tab renders");
  } else {
    errors.push("high scores tab did not render");
  }

  // --- Results tab ---
  await page.click('a:has-text("Results")');
  await page.waitForTimeout(1500);
  const resultsText = await page.innerText("body");
  if (resultsText.includes("Singles 501") || resultsText.includes("No results")) {
    console.log("PASS  results tab renders");
  } else {
    errors.push("results tab did not render");
  }

  // --- Admin area ---
  await page.goto(`${BASE}/l/demo-league/admin`, { waitUntil: "networkidle" });
  const adminText = await page.innerText("body");
  if (adminText.includes("Division 1")) {
    console.log("PASS  admin area renders with groups");
  } else {
    errors.push("admin area missing group data");
  }

  await browser.close();

  if (errors.length > 0) {
    console.log("\nFAILURES:");
    for (const e of errors) console.log("  - " + e);
    process.exit(1);
  }
  console.log("\nAll smoke checks passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
