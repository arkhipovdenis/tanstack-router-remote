// Bumps the package version, commits it, and tags the commit.
//
// `pnpm version` would do all three on its own, but only when package.json is
// at the git root - ours sits in packages/, so it bumps the manifest and stops
// there. This drives it from the package and finishes the job.
//
// Usage: pnpm run release <version | major | minor | patch | …>

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const bump = process.argv[2]

if (!bump) {
  console.error('Usage: pnpm run release <version | major | minor | patch | …>')
  process.exit(1)
}

const repoRoot = fileURLToPath(new URL('../', import.meta.url))
const packageDir = `${repoRoot}packages/route-tree-adapter`
const manifest = `${packageDir}/package.json`

const run = (command, args, cwd = repoRoot) =>
  execFileSync(command, args, { cwd, encoding: 'utf8', stdio: 'pipe' }).trim()

// A dirty tree would sweep unrelated work into the release commit.
if (run('git', ['status', '--porcelain'])) {
  console.error('Working tree is not clean; commit or stash first.')
  process.exit(1)
}

// `--no-git-tag-version` because npm would refuse to tag from a subdirectory
// anyway; the tag is created below, once the manifest is committed.
run('pnpm', ['version', bump, '--no-git-tag-version'], packageDir)

const { version } = JSON.parse(readFileSync(manifest, 'utf8'))
const tag = `v${version}`

run('git', ['add', 'packages/route-tree-adapter/package.json'])
run('git', ['commit', '-m', `release ${tag}`])
run('git', ['tag', tag])

console.log(
  `Tagged ${tag}. Push it to publish:\n\n  git push origin main ${tag}\n`,
)
