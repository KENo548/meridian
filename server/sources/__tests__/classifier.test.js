import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { classifyUrl, classifyFirm, classifyJobUrl, getProviderCounts } from '../ats/classifier.js'

describe('classifyUrl', () => {
  it('classifies Greenhouse URLs', () => {
    const r = classifyUrl('https://boards.greenhouse.io/williamblair')
    assert.equal(r.provider, 'greenhouse')
    assert.equal(r.metadata.boardSlug, 'williamblair')
  })

  it('classifies job-boards Greenhouse URLs', () => {
    const r = classifyUrl('https://job-boards.greenhouse.io/optiverus')
    assert.equal(r.provider, 'greenhouse')
    assert.equal(r.metadata.boardSlug, 'optiverus')
  })

  it('classifies Workday URLs', () => {
    const r = classifyUrl('https://blackstone.wd1.myworkdayjobs.com/en-US/Blackstone_Careers')
    assert.equal(r.provider, 'workday')
    assert.equal(r.metadata.tenant, 'blackstone')
  })

  it('classifies Oleeo URLs', () => {
    const r = classifyUrl('https://evercore.tal.net/vx/mobile-0/appcentre-ext/brand-4/candidate/jobboard/vacancy/2/feed')
    assert.equal(r.provider, 'oleeo_rss')
    assert.equal(r.metadata.company, 'evercore')
  })

  it('classifies SmartRecruiters URLs', () => {
    const r = classifyUrl('https://jobs.smartrecruiters.com/Wiser')
    assert.equal(r.provider, 'smartrecruiters')
    assert.equal(r.metadata.companyId, 'Wiser')
  })

  it('classifies Lever URLs', () => {
    const r = classifyUrl('https://jobs.lever.co/anthropic')
    assert.equal(r.provider, 'lever')
    assert.equal(r.metadata.companyId, 'anthropic')
  })

  it('classifies Lever subdomain URLs', () => {
    const r = classifyUrl('https://anthropic.lever.co')
    assert.equal(r.provider, 'lever')
    assert.equal(r.metadata.companyId, 'anthropic')
  })

  it('classifies iCIMS URLs', () => {
    const r = classifyUrl('https://careers-sig.icims.com/jobs/search')
    assert.equal(r.provider, 'icims')
  })

  it('classifies eFC URLs', () => {
    const r = classifyUrl('https://www.efinancialcareers.com/jobs/banking-finance')
    assert.equal(r.provider, 'efc')
  })

  it('returns unknown for unrecognized URLs', () => {
    const r = classifyUrl('https://example.com/careers')
    assert.equal(r.provider, 'unknown')
  })

  it('handles null/undefined input', () => {
    assert.equal(classifyUrl(null), null)
    assert.equal(classifyUrl(undefined), null)
    assert.equal(classifyUrl(''), null)
  })
})

describe('classifyFirm', () => {
  it('classifies a firm by its careersUrl', () => {
    const firm = { careersUrl: 'https://boards.greenhouse.io/williamblair' }
    const r = classifyFirm(firm)
    assert.equal(r.provider, 'greenhouse')
  })

  it('returns null for firm without careersUrl', () => {
    assert.equal(classifyFirm({}), null)
    assert.equal(classifyFirm(null), null)
  })
})

describe('classifyJobUrl', () => {
  it('classifies a job URL', () => {
    const r = classifyJobUrl('https://jobs.smartrecruiters.com/Google/12345')
    assert.equal(r.provider, 'smartrecruiters')
    assert.equal(r.metadata.companyId, 'Google')
  })
})

// Lever false-positive regression tests (2026-09-06)
// Ensure only jobs.lever.co is detected, not generic lever.co or word "lever"
describe('Lever false-positive prevention', () => {
  it('classifies jobs.lever.co URL as lever', () => {
    const r = classifyUrl('https://jobs.lever.co/goldmansachs')
    assert.equal(r.provider, 'lever')
  })

  it('does NOT classify generic lever.co as lever', () => {
    const r = classifyUrl('https://lever.co/something')
    assert.equal(r.provider, 'unknown')
  })

  it('does NOT classify word "lever" in URL as lever', () => {
    const r = classifyUrl('https://example.com/lever-action')
    assert.equal(r.provider, 'unknown')
  })
})

describe('getProviderCounts', () => {
  it('counts providers from classifications', () => {
    const classifications = [
      { classification: { provider: 'greenhouse' } },
      { classification: { provider: 'greenhouse' } },
      { classification: { provider: 'workday' } },
      { classification: null },
    ]
    const counts = getProviderCounts(classifications)
    assert.equal(counts.greenhouse, 2)
    assert.equal(counts.workday, 1)
    assert.equal(counts.undefined, undefined)
  })
})
