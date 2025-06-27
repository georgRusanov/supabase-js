import { test, expect } from '@playwright/test'

test.describe('WebSocket Browser Tests', () => {
  test('should test WebSocket transport and catch realtime-js 2.11.13 error', async ({ page }) => {
    // Navigate to our test page
    await page.goto('http://localhost:8002')

    // Wait for the log element to appear
    await expect(page.getByTestId('log')).toBeVisible()

    // Wait for the test to complete
    await page.waitForTimeout(5000)

    // Get the log content
    const logContent = await page.getByTestId('log').textContent()
    console.log('WebSocket test log content:', logContent)

    // Check for WebSocket constructor calls
    if (logContent?.includes('WebSocket constructor called')) {
      console.log('WebSocket: WebSocket constructor was called')

      if (logContent.includes('WebSocket constructor called with 3 parameters')) {
        console.log(
          'WebSocket: ERROR - WebSocket called with 3 parameters (should fail in browser)'
        )
        console.log('WebSocket: This is the realtime-js 2.11.13 WebSocket error!')

        // This should fail the test if we detect the error
        throw new Error(
          'WebSocket constructor called with 3 parameters - realtime-js 2.11.13 error detected!'
        )
      } else {
        console.log('WebSocket: WebSocket called with correct number of parameters')
      }
    } else {
      console.log('WebSocket: WebSocket constructor was NOT called')
    }

    // Check for errors
    if (
      logContent?.includes('Global error:') ||
      logContent?.includes('Unhandled promise rejection:')
    ) {
      console.log(
        'WebSocket: ERRORS DETECTED - This might be the realtime-js 2.11.13 WebSocket error!'
      )
      throw new Error('JavaScript errors detected - realtime-js 2.11.13 error detected!')
    }

    // Verify subscription worked
    expect(logContent).toContain('WebSocket subscribe callback called with: SUBSCRIBED')
  })
})
