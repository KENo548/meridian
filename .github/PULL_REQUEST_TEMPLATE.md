<!--
Meridian PR template. Verification is evidence for JARVIS + human release
decisions. Do not leave Verification blank: use PASS / FAIL / NOT RUN.
There is no approval checkbox here on purpose: approval stays human and
outside this template.
-->

## Change

What changed and why?

## Scope

What is intentionally NOT changed?

## Verification

Paste actual results (PASS / FAIL / NOT RUN — never leave blank):

- `npx tsc -b`:
- `npm run build`:
- Frontend `node --test` suites:
- Backend `node --test` suites:
- `npm run lint`:

## Data / Migration

- Database/schema change: YES / NO
- User-data migration: YES / NO
- Backup required: YES / NO
- User action required: YES / NO

## Rollback

How is this change rolled back?

## JARVIS

Release candidate: NOT PREPARED / BLOCKED / READY_FOR_OPERATOR_APPROVAL
