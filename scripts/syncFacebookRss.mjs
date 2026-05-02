import fs from 'node:fs/promises';
import crypto from 'node:crypto';

const OUTPUT_PATH = 'public/data/rss_facebook.json';
const CONFIG_PATH = 'public/data/rss_facebook_config.json';

const DEFAULT_CONFIG = {
  windowDays: 7,
  maxItems: 120,
  pages: [
    { handle: 'DefenceU', name: 'Defense of Ukraine' },
    { handle: 'GeneralStaff.ua', name: 'General Staff of the Armed Forces of Ukraine' },
    { handle: 'SecurSerUkraine', name: 'Security Service of Ukraine' },
    { handle: 'DeepStateUA', name: 'DeepStateUA' },
  ],
  keywords: [
    'ukraine', 'ukrainian', 'russia', 'росія', 'удар', 'strike', 'hit', 'destroyed',
    'drone', 'бпла', 'missile', 'air defense', 'ппо', 'frontline', 'front',
    'odesa', 'одеса', 'kharkiv', 'харків', 'zaporizhzhia', 'запоріжжя',
    'crimea', 'крим', 'logistics', 'логіст', 'refinery', 'нпз',
  ],
  excludeKeywords: ['promo', 'giveaway', 'реклама'],
};

const FEED_FACTORIES = [
  (handle) => `https://rsshub.app/facebook/page/${handle}`,
  (handle) => `https://rsshub.pseudoyu.com/facebook/page/${handle}`,
  (handle) => `https://rsshub.uocat.com/facebook/page/${handle}`,
  (handle) => `https://rsshub.rssforever.com/facebook/page/${handle}`,
];

const TRANSLATE_ENDPOINT = 'https://translate.googleapis.com/translate_a/single';

function decodeHtml(input) {
  return (input || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<(video|img|source|iframe)[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\bhttps?:\/\/(?:scontent\.|fbcdn\.|video\.xx\.fbcdn\.)\S+/gi, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+\n/g, '\n')
    .replace(/\n\s+/g, '\n')
    .trim();
}

function pickTag(itemXml, tagName) {
  const re = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const m = itemXml.match(re);
  return m ? decodeHtml(m[1]) : '';
}

function toIsoOrNow(pubDate) {
  const d = new Date(pubDate);
  if (Number.isNaN(d.getTime())) return new Date().toISOString();
  return d.toISOString();
}

function withinDays(iso, days) {
  const ts = new Date(iso).getTime();
  const min = Date.now() - days * 24 * 60 * 60 * 1000;
  return ts >= min;
}

function matchesFilters(text, keywords, excludeKeywords) {
  const t = (text || '').toLowerCase();
  if (excludeKeywords.some((k) => k && t.includes(k.toLowerCase()))) return false;
  return keywords.some((k) => k && t.includes(k.toLowerCase()));
}

function hashKey(input) {
  return crypto.createHash('sha1').update(input).digest('hex').slice(0, 12);
}

function normalizeTitleKey(title) {
  return (title || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .trim();
}

function normalizeRssItem(item) {
  return {
    ...item,
    title: decodeHtml(item.title || ''),
    summary: decodeHtml(item.summary || ''),
    titleUk: decodeHtml(item.titleUk || ''),
    summaryUk: decodeHtml(item.summaryUk || ''),
  };
}

function isGeneralStaffBriefing(item) {
  const handle = String(item.handle || '').toLowerCase();
  const text = `${item.title || ''} ${item.summary || ''}`.toLowerCase();
  if (!handle.includes('generalstaff')) return false;
  if (/оперативн(а|ої)\s+інформац/i.test(text)) return true;
  if (/зведенн/i.test(text)) return true;
  if (/станом\s+на\s+\d{1,2}[:.]\d{2}/i.test(text)) return true;
  if (/протягом\s+доби/i.test(text)) return true;
  return false;
}

function isProbablyUkrainian(text) {
  if (!text) return false;
  const t = text.toLowerCase();
  return /[іїєґ]/.test(t);
}

async function fetchText(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; okogora-fb-rss/1.0)',
        Accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.5',
      },
      signal: controller.signal,
      redirect: 'follow',
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    if (!/<rss|<feed/i.test(text)) throw new Error('not_feed');
    return text;
  } finally {
    clearTimeout(timer);
  }
}

const translationCache = new Map();

async function translateToUkrainian(text) {
  const normalized = (text || '').trim();
  if (!normalized) return '';
  if (isProbablyUkrainian(normalized)) return normalized;
  if (translationCache.has(normalized)) return translationCache.get(normalized);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);

  try {
    const url = `${TRANSLATE_ENDPOINT}?client=gtx&sl=auto&tl=uk&dt=t&q=${encodeURIComponent(normalized)}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; okogora-fb-rss/1.0)',
        Accept: 'application/json,text/plain,*/*',
      },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`translate_http_${res.status}`);

    const data = await res.json();
    const translated = Array.isArray(data?.[0])
      ? data[0].map((chunk) => chunk?.[0] || '').join('').trim()
      : '';

    const out = translated || normalized;
    translationCache.set(normalized, out);
    return out;
  } catch {
    translationCache.set(normalized, normalized);
    return normalized;
  } finally {
    clearTimeout(timer);
  }
}

function parseItems(xml, page) {
  const rawItems = xml.match(/<item[\s\S]*?<\/item>/gi) || [];

  return rawItems.map((itemXml) => {
    const title = pickTag(itemXml, 'title');
    const link = pickTag(itemXml, 'link');
    const description = pickTag(itemXml, 'description') || pickTag(itemXml, 'content:encoded');
    const pubDate = pickTag(itemXml, 'pubDate') || pickTag(itemXml, 'updated');
    const publishedAt = toIsoOrNow(pubDate);

    return {
      id: `fb-${page.handle}-${hashKey(link || title || publishedAt)}`,
      title,
      url: link,
      summary: description,
      publishedAt,
      author: page.name,
      handle: page.handle,
      source: 'facebook_rss',
      tags: ['OSINT', 'HUMINT', 'UKRAINE'],
      isGeneralStaffBriefing: false,
    };
  });
}

async function fetchPageItems(page) {
  for (const makeUrl of FEED_FACTORIES) {
    const url = makeUrl(page.handle);
    try {
      const xml = await fetchText(url);
      const parsed = parseItems(xml, page);
      if (parsed.length > 0) {
        console.log(`OK ${page.handle} via ${url} -> ${parsed.length}`);
        return parsed;
      }
    } catch (err) {
      console.log(`FAIL ${page.handle} via ${url}: ${String(err.message || err)}`);
    }
  }

  return [];
}

async function loadConfig() {
  try {
    const raw = await fs.readFile(CONFIG_PATH, 'utf8');
    const cfg = JSON.parse(raw);
    return {
      windowDays: Number(cfg.windowDays) > 0 ? Number(cfg.windowDays) : DEFAULT_CONFIG.windowDays,
      maxItems: Number(cfg.maxItems) > 0 ? Number(cfg.maxItems) : DEFAULT_CONFIG.maxItems,
      pages: Array.isArray(cfg.pages) && cfg.pages.length ? cfg.pages : DEFAULT_CONFIG.pages,
      keywords: Array.isArray(cfg.keywords) && cfg.keywords.length ? cfg.keywords : DEFAULT_CONFIG.keywords,
      excludeKeywords: Array.isArray(cfg.excludeKeywords) ? cfg.excludeKeywords : DEFAULT_CONFIG.excludeKeywords,
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

async function main() {
  const cfg = await loadConfig();
  const all = [];
  let previousItems = [];

  try {
    const prev = JSON.parse(await fs.readFile(OUTPUT_PATH, 'utf8'));
    previousItems = Array.isArray(prev.items) ? prev.items : [];
  } catch {
    previousItems = [];
  }

  for (const page of cfg.pages) {
    const normalizedPage =
      typeof page === 'string'
        ? { handle: page.trim(), name: page.trim() }
        : { handle: String(page.handle || '').trim(), name: String(page.name || page.handle || '').trim() };

    if (!normalizedPage.handle) continue;
    const items = await fetchPageItems(normalizedPage);
    all.push(...items);
  }

  const dedupByUrl = new Set();
  const dedupByTitle = new Set();

  const filtered = all
    .filter((item) => item.url && item.title)
    .filter((item) => withinDays(item.publishedAt, cfg.windowDays))
    .map((item) => {
      const briefing = isGeneralStaffBriefing(item);
      return {
        ...item,
        isGeneralStaffBriefing: briefing,
        tags: briefing ? Array.from(new Set([...(item.tags || []), 'GENSHTAB', 'EVENING_REPORT'])) : item.tags,
      };
    })
    .filter((item) => item.isGeneralStaffBriefing || matchesFilters(`${item.title} ${item.summary}`, cfg.keywords, cfg.excludeKeywords))
    .filter((item) => {
      const u = item.url.trim();
      if (dedupByUrl.has(u)) return false;
      dedupByUrl.add(u);

      const t = item.title.toLowerCase().replace(/\s+/g, ' ').replace(/[^\p{L}\p{N}\s]/gu, '').trim();
      if (dedupByTitle.has(t)) return false;
      dedupByTitle.add(t);
      return true;
    })
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, cfg.maxItems);

  const translated = [];
  for (const item of filtered) {
    const translatedTitle = await translateToUkrainian(item.title || '');
    const translatedSummary = await translateToUkrainian(item.summary || '');
    translated.push({
      ...item,
      titleUk: translatedTitle,
      summaryUk: translatedSummary,
    });
  }

  let finalItems = translated;

  const minHealthy = Math.max(8, Math.floor(cfg.maxItems * 0.15));
  if (finalItems.length < minHealthy && previousItems.length > 0) {
    const existingUrls = new Set(finalItems.map((i) => (i.url || '').trim()).filter(Boolean));
    const existingTitles = new Set(finalItems.map((i) => normalizeTitleKey(i.title || i.titleUk || '')));

    const reusable = previousItems
      .filter((item) => item?.url && item?.title)
      .filter((item) => withinDays(item.publishedAt, Math.max(cfg.windowDays + 1, 8)))
      .filter((item) => matchesFilters(`${item.title || ''} ${item.summary || ''} ${item.titleUk || ''} ${item.summaryUk || ''}`, cfg.keywords, cfg.excludeKeywords))
      .filter((item) => {
        const u = String(item.url || '').trim();
        const t = normalizeTitleKey(item.title || item.titleUk || '');
        if (!u || existingUrls.has(u) || (t && existingTitles.has(t))) return false;
        existingUrls.add(u);
        if (t) existingTitles.add(t);
        return true;
      });

    finalItems = [...finalItems, ...reusable]
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
      .slice(0, cfg.maxItems);
  }

  if (finalItems.length === 0) {
    finalItems = previousItems;
    console.log(`No fresh items, keeping previous snapshot (${finalItems.length})`);
  }

  finalItems = finalItems
    .map(normalizeRssItem)
    .filter((item) => item.url && item.title);

  const payload = {
    generatedAt: new Date().toISOString(),
    windowDays: cfg.windowDays,
    pages: cfg.pages,
    keywords: cfg.keywords,
    excludeKeywords: cfg.excludeKeywords,
    items: finalItems,
  };

  await fs.writeFile(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${OUTPUT_PATH} with ${finalItems.length} items`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
