import { expect, test, type Page } from "@playwright/test";
// Local Docker fixture has no service-role/browser-client dependency.
import { createLocalConnectedProjectionFixture } from "../../scripts/local-connected-projection-fixture.mjs";

const EMAIL = "active-subscriber@stockgpt.invalid";
const PASSWORD = "LocalStockGPT!2026";
async function ensureConnectedPortfolio() {
  return createLocalConnectedProjectionFixture().portfolio_id;
}

async function assertViewportFits(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
}

async function assertCanReachBottom(page: Page) {
  const reached = await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = "auto";
    const candidates = [
      document.scrollingElement,
      ...Array.from(document.querySelectorAll<HTMLElement>("main, [class*='overflow-y-auto']")),
    ].filter((item): item is HTMLElement => item instanceof HTMLElement);
    const scroller = candidates.find((item) => item.scrollHeight > item.clientHeight + 1);
    if (!scroller) return true;
    scroller.scrollTop = scroller.scrollHeight;
    return scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2;
  });
  expect(reached).toBe(true);
}

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/dashboard/u);
}

test("anonymous pricing remains scrollable at desktop and mobile widths", async ({ page }) => {
  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 390, height: 640 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/pricing");
    await assertViewportFits(page);
    await assertCanReachBottom(page);
  }
});

test("subscriber critical Portfolio journeys remain local, bounded and usable", async ({ page }) => {
  const connectedPortfolioId = await ensureConnectedPortfolio();
  const externalRequests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) externalRequests.push(url.href);
  });

  await login(page);
  await expect(page.getByText(/Dashboard|Good/u).first()).toBeVisible();
  await assertViewportFits(page);

  await page.goto("/portfolio/modern?portfolio=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1");
  await expect(page.getByRole("combobox", { name: "Selected portfolio" }))
    .toHaveValue("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1");
  await assertViewportFits(page);

  await page.goto("/portfolio/modern?portfolio=all-investments");
  await expect(page.getByText("All Investments").first()).toBeVisible();
  await assertViewportFits(page);

  await page.goto(`/portfolio/modern?portfolio=${connectedPortfolioId}`);
  await expect(page.getByText(/Synthetic Alpha Account|Connected/u).first()).toBeVisible();
  await assertViewportFits(page);

  await page.goto("/portfolio/connections");
  await expect(page.getByText("Connections are not available yet")).toBeVisible();

  await page.goto("/subscription");
  await expect(page.getByText(/Subscription|membership/u).first()).toBeVisible();
  await assertViewportFits(page);

  await page.setViewportSize({ width: 390, height: 640 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const route of ["/dashboard", "/portfolio/modern", "/portfolio/modern?portfolio=all-investments", "/notifications"]) {
    await page.goto(route);
    await assertViewportFits(page);
    await assertCanReachBottom(page);
  }
  expect(externalRequests).toEqual([]);
});
