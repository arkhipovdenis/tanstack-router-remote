// Rewrites every pinned TanStack Router dependency in the workspace to a target
// dist-tag (default: latest) so CI can run `npm run check` against a version the
// repository does not pin. Only exact pins are rewritten; the adapter's open
// peer range (`>=1.168.18`) is left alone, since that is the contract under test.
//
// Usage: node scripts/pin-tanstack-canary.mjs [dist-tag]
// Writes the resolved versions to $GITHUB_OUTPUT when running in Actions.

import { appendFile, glob, readFile, writeFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const run = promisify(execFile)

const PACKAGES = ['@tanstack/react-router', '@tanstack/router-plugin']
const DEPENDENCY_FIELDS = ['dependencies', 'devDependencies']

const distTag = process.argv[2] ?? 'latest'
const repoRoot = fileURLToPath(new URL('../', import.meta.url))

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

const manifests = await listWorkspaceManifests()
const rewrites = []

for (const manifest of manifests) {
  const source = await readFile(manifest, 'utf8')
  const pkg = JSON.parse(source)
  let changed = false

  for (const field of DEPENDENCY_FIELDS) {
    const deps = pkg[field]

    if (!deps) continue

    for (const [name, version] of resolved) {
      const current = deps[name]

      // Ranges (`>=1.168.18`) are the compatibility contract, not a pin.
      if (current === undefined || !/^\d/.test(current)) continue
      if (current === version) continue

      deps[name] = version
      changed = true
      rewrites.push(
        `${relative(manifest)}: ${field}.${name} ${current} -> ${version}`,
      )
    }
  }

  if (changed) {
    await writeFile(manifest, `${JSON.stringify(pkg, null, 2)}\n`)
  }
}

if (rewrites.length === 0) {
  console.log(`No pins to rewrite; workspace already matches @${distTag}.`)
} else {
  console.log(`Rewrote ${rewrites.length} pin(s) to @${distTag}:`)
  for (const rewrite of rewrites) console.log(`  ${rewrite}`)
}

const summary = [...resolved]
  .map(([name, version]) => `${name}@${version}`)
  .join(' ')

console.log(`Canary versions: ${summary}`)

if (process.env.GITHUB_OUTPUT) {
  await appendFile(process.env.GITHUB_OUTPUT, `versions=${summary}\n`)
}

async function listWorkspaceManifests() {
  // Expanded straight from the `workspaces` globs rather than via `npm query`,
  // which needs an installed tree and returns [] on the fresh checkout this
  // script runs against (it has to rewrite the pins *before* `npm install`).
  const rootManifest = `${repoRoot}package.json`
  const { workspaces = [] } = JSON.parse(await readFile(rootManifest, 'utf8'))
  const manifests = [rootManifest]

  for (const pattern of workspaces) {
    for await (const match of glob(`${pattern}/package.json`, {
      cwd: repoRoot,
    })) {
      manifests.push(`${repoRoot}${match}`)
    }
  }

  return manifests
}

function relative(path) {
  return path.startsWith(repoRoot) ? path.slice(repoRoot.length) : path
}
