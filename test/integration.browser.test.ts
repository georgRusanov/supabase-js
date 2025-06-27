import { serve } from 'https://deno.land/std@0.192.0/http/server.ts'
import { describe, it, beforeAll, afterAll } from 'https://deno.land/std@0.224.0/testing/bdd.ts'
import { assertStringIncludes } from 'https://deno.land/std@0.224.0/testing/asserts.ts'
import { Browser, Page, launch } from 'npm:puppeteer@24.9.0'
import { sleep } from 'https://deno.land/x/sleep/mod.ts'

const stderr = 'inherit'
const ac = new AbortController()

let browser: Browser
let page: Page
const port = 8000

const contentUMD = `
<!DOCTYPE html>
<html>
  <body>
    <pre id="log" style="font-family: monospace"></pre>
    <script src="http://localhost:${port}/supabase.js"></script>
    <script>
      const log = (msg) => {
        document.getElementById('log').textContent += msg + "\\n"
        console.log(msg)
      }

      log('Starting UMD test...')

      // Intercept WebSocket constructor
      const originalWebSocket = window.WebSocket
      let wsConstructorCalls = []
      
      window.WebSocket = function(...args) {
        wsConstructorCalls.push(args.length)
        log('WebSocket constructor called with ' + args.length + ' parameters: ' + JSON.stringify(args))
        return new originalWebSocket(...args)
      }

      // Intercept fetch
      const originalFetch = window.fetch
      let fetchCalls = []
      
      window.fetch = function(...args) {
        fetchCalls.push(args[0])
        log('Fetch called with URL: ' + args[0])
        return originalFetch.apply(this, args)
      }

      // Intercept setTimeout/setInterval for polling
      const originalSetTimeout = window.setTimeout
      const originalSetInterval = window.setInterval
      let timeoutCalls = []
      let intervalCalls = []
      
      window.setTimeout = function(fn, delay, ...args) {
        timeoutCalls.push({fn: fn.toString().substring(0, 50), delay})
        log('setTimeout called with delay: ' + delay)
        return originalSetTimeout.apply(this, [fn, delay, ...args])
      }
      
      window.setInterval = function(fn, delay, ...args) {
        intervalCalls.push({fn: fn.toString().substring(0, 50), delay})
        log('setInterval called with delay: ' + delay)
        return originalSetInterval.apply(this, [fn, delay, ...args])
      }

      log('Creating Supabase client (UMD)...')
      const supabase = window.supabase.createClient(
        'http://127.0.0.1:54321',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
      )

      log('Creating channel...')
      const channel = supabase.channel('realtime:public:todos')

      log('Subscribing to channel...')
      channel.subscribe((status) => {
        log('UMD subscribe callback called with: ' + status)
      })

      setTimeout(() => {
        log('UMD WebSocket calls: ' + JSON.stringify(wsConstructorCalls))
        log('UMD Fetch calls: ' + JSON.stringify(fetchCalls))
        log('UMD setTimeout calls: ' + JSON.stringify(timeoutCalls))
        log('UMD setInterval calls: ' + JSON.stringify(intervalCalls))
      }, 3000)
    </script>
  </body>
</html>
`

const contentModule = `
<!DOCTYPE html>
<html>
  <body>
    <pre id="log" style="font-family: monospace"></pre>
    <script src="http://localhost:${port}/supabase.js"></script>
    <script>
      const log = (msg) => {
        document.getElementById('log').textContent += msg + "\\n"
        console.log(msg)
      }

      log('Starting Module test...')

      // Add global error handler
      window.addEventListener('error', (event) => {
        log('Global error: ' + event.message)
        log('Error source: ' + event.filename + ':' + event.lineno)
      })

      // Add unhandled promise rejection handler
      window.addEventListener('unhandledrejection', (event) => {
        log('Unhandled promise rejection: ' + event.reason)
      })

      try {
        log('Attempting to access createClient...')
        
        // Check if supabase is available
        if (typeof window.supabase === 'undefined') {
          throw new Error('window.supabase is not defined')
        }
        log('Supabase UMD loaded successfully')
        
        const { createClient } = window.supabase
        log('createClient function available')

        // Intercept WebSocket constructor
        const originalWebSocket = window.WebSocket
        let wsConstructorCalls = []
        
        window.WebSocket = function(...args) {
          wsConstructorCalls.push(args.length)
          log('WebSocket constructor called with ' + args.length + ' parameters: ' + JSON.stringify(args))
          return new originalWebSocket(...args)
        }

        // Intercept fetch
        const originalFetch = window.fetch
        let fetchCalls = []
        
        window.fetch = function(...args) {
          fetchCalls.push(args[0])
          log('Fetch called with URL: ' + args[0])
          return originalFetch.apply(this, args)
        }

        // Intercept setTimeout/setInterval for polling
        const originalSetTimeout = window.setTimeout
        const originalSetInterval = window.setInterval
        let timeoutCalls = []
        let intervalCalls = []
        
        window.setTimeout = function(fn, delay, ...args) {
          timeoutCalls.push({fn: fn.toString().substring(0, 50), delay})
          log('setTimeout called with delay: ' + delay)
          return originalSetTimeout.apply(this, [fn, delay, ...args])
        }
        
        window.setInterval = function(fn, delay, ...args) {
          intervalCalls.push({fn: fn.toString().substring(0, 50), delay})
          log('setInterval called with delay: ' + delay)
          return originalSetInterval.apply(this, [fn, delay, ...args])
        }

        log('Creating Supabase client (Module)...')
        const supabase = createClient(
          'http://127.0.0.1:54321',
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
        )

        log('Creating channel...')
        const channel = supabase.channel('realtime:public:todos')

        log('Subscribing to channel...')
        channel.subscribe((status) => {
          log('Module subscribe callback called with: ' + status)
        })

        setTimeout(() => {
          log('Module WebSocket calls: ' + JSON.stringify(wsConstructorCalls))
          log('Module Fetch calls: ' + JSON.stringify(fetchCalls))
          log('Module setTimeout calls: ' + JSON.stringify(timeoutCalls))
          log('Module setInterval calls: ' + JSON.stringify(intervalCalls))
        }, 3000)
      } catch (error) {
        log('Error in module test: ' + error.message)
        log('Error stack: ' + error.stack)
        log('Error name: ' + error.name)
      }
    </script>
  </body>
</html>
`

beforeAll(async () => {
  console.log('🚀 Starting supabase, installing, building...')
  await new Deno.Command('supabase', { args: ['start'], stderr }).output()
  await new Deno.Command('npm', { args: ['install'], stderr }).output()
  await new Deno.Command('npm', {
    args: ['run', 'build:umd', '--', '--mode', 'production'],
    stderr,
  }).output()

  serve(
    async (req) => {
      console.log('Server request:', req.url)
      if (req.url.endsWith('supabase.js')) {
        console.log('Serving supabase.js')
        const file = await Deno.readFile('./dist/umd/supabase.js')
        return new Response(file, {
          headers: { 'content-type': 'application/javascript' },
        })
      }
      if (req.url.includes('module')) {
        console.log('Serving module HTML')
        return new Response(contentModule, {
          headers: {
            'content-type': 'text/html',
            'cache-control': 'no-cache',
          },
        })
      }
      console.log('Serving UMD HTML')
      return new Response(contentUMD, {
        headers: {
          'content-type': 'text/html',
          'cache-control': 'no-cache',
        },
      })
    },
    { signal: ac.signal, port }
  )
})

afterAll(async () => {
  await ac.abort()
  await page?.close()
  await browser?.close()
  await sleep(1)
})

describe('UMD subscribe test', () => {
  beforeAll(async () => {
    browser = await launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })
    page = await browser.newPage()

    page.on('console', (msg) => console.log('🧪 BROWSER:', msg.text()))
  })

  it('should show callback called or not', async () => {
    await page.goto(`http://localhost:${port}`)
    await page.waitForSelector('#log', { timeout: 4000 })

    const logContent = await page.$eval('#log', (el) => el.textContent || '')
    console.log('Full log content:', logContent)

    assertStringIncludes(logContent, 'Starting UMD test...')
    assertStringIncludes(logContent, 'Creating Supabase client (UMD)...')
    assertStringIncludes(logContent, 'Creating channel...')
    assertStringIncludes(logContent, 'Subscribing to channel...')

    if (logContent.includes('WebSocket constructor called')) {
      console.log('WebSocket constructor was called')
    } else {
      console.log('WebSocket constructor was NOT called')
    }

    if (logContent.includes('Fetch called with URL:')) {
      console.log('HTTP requests were made (fetch calls detected)')
    } else {
      console.log('No HTTP requests detected')
    }

    if (logContent.includes('setTimeout called with delay:')) {
      console.log('setTimeout was used (setTimeout detected)')
    } else {
      console.log('No setTimeout detected')
    }

    if (logContent.includes('setInterval called with delay:')) {
      console.log('setInterval was used (setInterval detected)')
    } else {
      console.log('No setInterval detected')
    }

    assertStringIncludes(logContent, 'UMD subscribe callback called with: SUBSCRIBED')
  })

  it('should test module version', async () => {
    await page.goto(`http://localhost:${port}/module`)
    await page.waitForSelector('#log', { timeout: 4000 })

    const logContent = await page.$eval('#log', (el) => el.textContent || '')
    console.log('Module test log content:', logContent)

    assertStringIncludes(logContent, 'Starting Module test...')
    assertStringIncludes(logContent, 'Creating Supabase client (Module)...')
    assertStringIncludes(logContent, 'Creating channel...')
    assertStringIncludes(logContent, 'Subscribing to channel...')

    if (logContent.includes('WebSocket constructor called')) {
      console.log('Module: WebSocket constructor was called')
    } else {
      console.log('Module: WebSocket constructor was NOT called')
    }

    if (logContent.includes('Fetch called with URL:')) {
      console.log('Module: HTTP requests were made (fetch calls detected)')
    } else {
      console.log('Module: No HTTP requests detected')
    }

    if (logContent.includes('setTimeout called with delay:')) {
      console.log('Module: setTimeout was used (setTimeout detected)')
    } else {
      console.log('Module: No setTimeout detected')
    }

    if (logContent.includes('setInterval called with delay:')) {
      console.log('Module: setInterval was used (setInterval detected)')
    } else {
      console.log('Module: No setInterval detected')
    }

    assertStringIncludes(logContent, 'Module subscribe callback called with: SUBSCRIBED')
  })
})
