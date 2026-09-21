/**
 * Minimal ESM resolve hook for `node --test`.
 *
 * Maps the tsconfig `@/* → src/*` alias and probes TypeScript
 * extensions so tests import the real modules (no mocks, no deps).
 * Used only via `--import ./src/test/register-alias.ts`.
 */
import type {
  ResolveFnOutput,
  ResolveHookContext,
} from 'node:module'

type NextResolve = (
  specifier: string,
  context?: ResolveHookContext,
) => Promise<ResolveFnOutput>

async function tryResolve(
  href: string,
  context: ResolveHookContext,
  nextResolve: NextResolve,
): Promise<ResolveFnOutput | undefined> {
  for (const candidate of [href, `${href}.ts`, `${href}/index.ts`]) {
    try {
      return await nextResolve(candidate, context)
    } catch {
      // Try the next candidate shape.
    }
  }
  return undefined
}

export async function resolve(
  specifier: string,
  context: ResolveHookContext,
  nextResolve: NextResolve,
): Promise<ResolveFnOutput> {
  if (specifier === '@' || specifier.startsWith('@/')) {
    const mapped = new URL(
      `../${specifier === '@' ? '' : specifier.slice(2)}`,
      import.meta.url,
    ).href
    const resolved = await tryResolve(mapped, context, nextResolve)
    if (resolved) return resolved
  }

  if (specifier.startsWith('./') || specifier.startsWith('../')) {
    try {
      return await nextResolve(specifier, context)
    } catch {
      const base = new URL(specifier, context.parentURL).href
      const resolved = await tryResolve(base, context, nextResolve)
      if (resolved) return resolved
      throw new Error(`Cannot resolve test import: ${specifier}`)
    }
  }

  return nextResolve(specifier, context)
}
