import fs from 'node:fs/promises';
import crypto from 'node:crypto';

const CONFIG_PATH = 'public/data/brigades_dashboard_config.json';
const OUTPUT_PATH = 'public/data/brigades_dashboard.json';
const X_RSS_PATH = 'public/data/rss_twitter.json';
const FB_RSS_PATH = 'public/data/rss_facebook.json';

const X_FEED_FACTORIES = [
  (handle) => `https://rsshub.pseudoyu.com/twitter/user/${handle}`,
  (handle) => `https://rsshub.app/twitter/user/${handle}`,
  (handle) => `https://twiiit.com/${handle}/rss`,
];

const FB_FEED_FACTORIES = [
  (handle) => `https://rsshub.app/facebook/page/${handle}`,
  (handle) => `https://rsshub.pseudoyu.com/facebook/page/${handle}`,
  (handle) => `https://rsshub.uocat.com/facebook/page/${handle}`,
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
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeText(text) {
  return decodeHtml(text)
    .toLowerCase()
    .replace(/[«»"'`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function hashKey(input) {
  return crypto.createHash('sha1').update(input).digest('hex').slice(0, 14);
}

function pickTag(xml, tagName) {
  const re = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const m = xml.match(re);
  return m ? decodeHtml(m[1]) : '';
}

function parseFeedMeta(xml) {
  const channelMatch = xml.match(/<channel[\s\S]*?<\/channel>/i);
  const scope = channelMatch ? channelMatch[0] : xml;
  return {
    title: pickTag(scope, 'title'),
    description: pickTag(scope, 'description') || pickTag(scope, 'subtitle'),
    link: pickTag(scope, 'link'),
  };
}

function toIsoOrNow(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return new Date().toISOString();
  return d.toISOString();
}

function parseItems(xml, source) {
  const rawItems = xml.match(/<item[\s\S]*?<\/item>/gi) || [];
  const parsedRss = rawItems.map((itemXml) => {
    const title = pickTag(itemXml, 'title');
    const link = pickTag(itemXml, 'link') || pickTag(itemXml, 'guid');
    const description = pickTag(itemXml, 'description') || pickTag(itemXml, 'content:encoded');
    const pubDate = pickTag(itemXml, 'pubDate') || pickTag(itemXml, 'updated') || pickTag(itemXml, 'published');
    return {
      id: `${source.platform}-${source.handle}-${hashKey(`${link}|${title}|${pubDate}`)}`,
      title,
      summary: description,
      url: link,
      publishedAt: toIsoOrNow(pubDate),
      source: source.platform,
      sourceLabel: source.handle,
    };
  });

  if (parsedRss.length) return parsedRss;

  const rawEntries = xml.match(/<entry[\s\S]*?<\/entry>/gi) || [];
  return rawEntries.map((entryXml) => {
    const title = pickTag(entryXml, 'title');
    const linkMatch = entryXml.match(/<link[^>]+href="([^"]+)"/i);
    const link = linkMatch ? decodeHtml(linkMatch[1]) : pickTag(entryXml, 'id');
    const description = pickTag(entryXml, 'summary') || pickTag(entryXml, 'content');
    const pubDate = pickTag(entryXml, 'updated') || pickTag(entryXml, 'published');

    return {
      id: `${source.platform}-${source.handle}-${hashKey(`${link}|${title}|${pubDate}`)}`,
      title,
      summary: description,
      url: link,
      publishedAt: toIsoOrNow(pubDate),
      source: source.platform,
      sourceLabel: source.handle,
    };
  });
}

function withinDays(iso, days) {
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return false;
  return ts >= Date.now() - days * 24 * 60 * 60 * 1000;
}

function matchesAnyAlias(text, aliases) {
  const norm = normalizeText(text);
  return aliases.some((alias) => {
    const a = normalizeText(alias);
    return a && norm.includes(a);
  });
}

function significanceScore(text, keywords) {
  const norm = normalizeText(text);
  let score = 0;
  for (const kw of keywords) {
    const key = normalizeText(kw);
    if (!key) continue;
    if (norm.includes(key)) score += 1;
  }
  return Math.min(score, 9);
}

function keywordHitCount(text, keywords) {
  const norm = normalizeText(text);
  let hits = 0;
  for (const kw of keywords) {
    const key = normalizeText(kw);
    if (!key) continue;
    if (norm.includes(key)) hits += 1;
  }
  return hits;
}

function isProbablyUkrainian(text) {
  return /[іїєґ]/i.test(text || '');
}

const translateCache = new Map();

async function translateToUkrainian(text) {
  const value = (text || '').trim();
  if (!value) return '';
  if (isProbablyUkrainian(value)) return value;
  if (translateCache.has(value)) return translateCache.get(value);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);

  try {
    const url = `${TRANSLATE_ENDPOINT}?client=gtx&sl=auto&tl=uk&dt=t&q=${encodeURIComponent(value)}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; okogora-brigades/1.0)',
        Accept: 'application/json,text/plain,*/*',
      },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`translate_http_${res.status}`);
    const data = await res.json();
    const translated = Array.isArray(data?.[0])
      ? data[0].map((chunk) => chunk?.[0] || '').join('').trim()
      : '';
    const out = translated || value;
    translateCache.set(value, out);
    return out;
  } catch {
    translateCache.set(value, value);
    return value;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchText(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; okogora-brigades/1.0)',
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

async function readJson(path, fallback) {
  try {
    return JSON.parse(await fs.readFile(path, 'utf8'));
  } catch {
    return fallback;
  }
}

function sanitizeItem(item) {
  return {
    ...item,
    title: decodeHtml(item.title || ''),
    summary: decodeHtml(item.summary || ''),
    titleUk: decodeHtml(item.titleUk || ''),
    summaryUk: decodeHtml(item.summaryUk || ''),
  };
}

async function main() {
  const cfg = await readJson(CONFIG_PATH, null);
  if (!cfg || !Array.isArray(cfg.brigades)) throw new Error('Invalid brigades_dashboard_config.json');

  const windowDays = Number(cfg.windowDays) > 0 ? Number(cfg.windowDays) : 3;
  const maxItemsPerBrigade = Number(cfg.maxItemsPerBrigade) > 0 ? Number(cfg.maxItemsPerBrigade) : 8;
  const maxItemsTotal = Number(cfg.maxItemsTotal) > 0 ? Number(cfg.maxItemsTotal) : 360;
  const significantKeywords = Array.isArray(cfg.significantKeywords) ? cfg.significantKeywords : [];
  const strikeKeywords = Array.isArray(cfg.strikeKeywords) && cfg.strikeKeywords.length
    ? cfg.strikeKeywords
    : ['удар', 'уражен', 'знищ', 'ліквід', 'влуч', 'strike', 'hit', 'destroy', 'eliminate', 'drone strike', 'бпла'];
  const reorgKeywords = Array.isArray(cfg.reorgKeywords) && cfg.reorgKeywords.length
    ? cfg.reorgKeywords
    : ['реорганіз', 'реформ', 'корпус', 'створенн', 'підпорядк', 'переформ', 'new corps', 'reorganization', 'command structure'];
  const excludeKeywords = Array.isArray(cfg.excludeKeywords) ? cfg.excludeKeywords : [];

  const xPool = await readJson(X_RSS_PATH, { items: [] });
  const fbPool = await readJson(FB_RSS_PATH, { items: [] });
  const mentionPool = [...(Array.isArray(xPool.items) ? xPool.items : []), ...(Array.isArray(fbPool.items) ? fbPool.items : [])]
    .filter((item) => item?.title && item?.url && withinDays(item.publishedAt, windowDays))
    .map((item) => ({
      id: `pool-${hashKey(item.url || item.title || item.publishedAt || '')}`,
      title: decodeHtml(item.titleUk || item.title || ''),
      summary: decodeHtml(item.summaryUk || item.summary || ''),
      url: item.url,
      publishedAt: toIsoOrNow(item.publishedAt),
      source: String(item.source || '').includes('facebook') ? 'facebook' : 'x',
      sourceLabel: item.handle || item.author || 'monitor',
      origin: 'mention',
    }));

  const classifyPost = (text) => {
    const strikeScore = keywordHitCount(text, strikeKeywords);
    const reorgScore = keywordHitCount(text, reorgKeywords);
    const baseScore = significanceScore(text, significantKeywords);
    const score = Math.min(9, baseScore + (strikeScore > 0 ? 2 : 0) + (reorgScore > 0 ? 2 : 0));
    return {
      score,
      strikeScore,
      reorgScore,
      isStrike: strikeScore > 0,
      isReorg: reorgScore > 0,
    };
  };

  const feedCache = new Map();

  async function fetchSourceItems(brigade, source) {
    const key = `${source.platform}:${source.handle}`;
    if (feedCache.has(key)) return feedCache.get(key);

    const factories = source.platform === 'facebook' ? FB_FEED_FACTORIES : X_FEED_FACTORIES;
    let out = [];

    for (const makeUrl of factories) {
      const url = makeUrl(source.handle);
      try {
        const xml = await fetchText(url);
        const meta = parseFeedMeta(xml);
        const identityBlob = normalizeText(`${meta.title} ${meta.description} ${meta.link} ${source.handle}`);
        const isIdentityValid = source.trusted || matchesAnyAlias(identityBlob, brigade.aliases || []);
        if (!isIdentityValid) continue;

        const items = parseItems(xml, source)
          .map((item) => ({ ...item, origin: 'official' }))
          .filter((item) => item.url && item.title && withinDays(item.publishedAt, windowDays));

        if (items.length > 0) {
          out = items;
          break;
        }
      } catch {
        // try next mirror
      }
    }

    feedCache.set(key, out);
    return out;
  }

  const brigadeRows = [];

  for (const brigade of cfg.brigades) {
    const aliases = Array.isArray(brigade.aliases) ? brigade.aliases : [];
    const sources = Array.isArray(brigade.sources) ? brigade.sources : [];

    const official = [];
    const seenOfficial = new Set();

    for (const source of sources) {
      if (!source?.platform || !source?.handle) continue;
      const items = await fetchSourceItems(brigade, source);
      for (const item of items) {
        const txt = `${item.title} ${item.summary}`;
        if (excludeKeywords.some((k) => normalizeText(k) && normalizeText(txt).includes(normalizeText(k)))) continue;

        const dedup = `${item.url}|${normalizeText(item.title)}`;
        if (seenOfficial.has(dedup)) continue;
        seenOfficial.add(dedup);

        const cls = classifyPost(txt);
        official.push({
          ...item,
          sourceLabel: source.handle,
          ...cls,
        });
      }
    }

    const mentions = [];
    const seenMention = new Set();
    for (const item of mentionPool) {
      const txt = `${item.title} ${item.summary}`;
      if (!matchesAnyAlias(txt, aliases)) continue;
      const dedup = `${item.url}|${normalizeText(item.title)}`;
      if (seenOfficial.has(dedup) || seenMention.has(dedup)) continue;
      seenMention.add(dedup);

      const cls = classifyPost(txt);
      mentions.push({
        ...item,
        ...cls,
      });
    }

    const allItems = [...official, ...mentions];
    const merged = allItems
      .sort((a, b) => {
        const sDiff = (b.score || 0) - (a.score || 0);
        if (sDiff !== 0) return sDiff;
        return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
      })
      .slice(0, maxItemsPerBrigade)
      .map(sanitizeItem);

    for (const item of merged) {
      // Lazy translate only chosen rows
      item.titleUk = await translateToUkrainian(item.title || '');
      item.summaryUk = await translateToUkrainian(item.summary || '');
    }

    const significantItems = allItems.filter((i) => (i.score || 0) >= 2).length;
    const strikeItems = allItems.filter((i) => i.isStrike).length;
    const reorgItems = allItems.filter((i) => i.isReorg).length;

    brigadeRows.push({
      id: brigade.id,
      name: brigade.name,
      aliases,
      sources,
      officialItems: official.length,
      mentionItems: mentions.length,
      significantItems,
      strikeItems,
      reorgItems,
      hasOfficialFeed: official.length > 0,
      items: merged,
    });
  }

  const sortedRows = brigadeRows
    .sort((a, b) => {
      const as = a.significantItems + a.officialItems + a.strikeItems * 2 + a.reorgItems;
      const bs = b.significantItems + b.officialItems + b.strikeItems * 2 + b.reorgItems;
      return bs - as;
    })
    .slice(0, Math.max(1, maxItemsTotal));

  const payload = {
    generatedAt: new Date().toISOString(),
    windowDays,
    totals: {
      brigades: sortedRows.length,
      brigadesWithOfficialFeeds: sortedRows.filter((b) => b.hasOfficialFeed).length,
      officialItems: sortedRows.reduce((acc, b) => acc + b.officialItems, 0),
      mentionItems: sortedRows.reduce((acc, b) => acc + b.mentionItems, 0),
      significantItems: sortedRows.reduce((acc, b) => acc + b.significantItems, 0),
      strikeItems: sortedRows.reduce((acc, b) => acc + b.strikeItems, 0),
      reorgItems: sortedRows.reduce((acc, b) => acc + b.reorgItems, 0),
    },
    brigades: sortedRows,
  };

  // Guardrail: do not overwrite good data with an empty snapshot caused by
  // temporary RSS/network outages.
  if (payload.totals.officialItems === 0 && payload.totals.mentionItems === 0) {
    const previous = await readJson(OUTPUT_PATH, null);
    const prevOfficial = Number(previous?.totals?.officialItems || 0);
    const prevMention = Number(previous?.totals?.mentionItems || 0);
    if (prevOfficial > 0 || prevMention > 0) {
      console.warn(
        `[syncBrigadesDashboard] empty refresh detected, keeping previous snapshot from ${previous.generatedAt || 'unknown time'}`
      );
      return;
    }
  }

  await fs.writeFile(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${OUTPUT_PATH}: brigades=${payload.totals.brigades}, official=${payload.totals.officialItems}, strike=${payload.totals.strikeItems}, reorg=${payload.totals.reorgItems}`);
}

main().catch((err) => {
  console.error('[syncBrigadesDashboard] failed:', err);
  process.exit(1);
});
