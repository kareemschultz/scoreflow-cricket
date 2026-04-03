/**
 * Full match E2E test
 *
 * Flow:
 *   Teams + players → New match wizard (CUSTOM 1-over) →
 *   Score first innings (6 balls) → Innings break overlay →
 *   Select second-innings openers/bowler → Score second innings →
 *   Match complete → Export data → Clear data → Import data → Verify counts
 *
 * Navigation note: The app uses TanStack Router with createHashHistory().
 * All routes live behind the hash: e.g. /#/teams, /#/new-match.
 * page.goto() on the same origin only changes the hash (no full reload),
 * which TanStack Router does NOT pick up as a route change.
 * Use spaNavigate() instead — it sets window.location.hash directly,
 * which TanStack Router's hashchange listener handles correctly.
 */

import { test, expect, Page } from "@playwright/test"

const BASE = "/scoreflow-cricket"

async function clearDb(page: Page) {
  await page.evaluate(() => {
    return new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase("ScoreFlowCricketDB")
      req.onsuccess = () => resolve()
      req.onerror = () => resolve()
      req.onblocked = () => setTimeout(resolve, 100)
    })
  })
  await page.reload()
  await page.waitForLoadState("networkidle")
}

/** Navigate within the SPA by updating the hash fragment. */
async function spaNavigate(page: Page, route: string) {
  await page.evaluate((r) => { window.location.hash = r }, route)
  await page.waitForTimeout(300)
}

test.describe("Full match flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/`)
    await page.waitForLoadState("networkidle")
    await clearDb(page)
  })

  test("create teams, play a match, export and re-import", async ({ page }) => {
    // ── 1. Create Team Alpha with Alice + Bob ──────────────────────────────────
    await spaNavigate(page, "/teams")

    await page.locator("button", { hasText: "New Team" }).click()
    await page.locator("#team-name").fill("Team Alpha")
    await page.locator("button", { hasText: "Create Team" }).click()
    await expect(page.locator("text=Team Alpha").first()).toBeVisible({ timeout: 5000 })

    // Open roster — the Card component navigates on click
    await page.locator("text=Team Alpha").first().click()
    await page.waitForURL(/\/teams\//, { timeout: 5000 })

    // addPlayer: click → pressSequentially (fires real key events → React onChange fires reliably)
    // → wait for Add button to be enabled → click.
    // force:true bypasses Playwright's "element not stable" check during React re-renders.
    // fill() can fail to trigger React's synthetic onChange in some configurations (Base UI wrapper +
    // React 19); pressSequentially() dispatches keydown/keyup per character, always triggers onChange.
    async function addPlayer(name: string) {
      const input = page.locator("input[placeholder='Player name']")
      await input.click()
      await input.pressSequentially(name)
      await expect(page.locator("button").filter({ hasText: /^Add$/ })).toBeEnabled({ timeout: 5000 })
      await page.locator("button").filter({ hasText: /^Add$/ }).click({ force: true })
      await expect(page.locator(`text=${name}`).first()).toBeVisible({ timeout: 5000 })
    }

    await addPlayer("Alice")
    await addPlayer("Bob")

    // ── 2. Create Team Beta with Charlie + Diana ───────────────────────────────
    await spaNavigate(page, "/teams")

    await page.locator("button", { hasText: "New Team" }).click()
    await page.locator("#team-name").fill("Team Beta")
    await page.locator("button", { hasText: "Create Team" }).click()
    await expect(page.locator("text=Team Beta").first()).toBeVisible({ timeout: 5000 })

    await page.locator("text=Team Beta").first().click()
    await page.waitForURL(/\/teams\//, { timeout: 5000 })

    await addPlayer("Charlie")
    await addPlayer("Diana")

    // ── 3. New match wizard ────────────────────────────────────────────────────
    await spaNavigate(page, "/new-match")

    // Step 1 — Select teams.
    // TeamPicker renders both teams in each of the two side-by-side columns.
    // Teams are sorted alphabetically: Alpha < Beta.
    // first() = Team Alpha in left (Team A) column.
    // nth(1) = Team Beta in right (Team B) column.
    await page.locator("button").filter({ hasText: /^Team Alpha$/ }).first().click()
    await page.locator("button").filter({ hasText: /^Team Beta$/ }).nth(1).click()
    await page.locator("button", { hasText: "Next" }).click()

    // Step 2 — Format: CUSTOM, 1 over per innings.
    // Clicking Custom reveals 3 extra NumberRule inputs below "Players per side".
    // Index 0 = Players per side (always visible), index 1 = Overs per innings (CUSTOM only).
    await page.locator("button", { hasText: "Custom" }).click()
    const oversInput = page.locator("input[type='number']").nth(1)
    await oversInput.fill("1")
    await oversInput.press("Tab") // blur to commit
    await page.locator("button", { hasText: "Next" }).click()

    // Step 3 — Toss: Use manual selection section (nth(1) skips the coin-flip
    // "calling team" button and targets the manual toss-winner button).
    await page.locator("button").filter({ hasText: /^Team Alpha$/ }).nth(1).click()
    await page.locator("button", { hasText: "Bat" }).click()
    await page.locator("button", { hasText: "Next" }).click()

    // Step 4 — Playing XI: select 2 players per side.
    // Active tab starts on Team Alpha. Select Alice + Bob.
    await page.locator("button").filter({ hasText: "Alice" }).first().click()
    await page.locator("button").filter({ hasText: "Bob" }).first().click()
    // Switch to Team Beta tab (tab button text starts with "Team Beta").
    await page.locator("button").filter({ hasText: /^Team Beta/ }).first().click()
    await page.locator("button").filter({ hasText: "Charlie" }).first().click()
    await page.locator("button").filter({ hasText: "Diana" }).first().click()
    await page.locator("button", { hasText: "Next" }).click()

    // Step 5 — Openers: scope player buttons by their section header paragraph.
    // PlayerSelector renders: <div><p>{title}</p><div>{buttons}</div></div>
    // The CSS `p + div` adjacent-sibling combinator scopes buttons to the right section.
    await page
      .locator('p:has-text("Striker (on strike)") + div button:has-text("Alice")')
      .click()
    await page
      .locator('p:has-text("Non-striker") + div button:has-text("Bob")')
      .click()
    await page
      .locator('p:has-text("Opening bowler") + div button:has-text("Charlie")')
      .click()
    await page.locator("button", { hasText: "Start Match" }).click()

    // ── 4. Wait for scoring page and verify reload recovery ───────────────────
    // TanStack Router navigates to #/scoring after wizard completes.
    // waitForURL works here because it matches against the full URL (incl. hash).
    await page.waitForURL(/\/scoring/, { timeout: 15000 })
    await page.reload()
    await page.waitForLoadState("networkidle")
    await page.waitForURL(/\/scoring/, { timeout: 15000 })
    await expect(page.locator("text=Alice").first()).toBeVisible({ timeout: 5000 })
    await expect(page.locator("text=Bob").first()).toBeVisible({ timeout: 5000 })
    await expect(page.locator("text=Charlie").first()).toBeVisible({ timeout: 5000 })

    // ── 5. Score first innings — 6 × 1 run (1 over) ───────────────────────────
    // Run buttons are plain numbers (0–6) in a grid — no aria-labels.
    // Filter by exact text /^1$/ to avoid matching "1 over" or similar text.
    for (let i = 0; i < 6; i++) {
      await page.locator("button").filter({ hasText: /^1$/ }).first().click()
      await page.waitForTimeout(400) // allow ball processing
    }

    // After 1 over the app may either show the full-screen innings break overlay
    // or the inline "innings complete" action strip, depending on timing/recovery.
    const overlayButton = page.locator("button", { hasText: "Start 2nd Innings" }).first()
    const inlineButton = page.locator("button", { hasText: /Innings complete/ }).first()
    await expect.poll(
      async () => (await overlayButton.isVisible()) || (await inlineButton.isVisible()),
      { timeout: 8000 }
    ).toBe(true)
    if (await overlayButton.isVisible()) {
      await overlayButton.click()
    } else {
      await inlineButton.click()
    }

    // ── 6. Second innings — select openers ────────────────────────────────────
    // handleStartNextInnings (line 354) calls ui.setShowNewBatsmanSheet(true) immediately
    // after updating the innings — the striker sheet auto-opens, no action strip click needed.

    await expect(page.locator("text=Select Incoming Batsman").first()).toBeVisible({ timeout: 8000 })
    await page.locator("button", { hasText: "Charlie" }).first().click()

    // Bowler: auto-opened by handleNewBatsmanSelect (currentBowlerId === null at innings start).
    // After Charlie is selected, the handler immediately calls setShowNewBowlerSheet(true)
    // before the non-striker is set — bowler sheet appears first, not the action strip.
    await expect(page.locator("text=Select Next Bowler").first()).toBeVisible({ timeout: 5000 })
    await page.locator("button", { hasText: "Alice" }).first().click()

    // Non-striker: action strip "Select non-striker" button → opens sheet
    await expect(
      page.locator("button", { hasText: "Select non-striker" }).first()
    ).toBeVisible({ timeout: 5000 })
    await page.locator("button", { hasText: "Select non-striker" }).first().click()
    await expect(page.locator("text=Select Incoming Batsman").first()).toBeVisible({ timeout: 5000 })
    await page.locator("button", { hasText: "Diana" }).first().click()

    // ── 7. Score second innings ────────────────────────────────────────────────
    // Use 1-run balls here so strike swaps every delivery. This catches the old
    // non-striker bug immediately if offStrikeBatsmanId is not persisted/set.
    // The second innings ends when totalRuns >= target, so the loop exits early.
    for (let i = 0; i < 6; i++) {
      if (await page.locator("text=Match Result").isVisible()) break
      await page.locator("button").filter({ hasText: /^1$/ }).first().click()
      await page.waitForTimeout(400)
    }

    // MatchResultOverlay appears automatically after the innings ends
    await expect(page.locator("text=Match Result").first()).toBeVisible({ timeout: 8000 })

    // ── 8. Export data from settings ──────────────────────────────────────────
    await spaNavigate(page, "/settings")

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.locator("button", { hasText: "Export data as JSON" }).click(),
    ])
    const exportPath = await download.path()
    expect(exportPath).toBeTruthy()

    const fs = await import("fs")
    const exportContent = fs.readFileSync(exportPath!, "utf-8")
    const exportData = JSON.parse(exportContent) as Record<string, unknown>
    expect(exportData.schemaVersion).toBe(3)
    expect(Array.isArray(exportData.teams)).toBe(true)
    expect((exportData.teams as unknown[]).length).toBeGreaterThanOrEqual(2)
    expect(Array.isArray(exportData.players)).toBe(true)
    expect((exportData.players as unknown[]).length).toBeGreaterThanOrEqual(4)
    expect(Array.isArray(exportData.matches)).toBe(true)
    expect((exportData.matches as unknown[]).length).toBeGreaterThanOrEqual(1)

    // ── 9. Clear all data ──────────────────────────────────────────────────────
    await page.locator("button", { hasText: "Clear all data" }).click()
    await expect(page.locator("text=Clear all data?")).toBeVisible({ timeout: 3000 })
    await page.locator("button", { hasText: "Delete everything" }).click()
    await page.waitForTimeout(1000)

    // Verify teams are gone
    await spaNavigate(page, "/teams")
    await expect(page.locator("text=Team Alpha")).not.toBeVisible({ timeout: 3000 })

    // ── 10. Import back and verify ─────────────────────────────────────────────
    await spaNavigate(page, "/settings")

    await page.locator("button", { hasText: "Import" }).first().click()
    await expect(page.locator("text=Import data")).toBeVisible({ timeout: 3000 })

    // "Skip backup — Import" triggers a programmatic file input + alert on success.
    const dialogPromise = page.waitForEvent("dialog")
    const [fileChooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      page.locator("button", { hasText: "Skip backup — Import" }).click(),
    ])
    await fileChooser.setFiles(exportPath!)
    const dialog = await dialogPromise
    await dialog.accept()
    await page.waitForTimeout(500)

    // Verify teams are restored
    await spaNavigate(page, "/teams")
    await expect(page.locator("text=Team Alpha")).toBeVisible({ timeout: 5000 })
    await expect(page.locator("text=Team Beta")).toBeVisible({ timeout: 5000 })
  })
})
