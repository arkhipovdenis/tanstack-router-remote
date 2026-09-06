import { format, resolveConfig } from 'prettier'
import { execFileSync } from 'node:child_process'
import { readFileSync, existsSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const files = execFileSync(
  'git',
  ['ls-files', '--cached', '--others', '--exclude-standard'],
  { encoding: 'utf8' },
)
  .trim()
  .split('\n')
  .filter((file) => file.endsWith('.md'))
const errors = []
for (const file of files) {
  const source = readFileSync(file, 'utf8').replace(/```[\s\S]*?```/g, '')
  for (const match of source.matchAll(/\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g)) {
    const target = match[1].split('#')[0]
    if (!target || /^[a-z]+:|^\//i.test(target)) continue
    if (!existsSync(resolve(dirname(file), decodeURIComponent(target))))
      errors.push(`${file}: ${target}`)
  }
}
const root = readFileSync('README.md', 'utf8')
const packageReadme = root.replace(
  /\]\((docs\/|examples\/|tests\/|CONTRIBUTING.md)([^)]*)\)/g,
  '](' +
    'https://github.com/arkhipovdenis/tanstack-router-remote/blob/main/$1$2)',
)
const expected = await format(packageReadme, {
  ...(await resolveConfig('README.md')),
  filepath: 'README.md',
})
if (process.argv.includes('--write'))
  writeFileSync('packages/route-tree-adapter/README.md', expected)
if (readFileSync('packages/route-tree-adapter/README.md', 'utf8') !== expected)
  errors.push('Package README differs; run pnpm run sync:readme.')
if (errors.length) throw new Error(errors.join('\n'))
console.log(
  `Local Markdown targets and README parity passed (${files.length} files). External URLs and anchors are not checked.`,
)
