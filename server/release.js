/**
 * Meridian release / commit identity (backend).
 *
 * Shared convention: `meridian@<product-version>+<short-git-sha>`.
 * - Product version authority is the ROOT package.json (`meridian`), NOT
 *   `server/package.json` (that is metadata for the server package only).
 * - Commit SHA comes from deployment env (`MERIDIAN_COMMIT`, falling back
 *   to Render's native `RENDER_GIT_COMMIT`, then `GIT_COMMIT`).
 * - Missing commit metadata degrades to the explicit string `unknown` —
 *   startup and /api/health never crash over it.
 *
 * Pure module: no Sentry, no DB, no network. Safe to import anywhere.
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const UNKNOWN_COMMIT = 'unknown';

function loadProductVersion() {
  try {
    const rootPkg = join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json');
    const parsed = JSON.parse(readFileSync(rootPkg, 'utf8'));
    if (parsed && typeof parsed.version === 'string' && parsed.version.trim()) {
      return parsed.version.trim();
    }
  } catch {
    // Fail open: version must never break startup.
  }
  return '0.0.0';
}

export const PRODUCT_VERSION = loadProductVersion();

/** Normalize a raw commit SHA; anything missing/blank becomes `unknown`. */
export function normalizeCommit(raw) {
  if (typeof raw !== 'string') return UNKNOWN_COMMIT;
  const trimmed = raw.trim();
  if (!trimmed) return UNKNOWN_COMMIT;
  return trimmed.slice(0, 40);
}

/** Short SHA for the release string; `unknown` stays `unknown`. */
export function shortCommit(commit) {
  const normalized = normalizeCommit(commit);
  if (normalized === UNKNOWN_COMMIT) return UNKNOWN_COMMIT;
  return normalized.slice(0, 7);
}

/** `meridian@1.1.0+ebdd0be`. Missing SHA → `meridian@1.1.0+unknown`. */
export function formatRelease(version, commit) {
  const safeVersion = typeof version === 'string' && version.trim() ? version.trim() : PRODUCT_VERSION;
  return `meridian@${safeVersion}+${shortCommit(commit)}`;
}

/**
 * Commit resolution order: explicit MERIDIAN_COMMIT first, then Render's
 * native RENDER_GIT_COMMIT, then generic GIT_COMMIT. Never throws.
 */
export function getCommitFromEnv(env = process.env) {
  try {
    const source = env || {};
    return normalizeCommit(source.MERIDIAN_COMMIT || source.RENDER_GIT_COMMIT || source.GIT_COMMIT || '');
  } catch {
    return UNKNOWN_COMMIT;
  }
}

/** Explicit MERIDIAN_RELEASE wins; otherwise derive from version + SHA. */
export function getReleaseInfo(env = process.env) {
  const commit = getCommitFromEnv(env);
  let release = '';
  try {
    const override = env && typeof env.MERIDIAN_RELEASE === 'string' ? env.MERIDIAN_RELEASE.trim() : '';
    if (override) release = override;
  } catch {
    release = '';
  }
  if (!release) release = formatRelease(PRODUCT_VERSION, commit);
  return { version: PRODUCT_VERSION, commit, release };
}

/**
 * Backend environment for Sentry. Explicit SENTRY_ENVIRONMENT wins, then
 * NODE_ENV with a tiny normalization map. Never throws, never empty.
 */
export function getSentryEnvironment(env = process.env) {
  try {
    const source = env || {};
    const raw = String(source.SENTRY_ENVIRONMENT || source.NODE_ENV || 'development').toLowerCase().trim();
    if (raw === 'prod') return 'production';
    if (raw === 'pre' || raw === 'prev') return 'preview';
    if (raw === 'production' || raw === 'staging' || raw === 'preview' || raw === 'test' || raw === 'development') {
      return raw;
    }
    return raw || 'development';
  } catch {
    return 'development';
  }
}

/** Technical-only driver label. Never a connection string. */
export function getDbDriver(env = process.env) {
  try {
    return env && env.DATABASE_URL ? 'pg' : 'sqlite';
  } catch {
    return 'sqlite';
  }
}

/**
 * Public /api/health body. Release string only (it already carries the
 * short SHA: meridian@<version>+<short-sha>) — no full commit, no
 * secrets, no connection strings, no tokens. `sources` is the
 * configured-flags map. The full commit stays internal, available via
 * getReleaseInfo() for Sentry release metadata.
 */
export function buildHealthBody(sources = {}, env = process.env) {
  const { release } = getReleaseInfo(env);
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    sources,
    release,
  };
}
