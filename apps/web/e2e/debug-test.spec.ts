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

async function spaNavigate(page: Page, route: string) {
  await page.evaluate((r) => { window.location.hash = r }, route)
  await page.waitForTimeout(300)
}

test("debug player add", async ({ page }) => {
  await page.goto(BASE + "/")
  await page.waitForLoadState("networkidle")
  await clearDb(page)

  // Create Team Alpha
  await spaNavigate(page, "/teams")
  await page.locator("button", { hasText: "New Team" }).click()
  await page.locator("#team-name").fill("Team Alpha")
  await page.locator("button", { hasText: "Create Team" }).click()
  await expect(page.locator("text=Team Alpha").first()).toBeVisible({ timeout: 5000 })

  // Navigate to roster
  await page.locator("text=Team Alpha").first().click()
  await page.waitForURL(/\/teams\//, { timeout: 5000 })
  await page.waitForTimeout(500)  // wait for page render

  console.log("URL after nav to roster:", page.url())
  const btns = await page.locator("button").allTextContents()
  console.log("Buttons on roster:", btns)

  // Try adding Alice
  const input = page.locator("input[placeholder='Player name']")
  await input.fill("Alice")
  await page.waitForTimeout(100)

  const addBtn = page.locator("button").filter({ hasText: /^Add$/ })
  const btnEnabled = await addBtn.isEnabled()
  console.log("Add button enabled after fill:", btnEnabled)

  const inputVal = await input.inputValue()
  console.log("Input value after fill:", inputVal)

  // Try clicking with force
  await addBtn.click({ force: true })
  await page.waitForTimeout(500)

  const btns2 = await page.locator("button").allTextContents()
  console.log("Buttons after click:", btns2)

  const bodyText = await page.locator("body").textContent()
  console.log("Body (first 300):", bodyText?.substring(0, 300))
})
