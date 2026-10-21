// Shared client types. The Harness type packages are not imported; the client
// only needs the small surface it actually calls.

export type AnyProps = Record<string, any>

export interface ClientCtx {
  effect(effect: () => void | (() => void), label?: string): void
  locale: {
    register(ns: string, dicts: Record<string, Record<string, string>>): () => void
    bind(ns: string): (key: string, params?: Record<string, unknown>) => string
  }
  slots: {
    inject(ownerKey: string, callback: () => unknown): void
    register(options: Record<string, unknown>, component: any): unknown
  }
}

export interface GitFileEntry {
  path: string
  x: string
  y: string
  kind: 'changed' | 'untracked' | 'renamed' | 'ignored' | string
}

export interface GitStatusPayload {
  ok: boolean
  cwd?: string
  repoRoot?: string
  branch?: string
  upstream?: string
  ahead?: number
  behind?: number
  entries?: GitFileEntry[]
  truncated?: boolean
  error?: string
  code?: string
}

export interface DiffPayload {
  ok: boolean
  path?: string
  staged?: boolean
  text?: string
  error?: string
  code?: string
}

export type Translate = (key: string) => string
