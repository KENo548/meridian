/**
 * Zustand selector stability guard (PR #1 F9).
 *
 * Zustand v5's useStore is a bare useSyncExternalStore with no equality
 * function, so a selector that derives (filter/map/spread/...) returns a
 * new reference on every snapshot read. React compares snapshots by
 * identity and re-renders synchronously on mismatch — an allocating
 * selector can therefore loop (maximum-update-depth) from mount.
 *
 * This test statically scans every useMeridianStore selector in src/ and
 * fails if any selector body allocates. Derivations belong outside the
 * selector:
 *
 *   const storedTags = useMeridianStore((s) => s.tags)   // stable ref
 *   const tags = storedTags.filter(...)                   // derived in render
 *
 * Run with:
 * `node --test --import ./src/test/register-alias.ts src/lib/storeSelectors.test.ts`
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** Constructs that allocate a new reference when evaluated. */
const ALLOCATING_PATTERNS: RegExp[] = [
  /\.filter\(/,
  /\.map\(/,
  /\.slice\(/,
  /\.sort\(/,
  /\.concat\(/,
  /\.flat\(/,
  /\.reduce\(/,
  /\.\.\./,
  /\bnew\s/,
  /Object\.(keys|values|entries|assign|fromEntries)\(/,
  /\?\?\s*\[/,
  /\|\|\s*\[/,
  /\?\?\s*\{/,
  /\|\|\s*\{/,
]

function collectSourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...collectSourceFiles(full))
    } else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      // Test files are excluded: this guard itself mentions hook names and
      // allocating constructs in its patterns, and runtime selectors live
      // in non-test source.
      out.push(full)
    }
  }
  return out
}

/** Extract the argument expression of every useMeridianStore(...) call. */
function extractSelectorArgs(src: string): string[] {
  const args: string[] = []
  const re = /useMeridianStore\(/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src)) !== null) {
    let i = m.index + m[0].length
    let depth = 1
    while (i < src.length && depth > 0) {
      const c = src[i]
      if (c === '(') depth++
      else if (c === ')') depth--
      i++
    }
    args.push(src.substring(m.index + m[0].length, i - 1))
  }
  return args
}

describe('store selector stability (PR #1 F9)', () => {
  it('no useMeridianStore selector allocates derived references', () => {
    const violations: string[] = []
    for (const file of collectSourceFiles(SRC_ROOT)) {
      const src = readFileSync(file, 'utf8')
      for (const arg of extractSelectorArgs(src)) {
        const hit = ALLOCATING_PATTERNS.find((re) => re.test(arg))
        if (hit) {
          violations.push(`${path.relative(SRC_ROOT, file)} :: ${arg.trim().substring(0, 120)}`)
        }
      }
    }
    assert.deepEqual(violations, [])
  })
})
