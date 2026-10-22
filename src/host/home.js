/**
 * The DSH home directory, shared by everything this plugin persists.
 * `DSH_HOME` wins when set (tests, sandboxes); otherwise `~/.dsh`, matching the
 * settings provider the Harness ships.
 */

import { homedir } from 'node:os'
import { join } from 'node:path'

export function dshHome() {
  const configured = process.env.DSH_HOME
  return typeof configured === 'string' && configured !== '' ? configured : join(homedir(), '.dsh')
}
