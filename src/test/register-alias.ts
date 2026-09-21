/**
 * Registers the `@/` alias hook for `node --test` runs:
 * `node --test --import ./src/test/register-alias.ts <tests>`.
 */
import { register } from 'node:module'

register('./alias-hooks.ts', import.meta.url)
