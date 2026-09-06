import { execFileSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
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
// The package README is generated at publish time, so it is not checked here.
// Its links are rewritten to absolute URLs by scripts/build-package-readme.mjs.
if (errors.length) throw new Error(errors.join('\n'))
console.log(
  `Local Markdown targets passed (${files.length} files). External URLs and anchors are not checked.`,
)
