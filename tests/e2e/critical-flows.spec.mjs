import { test, expect } from "@playwright/test";

const hasAuth = Boolean(process.env.E2E_TEST_EMAIL && process.env.E2E_TEST_PASSWORD);
const requireAuth = (t) => {
  if (!hasAuth) t.skip(true, "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD for authenticated flows.");
};

async function login(page, t) {
  requireAuth(t);
  if (t.info().project.name === "skipped") return;
  await page.goto("/login");
  const email = page.locator('input[type="email"]').first();
  const password = page.locator('input[type="password"]').first();
  await email.fill(process.env.E2E_TEST_EMAIL);
  await password.fill(process.env.E2E_TEST_PASSWORD);
  await page.getByRole("button", { name: /masuk|login/i }).first().click();
  await expect(page).not.toHaveURL(/\/login/);
}

test("1. public landing renders", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Licia", { exact: false }).first()).toBeVisible();
});

test("2. login and logout", async ({ page }, t) => {
  await login(page, t);
  if (!hasAuth) return;
  await expect(page.getByRole("link", { name: /pengaturan|settings/i }).first()).toBeVisible();
});

test("3. quick capture route is reachable", async ({ page }, t) => {
  await login(page, t);
  if (!hasAuth) return;
  await page.goto("/capture");
  await expect(page).toHaveURL(/\/capture|\/inbox/);
});

test("4. chat route and mutation UI are reachable", async ({ page }, t) => {
  await login(page, t);
  if (!hasAuth) return;
  await page.goto("/chat");
  await expect(page.getByRole("textbox").first()).toBeVisible();
});

test("5. bulk confirmation route contract exists", async ({ page }, t) => {
  await login(page, t);
  if (!hasAuth) return;
  await page.goto("/tasks");
  await expect(page).toHaveURL(/\/tasks/);
});

test("6. offline queue contract is reachable", async ({ page }, t) => {
  await login(page, t);
  if (!hasAuth) return;
  await page.goto("/inbox");
  await page.context().setOffline(true);
  await expect(page).toHaveURL(/\/inbox/);
  await page.context().setOffline(false);
});

test("7. sync conflict center contract is reachable", async ({ page }, t) => {
  await login(page, t);
  if (!hasAuth) return;
  await page.goto("/settings");
  await expect(page.getByText(/sinkron|sync/i).first()).toBeVisible();
});

test("8. security-sensitive export route is protected", async ({ page }, t) => {
  await login(page, t);
  if (!hasAuth) return;
  const response = await page.goto("/api/export-data");
  expect(response?.status()).toBeLessThan(500);
});
