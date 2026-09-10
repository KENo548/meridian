const PUBLIC_SUFFIXES = new Set([
  'ac.uk', 'co.uk', 'com.uk', 'gov.uk', 'me.uk', 'mod.uk', 'net.uk', 'nic.uk', 'org.uk', 'parliament.uk',
  'co.jp', 'co.kr', 'co.nz', 'co.za', 'com.au', 'com.br', 'com.cn', 'com.co', 'com.mx', 'com.sg', 'com.tr', 'com.tw',
  'com.vn', 'com.ar', 'com.ar', 'com.ph', 'com.my', 'com.sa', 'com.pe', 'com.pk', 'com.eg', 'com.ng',
  'com.ec', 'com.gt', 'com.cu', 'com.do', 'com.bo', 'com.py', 'com.uy', 'com.sv', 'com.hn', 'com.ni', 'com.cr', 'com.pa',
  'net.au', 'org.au', 'edu.au', 'gov.au',
  'or.jp', 'ne.jp', 'go.jp', 'gob.mx', 'gob.ar', 'gob.ve', 'gob.pe', 'gob.bo', 'gob.py',
  'co.in', 'net.in', 'org.in', 'gen.in', 'firm.in', 'ind.in',
  'co.za', 'org.za', 'net.za', 'web.za',
  'co.ke', 'or.ke', 'ne.ke', 'go.ke',
  'co.tz', 'or.tz', 'ne.tz', 'go.tz',
  'com.af', 'com.dz', 'com.jo', 'com.lb', 'com.ly', 'com.ma', 'com.om', 'com.qa', 'com.sy', 'com.ye',
  'com.kw', 'com.bh', 'com.iq', 'com.ps', 'com.sd',
  'com.bo', 'com.fj', 'com.pg', 'com.sb', 'com.vu',
  'com.et', 'com.gh', 'com.lr', 'com.sl', 'com.sn', 'com.tg', 'com.zm', 'com.zw',
  'com.mm', 'com.kh', 'com.la', 'com.bn',
  'net.cn', 'org.cn', 'gov.cn',
  'co.th', 'co.id', 'co.il', 'co.za', 'co.cr', 'co.vi',
  'com.hk', 'com.tw', 'org.hk', 'org.tw',
  'edu.cn', 'ac.cn', 'gov.cn', 'mil.cn',
  'co.ve', 'co.bd', 'co.lk', 'co.np', 'co.th',
  'com.al', 'com.ba', 'com.bg', 'com.hr', 'com.mk', 'com.rs', 'com.si', 'com.ua',
  'co.ug', 'co.zm', 'co.zw', 'co.rw', 'co.bi', 'co.mz', 'co.mw',
  'com.bo', 'com.py', 'com.uy', 'com.sv', 'com.hn', 'com.ni', 'com.cr', 'com.pa',
  'edu.au', 'edu.cn', 'edu.co', 'edu.hk', 'edu.in', 'edu.my', 'edu.ph', 'edu.sg', 'edu.tw',
  'gov.au', 'gov.cn', 'gov.co', 'gov.hk', 'gov.in', 'gov.sg',
  'mil.au', 'mil.cn', 'mil.co', 'mil.in', 'mil.sg',
  'net.au', 'net.cn', 'net.co', 'net.hk', 'net.in', 'net.my', 'net.ph', 'net.sg',
  'org.au', 'org.cn', 'org.co', 'org.hk', 'org.in', 'org.my', 'org.ph', 'org.sg',
  'ac.za', 'gov.za', 'law.za', 'mil.za',
  'blogspot.com', 'wordpress.com', 'github.io', 'gitlab.io', 'herokuapp.com', 'vercel.app', 'netlify.app',
  'cloudfront.net', 'amazonaws.com', 'azurewebsites.net', 'googleapis.com', 'google.com',
  'amazonaws.com', 's3.amazonaws.com', 's3.eu-west-1.amazonaws.com', 's3.us-east-1.amazonaws.com',
])

const EXTRA_SUFFIXES = new Set([
  'co.uk', 'org.uk', 'me.uk', 'net.uk',
  'co.jp', 'or.jp', 'ne.jp',
  'co.kr', 'or.kr', 'ne.kr',
  'com.au', 'net.au', 'org.au', 'edu.au', 'gov.au',
  'com.br', 'net.br', 'org.br', 'com.co', 'net.co', 'org.co',
  'com.cn', 'net.cn', 'org.cn', 'gov.cn', 'edu.cn',
  'com.hk', 'net.hk', 'org.hk',
  'com.sg', 'net.sg', 'org.sg',
  'com.tw', 'net.tw', 'org.tw',
  'co.in', 'net.in', 'org.in', 'co.id', 'co.th',
  'co.za', 'org.za', 'net.za',
  'co.ke', 'or.ke',
  'co.tz', 'or.tz',
  'com.mx', 'net.mx', 'org.mx',
  'com.ar', 'net.ar', 'org.ar',
  'com.tr', 'net.tr', 'org.tr',
  'com.vn', 'net.vn', 'org.vn',
  'com.ph', 'net.ph', 'org.ph',
  'com.my', 'net.my', 'org.my',
  'com.sa', 'net.sa', 'org.sa',
  'com.pe', 'net.pe', 'org.pe',
  'com.pk', 'net.pk', 'org.pk',
  'com.eg', 'net.eg', 'org.eg',
  'com.ng', 'net.ng', 'org.ng',
  'com.ec', 'net.ec', 'org.ec',
  'com.bo', 'net.bo', 'org.bo',
  'com.py', 'net.py', 'org.py',
  'com.uy', 'net.uy', 'org.uy',
  'com.cr', 'net.cr', 'org.cr',
  'com.pa', 'net.pa', 'org.pa',
  'com.ni', 'net.ni', 'org.ni',
  'com.sv', 'net.sv', 'org.sv',
  'com.hn', 'net.hn', 'org.hn',
  'com.gt', 'net.gt', 'org.gt',
  'com.cu', 'net.cu', 'org.cu',
  'com.do', 'net.do', 'org.do',
  'co.ve', 'net.ve', 'org.ve',
  'co.lk', 'net.lk', 'org.lk',
  'co.np', 'net.np', 'org.np',
  'co.bd', 'net.bd', 'org.bd',
  'co.il', 'net.il', 'org.il',
  'co.ug', 'net.ug', 'org.ug',
  'co.zm', 'net.zm', 'org.zm',
  'co.zw', 'net.zw', 'org.zw',
  'co.rw', 'net.rw', 'org.rw',
  'co.bi', 'net.bi', 'org.bi',
  'co.mz', 'net.mz', 'org.mz',
  'co.mw', 'net.mw', 'org.mw',
  'co.vi', 'net.vi', 'org.vi',
])

function extractRegistrableDomain(hostname) {
  if (!hostname) return null

  const h = hostname.toLowerCase().replace(/^www\./, '')
  const parts = h.split('.')

  if (parts.length <= 2) return h

  for (let i = 0; i < parts.length - 1; i++) {
    const suffix = parts.slice(i).join('.')
    if (EXTRA_SUFFIXES.has(suffix)) {
      if (i >= 1) {
        return parts.slice(i - 1).join('.')
      }
      return h
    }
  }

  if (parts.length >= 2) {
    return parts.slice(-2).join('.')
  }

  return h
}

function extractDomain(url) {
  if (!url) return null
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`)
    return extractRegistrableDomain(parsed.hostname)
  } catch {
    return null
  }
}

function extractDomainGroup(domain) {
  if (!domain) return 'unknown'
  return extractRegistrableDomain(domain)
}

export {
  extractDomain,
  extractDomainGroup,
  extractRegistrableDomain,
  PUBLIC_SUFFIXES,
  EXTRA_SUFFIXES,
}
