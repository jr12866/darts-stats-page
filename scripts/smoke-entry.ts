import { chromium } from "playwright";

/**
 * End-to-end smoke test of the match entry flow.
 * Run with the dev server on http://localhost:3000.
 */

const BASE = "http://localhost:3000";

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors: string[] = [];

  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill("#email", "admin@dartleague.test");
  await page.fill("#password", "dartleague");
  await Promise.all([
    page.waitForURL("**/leagues", { timeout: 30000 }),
    page.click('button[type="submit"]'),
  ]);
  console.log("PASS  logged in");

  // --- Enter area ---
  await page.goto(`${BASE}/l/demo-league/enter`, { waitUntil: "networkidle" });
  const enterText = await page.innerText("body");
  if (enterText.includes("Start a new night")) {
    console.log("PASS  enter area renders with new-night form");
  } else {
    errors.push("enter area missing new night form");
  }

  // --- Create a night ---
  const before = await page.locator('a:has-text("Enter →")').count();
  await page.fill('input[name="date"]', "2026-11-05");
  await page.click('button:has-text("Create night")');
  await page.waitForTimeout(2500);
  const after = await page.locator('a:has-text("Enter →")').count();
  if (after > before) {
    console.log(`PASS  night created (matches ${before} -> ${after})`);
  } else {
    errors.push(`night creation did not add matches (${before} -> ${after})`);
  }

  // --- Open a match ---
  // Pick the first match of the most recently created night (the one we
  // just made), which has no players assigned yet.
  const enterHref = await page
    .locator('a:has-text("Enter →")')
    .first()
    .getAttribute("href");
  if (!enterHref) {
    errors.push("no match links found on the enter page");
  }
  await page.goto(`${BASE}${enterHref}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  let text = await page.innerText("body");
  if (text.includes("Who played?")) {
    console.log("PASS  match entry shows participant picker");
  } else {
    errors.push("match entry missing participant picker");
  }
  if (text.includes("Leg 1")) {
    console.log("PASS  match entry shows legs");
  } else {
    errors.push("match entry missing legs");
  }

  // --- Pick players ---
  // The picker is open by default only when nobody is selected. If it is
  // closed, open it before looking for checkboxes.
  let boxes = page.locator('input[name="sideA"]:visible');
  if ((await boxes.count()) === 0) {
    await page.locator("button", { hasText: /edit players/i }).first().click();
    await page.waitForTimeout(800);
    boxes = page.locator('input[name="sideA"]:visible');
  }
  if ((await boxes.count()) === 0) {
    errors.push("no visible player checkboxes");
    console.log("      DEBUG: no visible sideA checkboxes");
  } else {
    await boxes.first().check();
    // Pick a different player for side B - the picker disables anyone already
    // chosen on the other side.
    const sideBBoxes = page.locator('input[name="sideB"]:not([disabled])');
    const sideBCount = await sideBBoxes.count();
    if (sideBCount > 0) {
      await sideBBoxes.first().check();
    }
    await page.click('button:has-text("Save players")');
    await page.waitForTimeout(2500);
    text = await page.innerText("body");
    const selMatch = text.match(/\d+ vs \d+ selected/);
    if (selMatch) {
      console.log("PASS  players saved");
    } else {
      errors.push("players did not appear to save");
    }
  }

  // --- Record a leg result ---
  const sideButtons = page.locator('button[name="winningSide"]');
  await sideButtons.first().click();
  await page.waitForTimeout(2500);
  text = await page.innerText("body");
  if (/Side A won/i.test(text)) {
    console.log("PASS  leg result saved");
  } else {
    errors.push("leg result not shown after save");
  }

  // --- Add a high score ---
  // Open the high score form for the first leg specifically.
  await page
    .locator('button:has-text("+ Add high score (leg 1)")')
    .first()
    .click();
  await page.waitForTimeout(600);

  const statSelect = page.locator('select[name="statDefId"]').first();
  const options = await statSelect.locator("option").allTextContents();
  const valueOption = options.find((o) => o.includes("(value)"));
  if (valueOption) {
    // Pick the player too - the form requires both.
    const playerSelect = page.locator('select[name="playerId"]').first();
    const playerOptions = await playerSelect.locator("option").allTextContents();
    const playerName = playerOptions.find((o) => o !== "Player…");
    if (!playerName) {
      errors.push("no players available in the stat form");
    } else {
      await playerSelect.selectOption({ label: playerName });
    }
    await statSelect.selectOption({ label: valueOption });
    await page.locator('input[name="value"]').first().fill("140");
    await page.getByRole("button", { name: "Record stat" }).click();
    await page.waitForTimeout(2500);
    text = await page.innerText("body");
    // Look for a rendered table row holding the value, not the form input.
    const savedRow = page
      .locator("table tbody tr")
      .filter({ hasText: valueOption.replace(" (value)", "") })
      .filter({ hasText: "140" });
    if ((await savedRow.count()) > 0) {
      console.log("PASS  high score recorded");
    } else {
      errors.push("high score row not shown after save");
    }
  } else {
    console.log("SKIP  no value-type stat configured");
  }

  // --- Enter points ---
  const pointsInput = page.locator('input[name="points"]').first();
  await pointsInput.fill("7");
  await page.locator('button:has-text("Save")').first().click();
  await page.waitForTimeout(2500);
  const pointsValue = await page
    .locator('input[name="points"]')
    .first()
    .inputValue();
  if (pointsValue === "7") {
    console.log("PASS  points saved");
  } else {
    errors.push(`points not persisted (input shows "${pointsValue}")`);
  }

  // --- Dashboard reflects the entry ---
  await page.goto(`${BASE}/l/demo-league?tab=players`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  text = await page.innerText("body");
  if (text.includes("Player standings")) {
    console.log("PASS  player standings render");
  } else {
    errors.push("player standings did not render");
  }

  await page.goto(`${BASE}/l/demo-league?tab=highscores`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  text = await page.innerText("body");
  if (text.includes("140")) {
    console.log("PASS  high score board shows the recorded value");
  } else {
    errors.push("high score board missing recorded value");
  }

  await browser.close();

  if (errors.length > 0) {
    console.log("\nFAILURES:");
    for (const e of errors) console.log("  - " + e);
    process.exit(1);
  }
  console.log("\nAll entry-flow checks passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
