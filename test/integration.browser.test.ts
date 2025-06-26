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

      // Intercept WebSocket constructor to check parameters
      const originalWebSocket = window.WebSocket
      let wsConstructorCalls = []
      
      window.WebSocket = function(...args) {
        wsConstructorCalls.push(args.length)
        log('WebSocket constructor called with ' + args.length + ' parameters')
        return new originalWebSocket(...args)
      }

      const supabase = window.supabase.createClient(
        'http://127.0.0.1:54321',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
      )

      const channel = supabase.channel('realtime:public:todos')

      channel.subscribe((status) => {
        log('subscribe callback called with: ' + status)
      })

      setTimeout(() => {
        log('WebSocket calls: ' + JSON.stringify(wsConstructorCalls))
        log('subscribe callback NOT called (3s timeout)')
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

    // Bug: the callback was not called - let's check it explicitly
    assertStringIncludes(logContent, 'subscribe callback called with: SUBSCRIBED')
  })
})
