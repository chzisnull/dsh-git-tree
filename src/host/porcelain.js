/**
 * Parse `git status --porcelain=v2 --branch -z` output.
 *
 * Record shapes (git-status(1)): `1 XY sub mH mI mW hH hI <path>`,
 * `2 XY sub mH mI mW hH hI Xscore <path>` (renames), `? <path>`, `! <path>`,
 * and `# branch.*` headers.
 *
 * This module has no DSH dependencies: it is a pure function over git output,
 * importable from a plain Node unit test.
 */

/** Maximum entries kept from one status call; the rest are reported as truncated. */
export const MAX_ENTRIES = 5000

export function parsePorcelainV2(text) {
  const entries = []
  let branch = ''
  let oid = ''
  let upstream = ''
  let ahead = 0
  let behind = 0
  let truncated = false
  for (const record of text.split('\0')) {
    if (!record) continue
    if (record.startsWith('# branch.oid ')) {
      oid = record.slice('# branch.oid '.length).trim()
      continue
    }
    if (record.startsWith('# branch.head ')) {
      branch = record.slice('# branch.head '.length).trim()
      continue
    }
    if (record.startsWith('# branch.upstream ')) {
      upstream = record.slice('# branch.upstream '.length).trim()
      continue
    }
    if (record.startsWith('# branch.ab ')) {
      const match = /\+(\d+)\s+-(\d+)/.exec(record)
      if (match) {
        ahead = Number(match[1])
        behind = Number(match[2])
      }
      continue
    }
    if (record.startsWith('#')) continue

    let entry
    if (record[0] === '1') {
      // 8 space-separated fields precede the path.
      const fields = record.split(' ')
      const xy = fields[1] || '??'
      entry = { path: fields.slice(8).join(' '), x: xy[0] || '?', y: xy[1] || '?', kind: 'changed' }
    } else if (record[0] === '2') {
      // Renames: 9 fields precede the new path; also carries the score field.
      const fields = record.split(' ')
      const xy = fields[1] || '??'
      entry = { path: fields.slice(9).join(' '), x: xy[0] || '?', y: xy[1] || '?', kind: 'renamed' }
    } else if (record[0] === '?') {
      entry = { path: record.slice(2), x: '?', y: '?', kind: 'untracked' }
    } else if (record[0] === '!') {
      entry = { path: record.slice(2), x: '!', y: '!', kind: 'ignored' }
    }
    if (!entry || !entry.path) continue
    if (entries.length >= MAX_ENTRIES) {
      truncated = true
      break
    }
    entries.push(entry)
  }
  return { oid, branch, upstream, ahead, behind, entries, truncated }
}
