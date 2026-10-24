import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { visualizer } from 'rollup-plugin-visualizer'
import { execSync } from 'node:child_process'
import type { Plugin } from 'vite'

const shouldAnalyze = process.env.ANALYZE === 'true'

// Identifies each build: the commit plus build time, so rebuilding the same
// commit still counts as a new version.
function buildId() {
  let commit = 'local'
  try {
    commit = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
  } catch {
    // No git on this machine: the build time alone is enough.
  }
  return `${commit}-${Date.now().toString(36)}`
}

// Bakes the build ID into the app and publishes it as /version.json, so an
// open app can tell when a newer build has been deployed.
function appVersion(): Plugin {
  let version = 'dev'
  return {
    name: 'app-version',
    config(_, { command }) {
      if (command === 'build') version = buildId()
      return { define: { __APP_VERSION__: JSON.stringify(version) } }
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ version }),
      })
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    appVersion(),
    ...(shouldAnalyze
      ? [
          visualizer({
            filename: 'dist/stats.html',
            gzipSize: true,
            brotliSize: true,
            open: false,
          }),
        ]
      : []),
  ],
  resolve: {
    alias: { '@': '/src' },
  },
})
