// Gold set for matcher evaluation
// Each entry: { trackerId, trackerSnapshot, directJobId, directJobSnapshot, label, notes }
// label: 'correct' | 'incorrect' | 'no_direct_job'

const GOLD_SET = [
  // === EXAMPLE CORRECT MATCHES ===
  {
    id: 'gold-001',
    trackerSnapshot: {
      companyName: 'Goldman Sachs',
      programme: 'Investment Banking Summer Internship 2027',
      division: 'Investment Banking',
      office: 'London',
      year: '2027',
    },
    directJobSnapshot: {
      title: '2027 Summer Analyst – Investment Banking – London',
      company: 'Goldman Sachs',
      location: 'London, UK',
    },
    label: 'correct',
    notes: 'Exact programme match. Title differs slightly but semantics identical.',
  },
  {
    id: 'gold-002',
    trackerSnapshot: {
      companyName: 'Blackstone',
      programme: 'Private Equity Summer Internship',
      division: 'Private Equity',
      office: 'New York',
      year: '2027',
    },
    directJobSnapshot: {
      title: '2027 Summer Analyst – Private Equity – New York',
      company: 'Blackstone',
      location: 'New York, NY',
    },
    label: 'correct',
    notes: 'Exact match on programme, division, location.',
  },
  {
    id: 'gold-003',
    trackerSnapshot: {
      companyName: 'Evercore',
      programme: 'Spring Week',
      division: 'Investment Banking',
      office: 'London',
      year: '2027',
    },
    directJobSnapshot: {
      title: 'Insight Programme 2027 – London',
      company: 'Evercore',
      location: 'London, UK',
    },
    label: 'correct',
    notes: 'Spring Week ↔ Insight Programme. Different literal title, same programme.',
  },
  {
    id: 'gold-004',
    trackerSnapshot: {
      companyName: 'Point72',
      programme: 'Investment Banking Summer Internship',
      division: 'Investment Banking',
      office: 'New York',
      year: '2027',
    },
    directJobSnapshot: {
      title: 'Summer Intern – Investment Banking – New York',
      company: 'Point72',
      location: 'New York, NY',
    },
    label: 'correct',
    notes: 'Summer Internship ↔ Summer Intern. Minor title variation.',
  },
  {
    id: 'gold-005',
    trackerSnapshot: {
      companyName: 'J.P. Morgan',
      programme: 'Sales & Trading Summer Internship',
      division: 'Sales & Trading',
      office: 'London',
      year: '2027',
    },
    directJobSnapshot: {
      title: '2027 Markets Summer Analyst – London',
      company: 'J.P. Morgan',
      location: 'London, UK',
    },
    label: 'correct',
    notes: 'S&T ↔ Markets. Same division, different naming convention.',
  },

  // === EXAMPLE INCORRECT MATCHES (should NOT match) ===
  {
    id: 'gold-006',
    trackerSnapshot: {
      companyName: 'Goldman Sachs',
      programme: 'Investment Banking Summer Internship',
      division: 'Investment Banking',
      office: 'London',
      year: '2027',
    },
    directJobSnapshot: {
      title: 'Vice President – Technology – New York',
      company: 'Goldman Sachs',
      location: 'New York, NY',
    },
    label: 'incorrect',
    notes: 'Same firm but wrong seniority (VP vs intern), wrong division, wrong location.',
  },
  {
    id: 'gold-007',
    trackerSnapshot: {
      companyName: 'Blackstone',
      programme: 'Private Equity Summer Internship',
      division: 'Private Equity',
      office: 'London',
      year: '2027',
    },
    directJobSnapshot: {
      title: 'Summer Analyst – Real Estate – New York',
      company: 'Blackstone',
      location: 'New York, NY',
    },
    label: 'incorrect',
    notes: 'Same firm, same level, but wrong division (RE vs PE) and wrong location.',
  },
  {
    id: 'gold-008',
    trackerSnapshot: {
      companyName: 'Evercore',
      programme: 'Spring Week',
      division: 'Investment Banking',
      office: 'London',
      year: '2027',
    },
    directJobSnapshot: {
      title: 'Summer Analyst 2027 – Restructuring – New York',
      company: 'Evercore',
      location: 'New York, NY',
    },
    label: 'incorrect',
    notes: 'Same firm but spring week ≠ summer analyst, London ≠ New York.',
  },
  {
    id: 'gold-009',
    trackerSnapshot: {
      companyName: 'Jane Street',
      programme: 'Summer Internship',
      division: 'Quantitative Trading',
      office: 'London',
      year: '2027',
    },
    directJobSnapshot: {
      title: 'Full-Time Quantitative Researcher – New York',
      company: 'Jane Street',
      location: 'New York, NY',
    },
    label: 'incorrect',
    notes: 'Same firm but intern ≠ full-time, London ≠ NY.',
  },
  {
    id: 'gold-010',
    trackerSnapshot: {
      companyName: 'Morgan Stanley',
      programme: 'Investment Banking Summer Internship',
      division: 'Investment Banking',
      office: 'London',
      year: '2027',
    },
    directJobSnapshot: {
      title: 'Summer Analyst 2027 – Wealth Management – London',
      company: 'Morgan Stanley',
      location: 'London, UK',
    },
    label: 'incorrect',
    notes: 'Same firm, same location, but IB ≠ Wealth Management.',
  },

  // === EXAMPLE NO DIRECT JOB ===
  {
    id: 'gold-011',
    trackerSnapshot: {
      companyName: 'Goldman Sachs',
      programme: 'Off-Cycle Internship',
      division: 'Investment Banking',
      office: 'Frankfurt',
      year: '2027',
    },
    directJobSnapshot: null,
    label: 'no_direct_job',
    notes: 'Goldman Sachs off-cycle Frankfurt may not be published on their standard board.',
  },
  {
    id: 'gold-012',
    trackerSnapshot: {
      companyName: 'Lazard',
      programme: 'Summer Internship',
      division: 'Investment Banking',
      office: 'London',
      year: '2027',
    },
    directJobSnapshot: null,
    label: 'no_direct_job',
    notes: 'Lazard not in our enabled firms list. No direct ingestion source.',
  },
  {
    id: 'gold-013',
    trackerSnapshot: {
      companyName: 'Centerview',
      programme: 'Summer Internship',
      division: 'Investment Banking',
      office: 'New York',
      year: '2027',
    },
    directJobSnapshot: null,
    label: 'no_direct_job',
    notes: 'Centerview not in our enabled firms list.',
  },

  // === EDGE CASES ===
  {
    id: 'gold-014',
    trackerSnapshot: {
      companyName: 'Barclays',
      programme: 'Investment Banking Summer Internship',
      division: 'Investment Banking',
      office: 'London',
      year: '2027',
    },
    directJobSnapshot: {
      title: '2027 IBD Summer Analyst – London',
      company: 'Barclays',
      location: 'London, UK',
    },
    label: 'correct',
    notes: 'IB ↔ IBD abbreviation. Should be caught by division normalization.',
  },
  {
    id: 'gold-015',
    trackerSnapshot: {
      companyName: 'Citadel',
      programme: 'Summer Internship',
      division: 'Quantitative Research',
      office: 'Hong Kong',
      year: '2027',
    },
    directJobSnapshot: {
      title: 'Quantitative Research Intern – Hong Kong',
      company: 'Citadel',
      location: 'Hong Kong',
    },
    label: 'correct',
    notes: 'Same programme, same division, same location. Minor title variation.',
  },
  {
    id: 'gold-016',
    trackerSnapshot: {
      companyName: 'Two Sigma',
      programme: 'Summer Internship',
      division: 'Quantitative Research',
      office: 'New York',
      year: '2027',
    },
    directJobSnapshot: {
      title: 'Quantitative Research Intern – Summer 2027 – New York',
      company: 'Two Sigma',
      location: 'New York, NY',
    },
    label: 'correct',
    notes: 'Exact match with year in different position.',
  },
  {
    id: 'gold-017',
    trackerSnapshot: {
      companyName: 'Apollo',
      programme: 'Summer Internship',
      division: 'Private Equity',
      office: 'New York',
      year: '2027',
    },
    directJobSnapshot: {
      title: 'Summer Private Equity Analyst – New York',
      company: 'Apollo',
      location: 'New York, NY',
    },
    label: 'correct',
    notes: 'Same semantics, reordered title words.',
  },
  {
    id: 'gold-018',
    trackerSnapshot: {
      companyName: 'KKR',
      programme: 'Summer Internship',
      division: 'Private Equity',
      office: 'London',
      year: '2027',
    },
    directJobSnapshot: {
      title: '2027 Summer Analyst – Private Equity – London',
      company: 'KKR',
      location: 'London, UK',
    },
    label: 'correct',
    notes: 'Direct match.',
  },
  {
    id: 'gold-019',
    trackerSnapshot: {
      companyName: 'Goldman Sachs',
      programme: 'Summer Internship',
      division: 'Sales & Trading',
      office: 'New York',
      year: '2027',
    },
    directJobSnapshot: {
      title: '2027 Summer Analyst – Global Markets – New York',
      company: 'Goldman Sachs',
      location: 'New York, NY',
    },
    label: 'correct',
    notes: 'S&T ↔ Global Markets. GS uses "Global Markets" for S&T.',
  },
  {
    id: 'gold-020',
    trackerSnapshot: {
      companyName: 'Morgan Stanley',
      programme: 'Spring Week',
      division: 'Investment Banking',
      office: 'London',
      year: '2027',
    },
    directJobSnapshot: {
      title: 'Spring Insight Programme 2027 – London',
      company: 'Morgan Stanley',
      location: 'London, UK',
    },
    label: 'correct',
    notes: 'Spring Week ↔ Spring Insight Programme.',
  },
  {
    id: 'gold-021',
    trackerSnapshot: {
      companyName: 'UBS',
      programme: 'Graduate Programme',
      division: 'Investment Banking',
      office: 'London',
      year: '2027',
    },
    directJobSnapshot: {
      title: '2027 Graduate Analyst – Investment Banking – London',
      company: 'UBS',
      location: 'London, UK',
    },
    label: 'correct',
    notes: 'Graduate Programme ↔ Graduate Analyst.',
  },
  {
    id: 'gold-022',
    trackerSnapshot: {
      companyName: 'Deutsche Bank',
      programme: 'Summer Internship',
      division: 'Investment Banking',
      office: 'Frankfurt',
      year: '2027',
    },
    directJobSnapshot: {
      title: 'Praktikant – Investment Banking – Frankfurt',
      company: 'Deutsche Bank',
      location: 'Frankfurt, Germany',
    },
    label: 'correct',
    notes: 'German title Praktikant = Intern. Language normalization needed.',
  },
  {
    id: 'gold-023',
    trackerSnapshot: {
      companyName: 'Nomura',
      programme: 'Summer Internship',
      division: 'Investment Banking',
      office: 'London',
      year: '2027',
    },
    directJobSnapshot: {
      title: 'Summer Internship 2027 – Investment Banking Division – London',
      company: 'Nomura',
      location: 'London, UK',
    },
    label: 'correct',
    notes: 'Direct match with IBD expanded.',
  },
  {
    id: 'gold-024',
    trackerSnapshot: {
      companyName: 'Credit Suisse',
      programme: 'Summer Internship',
      division: 'Investment Banking',
      office: 'London',
      year: '2027',
    },
    directJobSnapshot: null,
    label: 'no_direct_job',
    notes: 'Credit Suisse merged into UBS. Historical tracker entry.',
  },
  {
    id: 'gold-025',
    trackerSnapshot: {
      companyName: 'Citigroup',
      programme: 'Summer Internship',
      division: 'Investment Banking',
      office: 'London',
      year: '2027',
    },
    directJobSnapshot: {
      title: 'Summer Analyst – Banking – London',
      company: 'Citigroup',
      location: 'London, UK',
    },
    label: 'correct',
    notes: 'Investment Banking ↔ Banking. Abbreviation.',
  },
]

function getGoldSet() {
  return GOLD_SET.map(e => ({ ...e }))
}

function getGoldSetByLabel(label) {
  return GOLD_SET.filter(e => e.label === label).map(e => ({ ...e }))
}

function evaluateMatcher(matchFn) {
  const results = {
    correct: { tp: 0, fn: 0, fp: 0 },
    incorrect: { tp: 0, fn: 0, fp: 0 },
    no_direct_job: { tp: 0, fn: 0, fp: 0 },
    confusion: [],
  }

  for (const gold of GOLD_SET) {
    const match = matchFn(gold.trackerSnapshot, gold.directJobSnapshot)

    if (gold.label === 'correct') {
      if (match && match.confidence !== 'low') {
        results.correct.tp++
      } else {
        results.correct.fn++
        results.confusion.push({ gold, match, type: 'missed_correct' })
      }
    } else if (gold.label === 'incorrect') {
      if (match && match.confidence !== 'low') {
        results.incorrect.fp++
        results.confusion.push({ gold, match, type: 'false_positive' })
      } else {
        results.incorrect.tp++
      }
    } else if (gold.label === 'no_direct_job') {
      if (!match || match.confidence === 'low') {
        results.no_direct_job.tp++
      } else {
        results.no_direct_job.fp++
        results.confusion.push({ gold, match, type: 'false_match_no_direct' })
      }
    }
  }

  const totalCorrect = results.correct.tp + results.correct.fn
  const totalIncorrect = results.incorrect.tp + results.incorrect.fp
  const totalNoDirect = results.no_direct_job.tp + results.no_direct_job.fp

  const precision = (results.correct.tp + results.incorrect.tp) /
    Math.max(1, results.correct.tp + results.incorrect.tp + results.incorrect.fp + results.no_direct_job.fp)
  const recall = results.correct.tp / Math.max(1, totalCorrect)

  return {
    results,
    precision,
    recall,
    f1: precision + recall > 0 ? 2 * (precision * recall) / (precision + recall) : 0,
    summary: {
      correct_matched: results.correct.tp,
      correct_missed: results.correct.fn,
      incorrect_accepted: results.incorrect.fp,
      incorrect_rejected: results.incorrect.tp,
      no_direct_correct: results.no_direct_job.tp,
      no_direct_false_match: results.no_direct_job.fp,
    },
    confusion: results.confusion,
  }
}

export { GOLD_SET, getGoldSet, getGoldSetByLabel, evaluateMatcher }
