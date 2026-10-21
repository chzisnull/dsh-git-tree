// Manifest and shipping contract for dsh-git-tree.
//
// These assertions mirror what the Harness loader validates at boot, so a
// broken package.json fails `npm test` instead of failing inside the app:
//   - dsh.client.platform must be "web" for the browser half to be served;
//   - exports["./client"] must exist and point at a real bundle;
//   - the bundle patch row id must equal the package name.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const patch = readFileSync(join(root, 'cordis.patch.yml'), 'utf8')

test('package name and repository', () => {
  assert.equal(pkg.name, 'dsh-git-tree')
  assert.equal(pkg.license, 'MIT')
  assert.equal(pkg.type, 'module')
  assert.match(pkg.repository.url, /github\.com\/chzisnull\/dsh-git-tree\.git$/)
})

test('bundle patch is declared and inserts a row with this package name', () => {
  assert.equal(pkg.dsh.bundle.patch, './cordis.patch.yml')
  assert.match(patch, new RegExp('id:\\s*' + pkg.name))
  assert.match(patch, new RegExp('name:\\s*' + pkg.name))
  assert.equal(pkg.exports['.'], './index.js')
})

test('client half is a web platform module with an existing bundle', () => {
  assert.equal(pkg.dsh.client.platform, 'web')
  assert.equal(pkg.dsh.client.immediately, true)
  assert.deepEqual(pkg.dsh.client.inject, [
    '@deepseek-ai/dsh-client-ui-renderer',
    '@deepseek-ai/dsh-client-ui-layout',
    '@deepseek-ai/dsh-client-ui-sidebar',
  ])
  assert.equal(pkg.exports['./client'], './client.js')
  assert.ok(existsSync(join(root, pkg.exports['./client'])), 'client.js must be built')
  assert.ok(pkg.files.includes('client.js'), 'client.js must ship in the package')
})

test('host half, icon and locales are shipped', () => {
  assert.ok(existsSync(join(root, 'index.js')))
  assert.ok(existsSync(join(root, 'icon.svg')))
  for (const locale of ['en', 'zh']) {
    const dict = JSON.parse(readFileSync(join(root, 'locale', locale + '.json'), 'utf8'))
    assert.equal(typeof dict.meta.title, 'string')
    assert.equal(typeof dict.meta.description, 'string')
  }
})

test('icon is a self-contained SVG', () => {
  const icon = readFileSync(join(root, 'icon.svg'), 'utf8')
  assert.match(icon, /^<svg[^>]+viewBox="0 0 64 64"/)
  // xmlns/xmlns:xlink are namespace declarations, not fetches; strip them first.
  const body = icon.replace(/\sxmlns(:xlink)?="[^"]*"/g, '')
  assert.ok(!/<image|xlink:href|url\(|<use[^>]+href="(?!\()/.test(body), 'icon must not reference external assets')
  assert.ok(!/https?:\/\//.test(body), 'icon must not fetch anything')
})
