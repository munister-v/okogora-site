import { writeFile } from 'node:fs/promises';

const CHANNEL = 'pechalbeda200';
const BASE_URL = `https://t.me/s/${CHANNEL}`;
const OUT_PATH = 'public/data/pechalbeda_stats.json';
const MAX_PAGES = 50;
const WINDOW_DAYS = 30;

function extractEntries(html) {
  const re = /data-post="([^"]+)"[\s\S]*?datetime="([^"]+)"[\s\S]*?<div class="tgme_widget_message_text js-message_text"[^>]*>([\s\S]*?)<\/div>/g;
  const entries = [];
  let m;
  while ((m = re.exec(html)) !== null) {
    const postPath = m[1];
    const dt = m[2];
    const textHtml = m[3] || '';
    const idStr = postPath.split('/')[1] || '';
    const id = Number(idStr);
    const ts = Date.parse(dt);
    if (!Number.isFinite(id) || Number.isNaN(ts)) continue;
    const textPlain = textHtml
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const serialMatch = textPlain.match(/^(\d{4,7})[\.\)]/);
    entries.push({
      id,
      datetime: dt,
      ts,
      url: `https://t.me/${postPath}`,
      text: textPlain,
      serial: serialMatch ? Number(serialMatch[1]) : null,
    });
  }
  return entries;
}

function extractBefore(html) {
  const m = html.match(/href="\/s\/[^"]+\?before=(\d+)"\s+class="tme_messages_more/);
  return m ? Number(m[1]) : null;
}

function toKyivDayKey(ts) {
  const fmt = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Kyiv',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(new Date(ts)); // YYYY-MM-DD
}

async function fetchPage(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; okogora-bot/1.0)',
      'Accept-Language': 'uk-UA,uk;q=0.9,en;q=0.8',
    },
  });
  if (!res.ok) throw new Error(`Telegram page error ${res.status}`);
  return res.text();
}

async function main() {
  const now = Date.now();
  const cutoffTs = now - WINDOW_DAYS * 24 * 60 * 60 * 1000;

  const all = [];
  const seen = new Set();
  let nextBefore = null;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const url = nextBefore ? `${BASE_URL}?before=${nextBefore}` : BASE_URL;
    const html = await fetchPage(url);
    const entries = extractEntries(html);

    if (!entries.length) break;

    for (const e of entries) {
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      all.push(e);
    }

    const oldestTsOnPage = Math.min(...entries.map(e => e.ts));
    nextBefore = extractBefore(html);

    if (!nextBefore) break;
    if (oldestTsOnPage < cutoffTs) break;
  }

  all.sort((a, b) => b.ts - a.ts);

  const maxPostId = all.length ? Math.max(...all.map(e => e.id)) : 0;
  const maxSerial = all.reduce((acc, e) => (e.serial && e.serial > acc ? e.serial : acc), 0);
  const inWindow = all.filter(e => e.ts >= cutoffTs);

  const dayCounts = new Map();
  for (const e of inWindow) {
    const key = toKyivDayKey(e.ts);
    dayCounts.set(key, (dayCounts.get(key) || 0) + 1);
  }

  const todayKey = toKyivDayKey(now);
  const sevenDaysCutoff = now - 7 * 24 * 60 * 60 * 1000;

  const output = {
    generatedAt: new Date().toISOString(),
    channel: CHANNEL,
    sourceUrl: BASE_URL,
    methodology: {
      windowDays: WINDOW_DAYS,
      note: 'Counts are based on public posts in Telegram web channel view. totalBySerial uses the numeric index at the start of entry text; fallback totalApproxByMaxPostId uses maximum observed channel post ID.',
    },
    counters: {
      today: dayCounts.get(todayKey) || 0,
      last7Days: inWindow.filter(e => e.ts >= sevenDaysCutoff).length,
      last30Days: inWindow.length,
      totalBySerial: maxSerial,
      totalApproxByMaxPostId: maxPostId,
    },
    days: Array.from(dayCounts.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([day, count]) => ({ day, count })),
    latestProofs: all.slice(0, 20).map(e => ({
      id: e.id,
      datetime: e.datetime,
      url: e.url,
      dayKyiv: toKyivDayKey(e.ts),
    })),
  };

  await writeFile(OUT_PATH, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(`[pechalbeda] saved ${OUT_PATH}; today=${output.counters.today}, 7d=${output.counters.last7Days}, serialTotal=${output.counters.totalBySerial}`);
}

main().catch((err) => {
  console.error('[pechalbeda] sync failed:', err);
  process.exit(1);
});
