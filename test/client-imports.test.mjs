// Guard against a failure mode the browser caught twice: a route helper added to
// routes.ts but forgotten in a multi-line import, which esbuild bundles happily
// (it does not resolve free identifiers) and only fails at click time.
//
// This is a static check over our own source, deliberately narrow: every route
// export referenced by the workspace shell must appear in its import list.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const routes = readFileSync(join(root, 'src/client/routes.ts'), 'utf8')
const shell = readFileSync(join(root, 'src/client/components/Workspace.tsx'), 'utf8')

const exports = new Set([...routes.matchAll(/export function (\w+)/g)].map((match) => match[1]))
const importBlock = shell.split("} from '../routes'")[0]
const imported = new Set([...importBlock.matchAll(/^\s+(\w+),$/gm)].map((match) => match[1]))
const referenced = new Set([...shell.matchAll(/\b(\w+)\b/g)].map((match) => match[1]))
const missing = [...referenced].filter((name) => exports.has(name) && !imported.has(name)).sort()

test('every route helper used by the workspace shell is imported', () => {
  assert.deepEqual(missing, [], 'add these to the routes import: ' + missing.join(', '))
})

test('every local hook used by the shell components is imported', () => {
  const files = ['Workspace.tsx', 'TopBar.tsx', 'RefRail.tsx', 'ChangeList.tsx', 'FileRow.tsx']
  const missingHooks = []
  for (const name of files) {
    const source = readFileSync(join(root, 'src/client/components', name), 'utf8')
    const imported = new Set([...source.matchAll(/import\s*\{([^}]+)\}\s*from/g)].flatMap((match) =>
      match[1].split(',').map((part) => part.trim()).filter(Boolean),
    ))
    const used = new Set([...source.matchAll(/\b(use[A-Z]\w+)\b/g)].map((match) => match[1]))
    for (const hook of used) {
      if (!imported.has(hook) && hook !== 'useState' && hook !== 'useEffect' && hook !== 'useCallback' && hook !== 'useRef') {
        // React hooks arrive through the shared React binding, not named imports.
        if (new RegExp('React\\.' + hook).test(source) || new RegExp(hook + '\\(').test(source)) {
          missingHooks.push(name + ': ' + hook)
        }
      }
    }
  }
  assert.deepEqual(missingHooks, [], 'missing imports: ' + missingHooks.join(', '))
})
