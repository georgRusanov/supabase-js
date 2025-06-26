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

const content = `
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

      log('Starting test...')

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

      // Intercept EventSource (Server-Sent Events)
      const originalEventSource = window.EventSource
      let eventSourceCalls = []
      
      if (window.EventSource) {
        window.EventSource = function(...args) {
          eventSourceCalls.push(args[0])
          log('EventSource called with URL: ' + args[0])
          return new originalEventSource(...args)
        }
      }

      // Intercept Worker creation
      const originalWorker = window.Worker
      let workerCalls = []
      
      if (window.Worker) {
        window.Worker = function(...args) {
          workerCalls.push(args[0])
          log('Worker created with URL: ' + args[0])
          return new originalWorker(...args)
        }
      }

      // Intercept XMLHttpRequest for potential fallback
      const originalXHR = window.XMLHttpRequest
      let xhrCalls = []
      
      window.XMLHttpRequest = function() {
        const xhr = new originalXHR()
        const originalOpen = xhr.open
        xhr.open = function(method, url, ...args) {
          xhrCalls.push(url)
          log('XMLHttpRequest opened: ' + method + ' ' + url)
          return originalOpen.apply(this, [method, url, ...args])
        }
        return xhr
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

      log('Creating Supabase client...')
      const supabase = window.supabase.createClient(
        'http://127.0.0.1:54321',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
      )

      log('Creating channel...')
      const channel = supabase.channel('realtime:public:todos')

      // Log channel internals
      log('Channel type: ' + typeof channel)
      log('Channel keys: ' + Object.keys(channel || {}))
      
      if (channel) {
        log('Channel topic: ' + (channel.topic || 'undefined'))
        log('Channel state: ' + (channel.state || 'undefined'))
        log('Channel joinedOnce: ' + (channel.joinedOnce || 'undefined'))
      }

      // Log realtime client internals
      log('Realtime client type: ' + typeof supabase.realtime)
      log('Realtime client keys: ' + Object.keys(supabase.realtime || {}))
      
      if (supabase.realtime) {
        log('Realtime transport: ' + (supabase.realtime.transport || 'undefined'))
        log('Realtime connection state: ' + (supabase.realtime.connectionState ? supabase.realtime.connectionState() : 'undefined'))
        log('Realtime is connected: ' + (supabase.realtime.isConnected ? supabase.realtime.isConnected() : 'undefined'))
      }

      log('Subscribing to channel...')
      channel.subscribe((status) => {
        log('subscribe callback called with: ' + status)
        
        // Check connection state after subscription
        setTimeout(() => {
          log('After subscription - Realtime transport: ' + (supabase.realtime.transport || 'undefined'))
          log('After subscription - Realtime connection state: ' + (supabase.realtime.connectionState ? supabase.realtime.connectionState() : 'undefined'))
          log('After subscription - Realtime is connected: ' + (supabase.realtime.isConnected ? supabase.realtime.isConnected() : 'undefined'))
          log('After subscription - Realtime conn: ' + (supabase.realtime.conn ? 'exists' : 'null'))
        }, 1000)
      })

      setTimeout(() => {
        log('WebSocket calls: ' + JSON.stringify(wsConstructorCalls))
        log('Fetch calls: ' + JSON.stringify(fetchCalls))
        log('EventSource calls: ' + JSON.stringify(eventSourceCalls))
        log('Worker calls: ' + JSON.stringify(workerCalls))
        log('XMLHttpRequest calls: ' + JSON.stringify(xhrCalls))
        log('setTimeout calls: ' + JSON.stringify(timeoutCalls))
        log('setInterval calls: ' + JSON.stringify(intervalCalls))
        log('Final log content: ' + document.getElementById('log').textContent)
      }, 3000)
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
      if (req.url.endsWith('supabase.js')) {
        const file = await Deno.readFile('./dist/umd/supabase.js')
        return new Response(file, {
          headers: { 'content-type': 'application/javascript' },
        })
      }
      return new Response(content, {
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

    assertStringIncludes(logContent, 'Starting test...')
    assertStringIncludes(logContent, 'Creating Supabase client...')
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

    if (logContent.includes('EventSource called with URL:')) {
      console.log('Server-Sent Events were used (EventSource detected)')
    } else {
      console.log('No Server-Sent Events detected')
    }

    if (logContent.includes('Worker created with URL:')) {
      console.log('Web Worker was created')
    } else {
      console.log('No Web Worker detected')
    }

    if (logContent.includes('XMLHttpRequest opened:')) {
      console.log('XMLHttpRequest was used (XMLHttpRequest detected)')
    } else {
      console.log('No XMLHttpRequest detected')
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

    assertStringIncludes(logContent, 'subscribe callback called with: SUBSCRIBED')
  })
})
