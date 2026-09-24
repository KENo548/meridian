/**
 * Filter counting + active-chip helpers (PR #1 U5/U8).
 *
 * Verifies the shared utilities used by both ApplicationsToolbar and
 * FiltersPanel so the two counters always agree. Run with:
 * `node --test --import ./src/test/register-alias.ts src/lib/utilsFilters.test.ts`
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  countActiveDateRanges,
  countActiveKeys,
  countDeadlineRangeActive,
  emptyFilters,
  isActiveFilterValue,
} from './utils.ts'
import type { ApplicationFilters } from '../types/index.ts'

function f(overrides: Partial<ApplicationFilters> = {}): ApplicationFilters {
  return { ...emptyFilters(), ...overrides }
}

describe('isActiveFilterValue', () => {
  it('returns false for the default emptyFilters values', () => {
    const defaults = emptyFilters()
    for (const key of Object.keys(defaults) as Array<keyof ApplicationFilters>) {
      assert.equal(isActiveFilterValue(defaults[key]), false, `default ${String(key)} is inactive`)
    }
  })

  it('counts non-empty arrays as active', () => {
    assert.ok(isActiveFilterValue(['a']))
  })

  it('counts non-empty strings as active', () => {
    assert.ok(isActiveFilterValue('bank'))
  })

  it('counts numbers as active', () => {
    assert.ok(isActiveFilterValue(7))
  })

  it('counts true booleans as active', () => {
    assert.ok(isActiveFilterValue(true))
  })

  it('does not count false as active without a key (generic)', () => {
    assert.equal(isActiveFilterValue(false), false)
  })

  it('counts false as active for tristate keys (hasInterview)', () => {
    assert.ok(isActiveFilterValue(false, 'hasInterview'))
  })

  it('counts false as active for tristate keys (hasOffer)', () => {
    assert.ok(isActiveFilterValue(false, 'hasOffer'))
  })

  it('counts false as active for tristate keys (rollingDeadline)', () => {
    assert.ok(isActiveFilterValue(false, 'rollingDeadline'))
  })

  it('does not count false as active for showArchived (default)', () => {
    assert.equal(isActiveFilterValue(false, 'showArchived'), false)
  })

  it('does not count null as active', () => {
    assert.equal(isActiveFilterValue(null), false)
  })

  it('does not count undefined as active', () => {
    assert.equal(isActiveFilterValue(undefined), false)
  })
})

describe('countActiveKeys', () => {
  it('counts 0 for default filters', () => {
    assert.equal(countActiveKeys(f(), Object.keys(f()) as Array<keyof ApplicationFilters>), 0)
  })

  it('counts a non-empty status array as 1 key (not per-element)', () => {
    assert.equal(countActiveKeys(f({ statuses: ['to_apply', 'applied'] }), ['statuses']), 1)
  })

  it('counts a deadlineWithinDays number as 1', () => {
    assert.equal(countActiveKeys(f({ deadlineWithinDays: 7 }), ['deadlineWithinDays']), 1)
  })

  it('does not count showArchived=false as active', () => {
    assert.equal(countActiveKeys(f({ showArchived: false }), ['showArchived']), 0)
  })

  it('counts showArchived=true as active', () => {
    assert.equal(countActiveKeys(f({ showArchived: true }), ['showArchived']), 1)
  })

  it('counts hasInterview=true as active', () => {
    assert.equal(countActiveKeys(f({ hasInterview: true }), ['hasInterview']), 1)
  })

  it('counts hasInterview=false as active (meaningful exclusion)', () => {
    assert.equal(countActiveKeys(f({ hasInterview: false }), ['hasInterview']), 1)
  })

  it('does not count hasInterview=null as active', () => {
    assert.equal(countActiveKeys(f({ hasInterview: null }), ['hasInterview']), 0)
  })

  it('counts hasOffer=false as active (meaningful exclusion)', () => {
    assert.equal(countActiveKeys(f({ hasOffer: false }), ['hasOffer']), 1)
  })

  it('does not count hasOffer=null as active', () => {
    assert.equal(countActiveKeys(f({ hasOffer: null }), ['hasOffer']), 0)
  })

  it('counts rollingDeadline=false as active (meaningful exclusion)', () => {
    assert.equal(countActiveKeys(f({ rollingDeadline: false }), ['rollingDeadline']), 1)
  })

  it('does not count rollingDeadline=null as active', () => {
    assert.equal(countActiveKeys(f({ rollingDeadline: null }), ['rollingDeadline']), 0)
  })
})

describe('countActiveDateRanges', () => {
  it('returns 0 for default filters', () => {
    assert.equal(countActiveDateRanges(f()), 0)
  })

  it('counts opening date range as 1 when from is set', () => {
    assert.equal(countActiveDateRanges(f({ openingDateFrom: '2026-01-01' })), 1)
  })

  it('counts opening date range as 1 when both from and to are set', () => {
    assert.equal(countActiveDateRanges(f({ openingDateFrom: '2026-01-01', openingDateTo: '2026-06-01' })), 1)
  })

it('counts 3 independent date range pairs excluding deadline', () => {
     assert.equal(
       countActiveDateRanges(
         f({
           openingDateFrom: '2026-01-01',
           deadlineTo: '2026-12-31',
           startDateFrom: '2026-06-01',
           applicationDateTo: '2026-09-01',
         }),
       ),
       3,
     )
   })
})

describe('countDeadlineRangeActive (PR #1 F8)', () => {
  it('returns 0 when neither bound is set', () => {
    assert.equal(countDeadlineRangeActive(f()), 0)
  })

  it('returns 1 when only from is set', () => {
    assert.equal(countDeadlineRangeActive(f({ deadlineFrom: '2026-01-01' })), 1)
  })

  it('returns 1 when only to is set', () => {
    assert.equal(countDeadlineRangeActive(f({ deadlineTo: '2026-12-31' })), 1)
  })

  it('returns 1 when both bounds are set (one logical filter)', () => {
    assert.equal(
      countDeadlineRangeActive(f({ deadlineFrom: '2026-01-01', deadlineTo: '2026-12-31' })),
      1,
    )
  })

  it('deadline-only filter is excluded from Dates but non-zero overall (Save View enabled)', () => {
    const deadlineOnly = f({ deadlineTo: '2026-12-31' })
    assert.equal(countActiveDateRanges(deadlineOnly), 0)
    const toolbarTotal = countActiveDateRanges(deadlineOnly) + countDeadlineRangeActive(deadlineOnly)
    assert.equal(toolbarTotal, 1)
    assert.ok(toolbarTotal > 0)
  })

  it('deadline plus one date range totals 2 with no double-count', () => {
    const both = f({ deadlineTo: '2026-12-31', openingDateFrom: '2026-01-01' })
    assert.equal(countActiveDateRanges(both), 1)
    assert.equal(countDeadlineRangeActive(both), 1)
    assert.equal(countActiveDateRanges(both) + countDeadlineRangeActive(both), 2)
  })
})
