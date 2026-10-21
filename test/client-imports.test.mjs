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
