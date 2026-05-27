import { test, expect } from '@playwright/test'

test.describe('E2E Authentication Bypass Flow', () => {
  test('should sign in successfully using test auth credentials bypass', async ({ page }) => {
    // Navigate to the sign-in page with test query parameter enabled
    await page.goto('/signin?test=true')

    // Verify presence of the test auth bypass panel
    await expect(page.locator('text=Test Environment Auth Bypass')).toBeVisible()

    // Select the email input and ensure default value is visible
    const emailInput = page.locator('input[name="email"]')
    await expect(emailInput).toHaveValue('test@waqasalee.com')

    // Submit the credentials form
    await page.click('button:has-text("Sign In as Mock User")')

    // Wait for redirection to dashboard (channels/long-form)
    await page.waitForURL('**/channels/long-form')

    // Confirm that the dashboard successfully loaded and the navigation bar shows user state
    await expect(page).toHaveURL(/.*channels\/long-form/)
    
    // Verify the visual dashboard layout is rendered
    await expect(page.locator('h1')).toBeVisible()
  })
})
