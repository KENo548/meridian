const LANG_ALIASES = {
  mandarin: 'Chinese',
  cantonese: 'Chinese (Cantonese)',
  farsi: 'Persian',
  deutsch: 'German',
}

const COMMON_LANGUAGES = [
  'english', 'mandarin', 'chinese', 'cantonese', 'spanish', 'french', 'german',
  'italian', 'portuguese', 'japanese', 'korean', 'arabic', 'russian', 'hindi',
  'bengali', 'punjabi', 'turkish', 'dutch', 'swedish', 'norwegian', 'danish',
  'finnish', 'polish', 'czech', 'hungarian', 'romanian', 'bulgarian', 'greek',
  'hebrew', 'thai', 'vietnamese', 'indonesian', 'malay', 'filipino', 'swahili',
  'urdu', 'persian', 'farsi', 'tamil', 'telugu', 'marathi', 'gujarati',
  'kannada', 'malayalam', 'nepali', 'tagalog', 'ukrainian', 'serbian',
  'croatian', 'slovak', 'lithuanian', 'latvian', 'estonian', 'icelandic',
  'irish', 'catalan', 'afrikaans', 'zulu', 'somali', 'amharic',
]

function canonicalLang(raw) {
  const lower = raw.toLowerCase().trim()
  if (LANG_ALIASES[lower]) return LANG_ALIASES[lower]
  return lower.charAt(0).toUpperCase() + lower.slice(1)
}

function extractLanguages(text) {
  if (!text || typeof text !== 'string') return []
  const found = new Map()

  const addLang = (raw, level) => {
    const name = canonicalLang(raw)
    if (name.length < 3 || name.length > 25) return
    const existing = found.get(name)
    if (existing) {
      if (level && !existing.level) existing.level = level
    } else {
      found.set(name, { name, level: level || null })
    }
  }

  for (const lang of COMMON_LANGUAGES) {
    const re = new RegExp(`\\b${lang}\\b`, 'gi')
    if (re.test(text)) addLang(lang)
  }

  const levelWords = 'native|fluent|bilingual|proficien(?:t|cy)|advanced|intermediate|basic|conversational|working knowledge|working proficiency'
  const langWord = '[A-Za-z]+'

  const patterns = [
    new RegExp(`\\b(?:${levelWords})\\s+(?:in\\s+)?(${langWord})\\b`, 'gi'),
    new RegExp(`\\b(${langWord})\\s+(?:fluency|proficiency|language skills?|speaking)\\b`, 'gi'),
    new RegExp(`\\b(?:speak|speaking|read|reading|write|writing)\\s+(${langWord})\\b`, 'gi'),
    new RegExp(`\\b(${langWord})\\s+(?:and|or|/,)\\s+(${langWord})\\b`, 'gi'),
    new RegExp(`\\bfluently?\\s+in\\s+(${langWord}(?:\\s+(?:and|or|/,)\\s+${langWord})*)\\b`, 'gi'),
  ]

  for (const pat of patterns) {
    let m
    while ((m = pat.exec(text)) !== null) {
      const level = null
      for (let i = 1; i < m.length; i++) {
        if (m[i]) {
          const words = m[i].split(/\s*(?:,|and|or|\/)\s*/)
          for (const w of words) {
            const clean = w.replace(/[^a-zA-Z]/g, '').toLowerCase()
            if (COMMON_LANGUAGES.includes(clean)) {
              addLang(clean, level)
            }
          }
        }
      }
    }
  }

  if (found.size === 0) {
    const phraseRe = /(?:fluently?|bilingual|proficiency in|proficient in|knowledge of|speaking|speaks)\s+([\w\s,]+?)(?:\.|,|\n|$|;|\))/gi
    let m
    while ((m = phraseRe.exec(text)) !== null) {
      const candidates = m[1].split(/\s*(?:,|and|\/)\s*/).map(s => s.trim().toLowerCase())
      for (const c of candidates) {
        const clean = c.replace(/[^a-z\s]/g, '').trim()
        if (clean.length >= 3 && clean.length <= 20 && COMMON_LANGUAGES.includes(clean)) {
          addLang(clean)
        }
      }
    }
  }

  return [...found.values()]
}

function extractLanguagesFromJob(job) {
  const parts = [
    job.title || '',
    job.description || '',
    job.division || '',
    job.specialization || '',
    (job.tags || []).join(' '),
  ].filter(Boolean).join(' ')

  return extractLanguages(parts).map(l => l.name)
}

export { extractLanguages, extractLanguagesFromJob }
