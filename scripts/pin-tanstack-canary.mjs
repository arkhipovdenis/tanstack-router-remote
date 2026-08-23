// Repoints every pinned TanStack Router dependency at a target dist-tag
// (default: latest) so CI can run the verification against a version the
// repository does not pin.
//
// Since the migration to pnpm every workspace resolves these through the
// `catalog:` in pnpm-workspace.yaml, so a single file holds the pins and the
// per-manifest rewriting this script used to do is unnecessary. The adapter's
// open peer ranges live in package.json and are deliberately left alone: those
// ranges are the contract under test.
//
// All three framework routers are covered. Each declares its own compatible
// `@tanstack/router-core`, so a release that moves only one of them is exactly
// the drift this job exists to surface.
//
// Usage: node scripts/pin-tanstack-canary.mjs [dist-tag]
// Writes the resolved versions to $GITHUB_OUTPUT when running in Actions.

import { appendFile, readFile, writeFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const run = promisify(execFile)

const PACKAGES = [
  '@tanstack/react-router',
  '@tanstack/router-core',
  '@tanstack/solid-router',
  '@tanstack/vue-router',
  '@tanstack/router-plugin',
  '@tanstack/router-generator',
  '@tanstack/virtual-file-routes',
]

const distTag = process.argv[2] ?? 'latest'
const repoRoot = fileURLToPath(new URL('../', import.meta.url))
const workspaceFile = `${repoRoot}pnpm-workspace.yaml`

const resolved = new Map(
  await Promise.all(
    PACKAGES.map(async (name) => {
      const { stdout } = await run('npm', [
        'view',
        `${name}@${distTag}`,
        'version',
      ])
      const version = stdout.trim()

      if (!version) {
        throw new Error(`npm view returned no version for ${name}@${distTag}`)
      }

      return [name, version]
    }),
  ),
)

const source = await readFile(workspaceFile, 'utf8')
const rewrites = []
let updated = source

for (const [name, version] of resolved) {
  // Only the catalog entry is touched. Matching the quoted key at a fixed
  // two-space indent keeps this from wandering into `overrides:` or a
  // same-named key elsewhere in the file.
  const pattern = new RegExp(`^(  '?${escapeRegExp(name)}'?:\\s*)(\\S+)$`, 'm')
  const match = updated.match(pattern)

  if (!match) {
    throw new Error(`No catalog entry for ${name} in pnpm-workspace.yaml`)
  }

  const current = match[2]

  if (current === version) continue

  updated = updated.replace(pattern, `$1${version}`)
  rewrites.push(`catalog.${name} ${current} -> ${version}`)
}

if (updated !== source) {
  await writeFile(workspaceFile, updated)
}

if (rewrites.length === 0) {
  console.log(`No pins to rewrite; catalog already matches @${distTag}.`)
} else {
  console.log(`Rewrote ${rewrites.length} catalog pin(s) to @${distTag}:`)
  for (const rewrite of rewrites) console.log(`  ${rewrite}`)
}

const summary = [...resolved]
  .map(([name, version]) => `${name}@${version}`)
  .join(' ')

console.log(`Canary versions: ${summary}`)

if (process.env.GITHUB_OUTPUT) {
  await appendFile(process.env.GITHUB_OUTPUT, `versions=${summary}\n`)
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
