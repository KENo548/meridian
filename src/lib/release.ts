/**
 * Meridian release / commit identity (frontend).
 *
 * Shared convention: `meridian@<product-version>+<short-git-sha>`.
 * - MERIDIAN_VERSION mirrors the root package.json `meridian` version.
 *   A deterministic test enforces the sync; bump the package version,
 *   not this constant, when the product version changes.
 * - Commit SHA arrives automatically via Vercel-native VERCEL_GIT_COMMIT_SHA
 *   (vite.config.ts envPrefix allowlist; requires "Enable access to System
 *   Environment Variables" on the Vercel project). VITE_MERIDIAN_COMMIT is
 *   an explicit manual override for non-Vercel builds only.
 *   VITE_MERIDIAN_RELEASE may override the derived string when the build
 *   injects it directly.
 * - Missing metadata degrades to `unknown`, never a crash, never a secret.
 */

export const MERIDIAN_VERSION = '1.1.0'
export const UNKNOWN_COMMIT = 'unknown'

/**
 * Function shape for reading build-time env (injectable for tests).
 *
 * Vercel-native values (VERCEL_GIT_COMMIT_SHA, VERCEL_ENV) reach client
 * code through the narrow `envPrefix` allowlist in vite.config.ts. They
 * are present on Vercel builds when the operator enables "Enable access
 * to System Environment Variables"; absent locally (→ unknown fallback).
 */
export interface ReleaseEnv {
  VITE_MERIDIAN_COMMIT?: string
  VERCEL_GIT_COMMIT_SHA?: string
  VITE_MERIDIAN_RELEASE?: string
  VITE_SENTRY_ENVIRONMENT?: string
  VERCEL_ENV?: string
  VITE_VERCEL_ENV?: string
  PROD?: boolean
  MODE?: string
}

function readViteEnv(): ReleaseEnv {
  try {
    const env = (import.meta as unknown as { env?: ReleaseEnv })?.env
    if (env && typeof env === 'object') return env
  } catch {
    // Non-Vite runtimes (node --test): fall through to empty env.
  }
  return {}
}

/** Normalize a raw commit SHA; missing/blank becomes `unknown`. */
export function normalizeCommit(raw: unknown): string {
  if (typeof raw !== 'string') return UNKNOWN_COMMIT
  const trimmed = raw.trim()
  if (!trimmed) return UNKNOWN_COMMIT
  return trimmed.slice(0, 40)
}

/** Short SHA for the release string; `unknown` stays `unknown`. */
export function shortCommit(commit: unknown): string {
  const normalized = normalizeCommit(commit)
  if (normalized === UNKNOWN_COMMIT) return UNKNOWN_COMMIT
  return normalized.slice(0, 7)
}

/** `meridian@1.1.0+ebdd0be`. Missing SHA → `meridian@1.1.0+unknown`. */
export function formatRelease(version: string, commit: unknown): string {
  const safeVersion =
    typeof version === 'string' && version.trim() ? version.trim() : MERIDIAN_VERSION
  return `meridian@${safeVersion}+${shortCommit(commit)}`
}

/**
 * Non-secret commit SHA from the build environment (injectable env).
 * Precedence: explicit VITE_MERIDIAN_COMMIT override wins (non-Vercel
 * builds), then Vercel-native VERCEL_GIT_COMMIT_SHA (automatic per
 * deployment, no operator action), else deterministic unknown.
 */
export function getFrontendCommit(env?: ReleaseEnv): string {
  const source = env ?? readViteEnv()
  const manual =
    typeof source.VITE_MERIDIAN_COMMIT === 'string'
      ? source.VITE_MERIDIAN_COMMIT.trim()
      : ''
  if (manual) return normalizeCommit(manual)
  const native =
    typeof source.VERCEL_GIT_COMMIT_SHA === 'string'
      ? source.VERCEL_GIT_COMMIT_SHA.trim()
      : ''
  return normalizeCommit(native)
}

/**
 * Release string for Sentry + health display. An explicit
 * VITE_MERIDIAN_RELEASE wins; otherwise derive version + SHA.
 */
export function getFrontendRelease(env?: ReleaseEnv): string {
  const source = env ?? readViteEnv()
  const override =
    typeof source.VITE_MERIDIAN_RELEASE === 'string'
      ? source.VITE_MERIDIAN_RELEASE.trim()
      : ''
  if (override) return override
  return formatRelease(MERIDIAN_VERSION, getFrontendCommit(source))
}

export type FrontendEnvironment = 'production' | 'preview' | 'development'

/**
 * Deterministic environment mapping: explicit VITE_SENTRY_ENVIRONMENT
 * wins, then Vercel-native VERCEL_ENV (production/preview/development,
 * automatic per deployment), then the legacy manual VITE_VERCEL_ENV,
 * then the Vite PROD flag.
 */
export function getFrontendEnvironment(env?: ReleaseEnv): FrontendEnvironment {
  const source = env ?? readViteEnv()
  const explicit = (source.VITE_SENTRY_ENVIRONMENT ?? '').toLowerCase().trim()
  if (explicit === 'production' || explicit === 'preview' || explicit === 'development') {
    return explicit
  }
  const native = (source.VERCEL_ENV ?? '').toLowerCase().trim()
  if (native === 'production' || native === 'preview' || native === 'development') {
    return native
  }
  const manual = (source.VITE_VERCEL_ENV ?? '').toLowerCase().trim()
  if (manual === 'production' || manual === 'preview' || manual === 'development') {
    return manual
  }
  return source.PROD ? 'production' : 'development'
}
