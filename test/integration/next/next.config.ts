import type { NextConfig } from 'next'
import path from 'path'

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    // Resolve workspace dependencies
    config.resolve.alias = {
      ...config.resolve.alias,
      '@supabase/supabase-js': path.resolve(__dirname, '../../../dist/module/index.js'),
    }

    return config
  },
}

export default nextConfig
