import { test, expect } from '@playwright/test';

test.describe('Reset Password', () => {
  test('submits valid new password and redirects', async ({ page }) => {
    await page.route('/api/forgot/reset-password', async (route) => {
      const req = route.request();
      const body = JSON.parse(req.postData() || '{}');
      expect(body.token).toBe('FAKE_TOKEN'); // token in URL
      expect(body.newPassword).toBeTruthy();
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Password reset successfully.' }),
      });
    });

    await page.goto('/reset-password?token=FAKE_TOKEN');

    // Fill both fields and submit
    await page.getByLabel(/new password/i).fill('NewPass123!');
    await page.getByLabel(/confirm password/i).fill('NewPass123!');
    await page.getByRole('button', { name: /reset password/i }).click();

    // Expect success toast then redirect to login (root)
    await expect(page.getByText(/password has been reset/i)).toBeVisible();
    await expect(page).toHaveURL('/');
  });

  test('shows “invalid/expired” message when token missing or API errors', async ({ page }) => {
    // no token => page should show invalid state
    await page.goto('/reset-password');
    await expect(page.getByText(/invalid or expired/i)).toBeVisible();

    await page.route('/api/forgot/reset-password', async (route) => {
      return route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Invalid or expired token' }),
      });
    });

    await page.goto('/reset-password?token=BADTOKEN');
    await expect(page.getByText(/invalid or expired/i)).toBeVisible();
  });

  test('client-side validation: mismatched passwords', async ({ page }) => {
    await page.goto('/reset-password?token=FAKE_TOKEN');

    await page.getByLabel(/new password/i).fill('NewPass123!');
    await page.getByLabel(/confirm password/i).fill('Nope123!');
    await page.getByRole('button', { name: /reset password/i }).click();

    await expect(page.getByText(/passwords do not match/i)).toBeVisible();
  });
});
