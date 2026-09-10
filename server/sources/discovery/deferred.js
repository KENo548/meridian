const DEFERRED_SOURCES = [
  {
    id: 'jobortunity',
    name: 'Jobortunity',
    url: 'https://jobortunity.ai',
    reason: 'SPA, no public API, requires headless browser. Evaluate after coverage metrics from other sources.',
    trackers: [
      'uk-finance-tracker-summer-internships',
      'eu-finance-tracker-summer-internships',
      'germany-finance-summer-internships',
      'dach-ma-ib-tracker',
    ],
    estimatedValue: 'very_high',
    fields: ['company', 'position', 'location', 'opening_date', 'closing_date', 'employment_type', 'apply_url', 'notes'],
  },
]

function getDeferredSources() {
  return DEFERRED_SOURCES.map(s => ({ ...s }))
}

function getDeferredSourceById(id) {
  return DEFERRED_SOURCES.find(s => s.id === id) || null
}

export { DEFERRED_SOURCES, getDeferredSources, getDeferredSourceById }
