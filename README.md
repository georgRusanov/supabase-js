# `supabase-js` - Isomorphic JavaScript Client for Supabase.

- **Documentation:** https://supabase.com/docs/reference/javascript/start
- TypeDoc: https://supabase.github.io/supabase-js/v2/

## Usage

First of all, you need to install the library:

```sh
npm install @supabase/supabase-js
```

Then you're able to import the library and establish the connection with the database:

```js
import { createClient } from '@supabase/supabase-js'

// Create a single supabase client for interacting with your database
const supabase = createClient('https://xyzcompany.supabase.co', 'public-anon-key')
```

### UMD

You can use plain `<script>`s to import supabase-js from CDNs, like:

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
```

or even:

```html
<script src="https://unpkg.com/@supabase/supabase-js@2"></script>
```

Then you can use it from a global `supabase` variable:

```html
<script>
  const { createClient } = supabase
  const _supabase = createClient('https://xyzcompany.supabase.co', 'public-anon-key')

  console.log('Supabase Instance: ', _supabase)
  // ...
</script>
```

### ESM

You can use `<script type="module">` to import supabase-js from CDNs, like:

```html
<script type="module">
  import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'
  const supabase = createClient('https://xyzcompany.supabase.co', 'public-anon-key')

  console.log('Supabase Instance: ', supabase)
  // ...
</script>
```

### Deno

You can use supabase-js in the Deno runtime via [JSR](https://jsr.io/@supabase/supabase-js):

```js
import { createClient } from 'jsr:@supabase/supabase-js@2'
```

### Custom `fetch` implementation

`supabase-js` uses the [`cross-fetch`](https://www.npmjs.com/package/cross-fetch) library to make HTTP requests, but an alternative `fetch` implementation can be provided as an option. This is most useful in environments where `cross-fetch` is not compatible, for instance Cloudflare Workers:

```js
import { createClient } from '@supabase/supabase-js'

// Provide a custom `fetch` implementation as an option
const supabase = createClient('https://xyzcompany.supabase.co', 'public-anon-key', {
  global: {
    fetch: (...args) => fetch(...args),
  },
})
```

## Testing

### Unit Testing

```bash
pnpm test
```

### Integration Testing

```bash
supabase start
pnpm run test:integration
```

### Expo Testing

The project includes Expo integration tests to ensure compatibility with React Native environments.

### Next.js Testing

The project includes Next.js integration tests to ensure compatibility with React SSR environments.

### Deno Testing

The project includes Deno integration tests to ensure compatibility with Deno runtime.

#### CI/CD Testing

When running on CI, the tests automatically use the latest dependencies from the root project. The CI pipeline:

1. Builds the main project with current dependencies
2. Creates a package archive (`.tgz`) with the latest versions
3. Uses this archive in Expo, Next.js, and Deno tests to ensure consistency

#### Local Development

For local development of Expo, Next.js, and Deno tests, you may need to manually update dependencies:

```bash
# Update dependencies in the root project
npm install @supabase/realtime-js@latest

# Rebuild and create new package archive
npm run build && npm pack

# Copy the new archive to Expo tests
cp supabase-supabase-js-*.tgz test/integration/expo/supabase-supabase-js-0.0.0-automated.tgz

# Copy the new archive to Next.js tests
cp supabase-supabase-js-*.tgz test/integration/next/supabase-supabase-js-0.0.0-automated.tgz

# Copy the new archive to Deno tests
cp supabase-supabase-js-*.tgz test/deno/supabase-supabase-js-0.0.0-automated.tgz

# Update Expo test dependencies
cd test/integration/expo && npm install

# Update Next.js test dependencies
cd test/integration/next && pnpm install

# Update Deno test dependencies
cd test/deno && npm install
```

**Note:** The CI automatically handles dependency synchronization, so manual updates are only needed for local development and testing.

## Badges

[![Coverage Status](https://coveralls.io/repos/github/supabase/supabase-js/badge.svg?branch=master)](https://coveralls.io/github/supabase/supabase-js?branch=master)
