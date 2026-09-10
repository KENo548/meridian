/**
 * Da Vinci Trading – Careers investigation
 *
 * Findings:
 *   Careers URL  : https://davincitrading.com/careers/
 *   ATS           : Greenhouse (board token: davinciderivatives)
 *   Job Board URL : https://job-boards.eu.greenhouse.io/davinciderivatives
 *   Platform      : WordPress + Greenhouse WP plugin
 *
 * The site embeds the Greenhouse application form directly via:
 *   - WordPress plugin: greenhouse (greenhouse-public.css / greenhouse-public.js)
 *   - Embed script: https://boards.eu.greenhouse.io/embed/job_board/js?for=davinciderivatives
 *   - Fallback iframe: https://job-boards.eu.greenhouse.io/davinciderivatives/jobs/{jobId}
 *
 * Greenhouse board token: davinciderivatives
 * Board URL (public): https://job-boards.eu.greenhouse.io/davinciderivatives
 */

async function checkUrl(url) {
  try {
    const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(10000) });
    return { url, status: res.status, ok: res.ok };
  } catch (err) {
    return { url, error: err.message };
  }
}

async function main() {
  const urls = [
    'https://davincitrading.com/careers/',
    'https://job-boards.eu.greenhouse.io/davinciderivatives',
  ];

  console.log('=== Da Vinci Trading – Careers URL Check ===\n');

  for (const url of urls) {
    const result = await checkUrl(url);
    console.log(`${result.ok ? '✅' : '❌'} ${url}`);
    console.log(`   Status: ${result.status ?? result.error}\n`);
  }
}

main().catch(console.error);
