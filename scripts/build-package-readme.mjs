// Renders the root README into the package directory for `npm publish`.
// The tarball ships without docs/ or examples/, so relative links would 404 on
// npmjs.com. Run from prepack; the result is generated, never committed.
import { format, resolveConfig } from 'prettier'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const repo = fileURLToPath(new URL('../', import.meta.url))
const source = new URL('../README.md', import.meta.url)
const target = new URL(
  '../packages/route-tree-adapter/README.md',
  import.meta.url,
)

export async function renderPackageReadme() {
  const root = readFileSync(source, 'utf8')
  const rebased = root.replace(
    /\]\((docs\/|examples\/|tests\/|CONTRIBUTING\.md)([^)]*)\)/g,
    '](https://github.com/arkhipovdenis/tanstack-router-remote/blob/main/$1$2)',
  )

  return format(rebased, {
    ...(await resolveConfig(`${repo}README.md`)),
    filepath: 'README.md',
  })
}

if (import.meta.url === `file://${process.argv[1]}`) {
  writeFileSync(target, await renderPackageReadme())
}
