import { test, expect } from '@playwright/test'

test.describe('WebSocket Browser Tests', () => {
  test('should test WebSocket transport and catch realtime-js 2.11.13 error', async ({ page }) => {
    await page.goto('/')

    await expect(page.locator('#log')).toBeVisible()

    await page.waitForTimeout(5000)

    const logContent = await page.locator('#log').textContent()
    console.log('WebSocket test log content:', logContent)

    if (logContent?.includes('WebSocket constructor called')) {
      const wsCallMatch = logContent.match(/WebSocket constructor called with (\d+) parameters/)
      if (wsCallMatch) {
        const paramCount = parseInt(wsCallMatch[1])

        if (paramCount === 0) {
          throw new Error(
            'WebSocket constructor called with 0 parameters - invalid WebSocket usage!'
          )
        }
        if (paramCount > 2) {
          throw new Error(
            `WebSocket constructor called with ${paramCount} parameters - invalid WebSocket usage! (browsers only support 1-2 parameters)`
          )
        }

        const wsParamsMatch = logContent.match(
          /WebSocket constructor called with \d+ parameters: (\[.*?\])/
        )
        if (wsParamsMatch) {
          try {
            const params = JSON.parse(wsParamsMatch[1])

            if (params[0] && typeof params[0] !== 'string') {
              throw new Error(
                `WebSocket constructor called with invalid URL type: ${typeof params[0]} (expected string)`
              )
            }

            if (params[1] && typeof params[1] !== 'string' && !Array.isArray(params[1])) {
              throw new Error(
                `WebSocket constructor called with invalid protocols type: ${typeof params[1]} (expected string or array)`
              )
            }

            if (params[2]) {
              throw new Error(
                `WebSocket constructor called with 3rd parameter (options) - not supported in browsers!`
              )
            }
          } catch (parseError) {
            throw new Error(
              `WebSocket constructor called with unparseable parameters: ${wsParamsMatch[1]}`
            )
          }
        }
      }
    }

    if (
      logContent?.includes('Global error:') ||
      logContent?.includes('Unhandled promise rejection:') ||
      logContent?.includes('WebSocket error:') ||
      logContent?.includes('WebSocketException') ||
      logContent?.includes('InvalidAccessError') ||
      logContent?.includes('SyntaxError')
    ) {
      console.log('WebSocket: ERRORS DETECTED - WebSocket-related error found!')
      throw new Error('JavaScript errors detected - WebSocket error detected!')
    }

    // Проверяем что WebSocket конструктор был вызван
    if (!logContent?.includes('WebSocket constructor called')) {
      console.log('WebSocket: WebSocket constructor was NOT called')
      // Это может быть нормально, если используется polling
    } else {
      console.log('WebSocket: WebSocket constructor was called correctly')
    }

    // Verify subscription worked
    expect(logContent).toContain('WebSocket subscribe callback called with: SUBSCRIBED')
  })
})
