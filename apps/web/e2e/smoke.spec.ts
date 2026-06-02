import { expect, test } from '@playwright/test';

// Pre-acknowledge the 21+ age gate so storefront content is unobstructed.
const ageVerified = () =>
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('weedtip:age-verified', 'true');
    });
  });

test.describe('public storefront', () => {
  ageVerified();

  test('home renders brand + primary nav', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Weedtip/);
    await expect(page.getByRole('link', { name: 'Weedtip home' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Dispensaries' }).first()).toBeVisible();
  });

  test('dispensaries page lists seeded shops', async ({ page }) => {
    await page.goto('/dispensaries');
    await expect(page.getByText('Green Leaf NYC')).toBeVisible();
    await expect(page.getByText('Emerald Collective SF')).toBeVisible();
  });

  test('products page shows catalog items', async ({ page }) => {
    await page.goto('/products');
    await expect(page.getByText(/OG Kush|Blue Dream|Sour Diesel/).first()).toBeVisible();
  });

  test('a dispensary detail page renders its menu', async ({ page }) => {
    await page.goto('/dispensary/green-leaf-nyc');
    await expect(page.getByRole('heading', { name: 'Green Leaf NYC' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Menu' })).toBeVisible();
  });

  test('terms page renders legal content', async ({ page }) => {
    await page.goto('/terms');
    await expect(page.getByRole('heading', { name: 'Terms of Service' })).toBeVisible();
  });

  test('protected owner dashboard redirects anonymous users away', async ({ page }) => {
    await page.goto('/dashboard');
    // Middleware/guards send unauthenticated users to sign-in or home.
    await expect(page).toHaveURL(/\/(sign-in|)(\?.*)?$/);
    await expect(page.getByRole('link', { name: 'Weedtip home' })).toBeVisible();
  });
});

test('age gate blocks first-time visitors', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('dialog')).toBeVisible();
});
