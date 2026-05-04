import fs from 'node:fs/promises';
import path from 'node:path';

const SOURCE_URL = 'https://deepstat.xyz/table';
const OUTPUT_PATH = path.resolve('public/data/deepstate_table.json');

function decodeHtml(input = '') {
  return input
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function toNumber(value) {
  const normalized = String(value || '')
    .replace(/'/g, '')
    .replace(/\s/g, '')
    .replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseRecentRows(html) {
  const rowRegex = /<tr data-text="([^"]*)"[\s\S]*?(?=<tr data-text=|<tr><th|<\/table>)/g;
  const rows = [];
  let match;

  while ((match = rowRegex.exec(html)) !== null) {
    const chunk = match[0];
    const dataTextRaw = match[1] || '';
    const day = decodeHtml(chunk.match(/<td class="data-tt"><b>([\s\S]*?)<\/b>/)?.[1] || '');
    const occupiedRaw = chunk.match(/width=140>([\s\S]*?) km²/)?.[1] || '';
    const percentRaw = chunk.match(/data-percent="([^"]+)"/)?.[1] || '';
    const diffRaw = chunk.match(/data-diff="([^"]+)"/)?.[1] || '';
    const text = decodeHtml(dataTextRaw);

    if (!day || !text) continue;

    rows.push({
      day,
      occupiedKm2: toNumber(decodeHtml(occupiedRaw)),
      occupiedPercent: toNumber(percentRaw),
      diffKm2: toNumber(diffRaw),
      text,
    });
  }

  return rows.slice(0, 30);
}

function parseAreaSummary(html) {
  const summary = [];
  const summaryRegex = /<td class=padding_header_t[\s\S]*?<a href="\?view=[^"]+">([\s\S]*?)<\/a>[\s\S]*?width=140>([\s\S]*?) km²[\s\S]*?data-percent="([^"]+)"[\s\S]*?width=140>([\s\S]*?) km²[\s\S]*?<\/tr>/g;
  let match;

  while ((match = summaryRegex.exec(html)) !== null) {
    const name = decodeHtml(match[1]);
    if (!name || /^\d{4}$/.test(name)) continue;
    summary.push({
      name,
      occupiedKm2: toNumber(decodeHtml(match[2])),
      occupiedPercent: toNumber(match[3]),
      dailyAverageKm2: toNumber(decodeHtml(match[4])),
    });
  }

  return summary.slice(0, 10);
}

async function main() {
  const response = await fetch(SOURCE_URL, {
    headers: { 'User-Agent': 'okogora-deepstate-sync/1.0' },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`DeepState table request failed: ${response.status}`);
  }

  const html = await response.text();
  const rows = parseRecentRows(html);
  const areas = parseAreaSummary(html);
  const latest = rows[0] || null;
  const recentWindow = rows.slice(0, 7);
  const netChangeKm2 = recentWindow.reduce((sum, row) => sum + row.diffKm2, 0);
  const maxAbsDiffKm2 = Math.max(1, ...recentWindow.map((row) => Math.abs(row.diffKm2)));

  const payload = {
    generatedAt: new Date().toISOString(),
    sourceUrl: SOURCE_URL,
    latest,
    rows,
    areas,
    recentWindowDays: recentWindow.length,
    netChangeKm2,
    maxAbsDiffKm2,
    methodology: [
      'Парситься публічна таблиця deepstat.xyz/table.',
      'diffKm2 береться з data-diff рядка таблиці: мінус означає збільшення окупованої площі, плюс — звільнення/уточнення на користь України.',
      'Текст рядка збережено як пояснення події і має звірятися з першоджерелом DeepState.',
    ],
  };

  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.writeFile(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`Wrote ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
