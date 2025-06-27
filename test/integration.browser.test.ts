import { serve } from 'https://deno.land/std@0.192.0/http/server.ts'
import { assertEquals } from 'https://deno.land/std@0.224.0/testing/asserts.ts'
import { describe, it, beforeAll, afterAll } from 'https://deno.land/std@0.224.0/testing/bdd.ts'
import { Browser, Page, launch } from 'npm:puppeteer@24.9.0'
import { sleep } from 'https://deno.land/x/sleep/mod.ts'
// Run the UMD build before serving the page
const stderr = 'inherit'
const ac = new AbortController()

let browser: Browser
let page: Page

const port = 8000
const content = `<html>
<body>
    <div id="output"></div>
    <div id="log" style="font-family: monospace; white-space: pre-wrap;"></div>
    <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
    <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
    <script src="http://localhost:${port}/supabase.js"></script>

    <script>
        // Перехват WebSocket конструктора для обнаружения ошибок
        const log = (msg) => {
            document.getElementById('log').textContent += msg + '\\n'
            console.log(msg)
        }

        log('Starting integration.browser.test with WebSocket monitoring...')

        // Add global error handler
        window.addEventListener('error', (event) => {
            log('Global error: ' + event.message)
            log('Error source: ' + event.filename + ':' + event.lineno)
        })

        // Add unhandled promise rejection handler
        window.addEventListener('unhandledrejection', (event) => {
            log('Unhandled promise rejection: ' + event.reason)
        })

        // Intercept WebSocket constructor
        const originalWebSocket = window.WebSocket
        let wsConstructorCalls = []

        window.WebSocket = function(...args) {
            wsConstructorCalls.push(args.length)
            log('WebSocket constructor called with ' + args.length + ' parameters: ' + JSON.stringify(args))
            return new originalWebSocket(...args)
        }

        // Intercept fetch for polling detection
        const originalFetch = window.fetch
        let fetchCalls = []

        window.fetch = function(...args) {
            fetchCalls.push(args[0])
            log('Fetch called with URL: ' + args[0])
            return originalFetch.apply(this, args)
        }

        // Log WebSocket calls after a delay
        setTimeout(() => {
            log('WebSocket calls: ' + JSON.stringify(wsConstructorCalls))
            log('Fetch calls: ' + JSON.stringify(fetchCalls))
        }, 3000)
    </script>

    <script type="text/babel" data-presets="env,react">
        const SUPABASE_URL = 'http://127.0.0.1:54321'
        const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
        const supabase = supabase.createClient(SUPABASE_URL, ANON_KEY, {
          realtime: {
            transport: window.WebSocket,
            heartbeatIntervalMs: 500,
          },
        })
        const App = (props) => {
            const [realtimeStatus, setRealtimeStatus] = React.useState(null)
            const channel = supabase.channel('realtime:public:todos')
            React.useEffect(() => {
                channel.subscribe((status) => { if (status === 'SUBSCRIBED') setRealtimeStatus(status) })

                return () => {
                    channel.unsubscribe()
                }
            }, [])
            if (realtimeStatus) {
                return <div id='realtime_status'>{realtimeStatus}</div>
            } else {
                return <div></div>
            }
        }
        ReactDOM.render(<App />, document.getElementById('output'));
    </script>
</body>
</html>
`

beforeAll(async () => {
  await new Deno.Command('supabase', { args: ['start'], stderr }).output()
  await new Deno.Command('npm', { args: ['install'], stderr }).output()
  await new Deno.Command('npm', {
    args: ['run', 'build:umd', '--', '--mode', 'production'],
    stderr,
  }).output()

  await new Deno.Command('npx', {
    args: ['puppeteer', 'browsers', 'install', 'chrome'],
    stderr,
  }).output()

  serve(
    async (req: any) => {
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
    { signal: ac.signal, port: port }
  )
})

afterAll(async () => {
  await ac.abort()
  await page.close()
  await browser.close()
  await sleep(1)
})

describe('Realtime integration test', () => {
  beforeAll(async () => {
    browser = await launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })
    page = await browser.newPage()
  })

  it('connects to realtime', async () => {
    await page.goto('http://localhost:8000')

    page.on('console', (msg) => console.log('BROWSER:', msg.text()))

    await page.waitForSelector('#realtime_status', { timeout: 10000 })
    const realtimeStatus = await page.$eval('#realtime_status', (el) => el.innerHTML)
    assertEquals(realtimeStatus, 'SUBSCRIBED')

    await new Promise((resolve) => setTimeout(resolve, 4000))
    const logContent = await page.$eval('#log', (el) => el.textContent || '')
    console.log('Integration browser test log content:', logContent)

    if (logContent.includes('WebSocket constructor called')) {
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
      logContent.includes('Global error:') ||
      logContent.includes('Unhandled promise rejection:') ||
      logContent.includes('WebSocket error:') ||
      logContent.includes('WebSocketException') ||
      logContent.includes('InvalidAccessError') ||
      logContent.includes('SyntaxError')
    ) {
      console.log('Integration browser test: ERRORS DETECTED - WebSocket-related error found!')
      throw new Error('JavaScript errors detected - WebSocket error detected!')
    }

    if (logContent.includes('WebSocket constructor called')) {
      console.log('Integration browser test: WebSocket constructor was called')
    } else {
      console.log('Integration browser test: WebSocket constructor was NOT called (using polling)')
    }

    if (logContent.includes('Fetch called with URL:')) {
      console.log('Integration browser test: HTTP polling detected')
    } else {
      console.log('Integration browser test: No HTTP polling detected')
    }
  })
})
