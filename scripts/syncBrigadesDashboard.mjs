import fs from 'node:fs/promises';
import crypto from 'node:crypto';

const CONFIG_PATH = 'public/data/brigades_dashboard_config.json';
const OUTPUT_PATH = 'public/data/brigades_dashboard.json';
const X_RSS_PATH = 'public/data/rss_twitter.json';
const FB_RSS_PATH = 'public/data/rss_facebook.json';

const X_FEED_FACTORIES = [
  (handle) => `https://rsshub.pseudoyu.com/twitter/user/${handle}`,
  (handle) => `https://rsshub.app/twitter/user/${handle}`,
];

const X_KEYWORD_FEED_FACTORIES = [
  (query) => `https://rsshub.pseudoyu.com/twitter/keyword/${encodeURIComponent(query)}`,
  (query) => `https://rsshub.app/twitter/keyword/${encodeURIComponent(query)}`,
];

const FB_FEED_FACTORIES = [
  (handle) => `https://rsshub.app/facebook/page/${handle}`,
  (handle) => `https://rsshub.pseudoyu.com/facebook/page/${handle}`,
  (handle) => `https://rsshub.uocat.com/facebook/page/${handle}`,
];

const TRANSLATE_ENDPOINT = 'https://translate.googleapis.com/translate_a/single';

const DEFAULT_UNIT_TERMS = [
  'бригад', 'баталь', 'полк', 'корпус', 'дивіз', 'підрозділ', 'частин',
  'assault brigade', 'mechanized brigade', 'artillery brigade', 'tank brigade',
  'air assault brigade', 'marine brigade', 'regiment', 'battalion',
];

const DEFAULT_UA_TERMS = [
  'зсу', 'збройн', 'україн', 'дшв', 'теробор', 'морськ', 'дпсу', 'нгу',
  'af of ukraine', 'ukrain', 'national guard of ukraine', 'armed forces of ukraine', 'afu',
];

const DEFAULT_EXCLUDE_PROFILE_TERMS = [
  'osint', 'report', 'reports', 'journal', 'media', 'news', 'аналiтик',
  'analyst', 'think tank', 'monitor', 'fund', 'charity', 'ngo', 'volunteer',
];

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

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function hasAnyKeyword(text, keywords) {
  const norm = normalizeText(text);
  return asArray(keywords).some((kw) => {
    const key = normalizeText(kw);
    return key && norm.includes(key);
  });
}

function extractXHandleFromUrl(url) {
  const m = String(url || '').match(/(?:x\.com|twitter\.com)\/([A-Za-z0-9_]{2,32})\/status\//i);
  return m ? m[1] : '';
}

function extractDisplayName(metaTitle, handle) {
  const t = decodeHtml(metaTitle || '').trim();
  const prefixMatch = t.match(/^twitter\s*@(.+)$/i);
  if (prefixMatch && prefixMatch[1]) return prefixMatch[1].trim();
  return handle ? `@${handle}` : t || 'Підрозділ';
}

function looksLikeUnitHandle(handle) {
  const h = String(handle || '').toLowerCase();
  return /(\d{1,3}|brig|brygad|batt|polk|regim|corps|marin|dshv|ombr|oshbr|odshbr|obrmp|ngu|sbs|ab3|army)/.test(h);
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
  return /[а-яіїєґё]/i.test(text || '');
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

function isLikelyUkrainianUnitProfile({ meta, handle, unitTerms, uaTerms, excludeProfileTerms }) {
  const blob = normalizeText(`${meta?.title || ''} ${meta?.description || ''} ${meta?.link || ''} ${handle || ''}`);
  const handleBlob = normalizeText(handle || '');
  const hasUnitTerm = hasAnyKeyword(blob, unitTerms);
  const hasUaTerm = hasAnyKeyword(blob, uaTerms);
  const hasUaHandleToken = /(afu|zsu|ngu|dshv|sbs|ua)/i.test(handleBlob);
  const hasExcludedTerm = hasAnyKeyword(blob, excludeProfileTerms);
  return hasUnitTerm && (hasUaTerm || hasUaHandleToken) && !hasExcludedTerm;
}

async function main() {
  const cfg = await readJson(CONFIG_PATH, null);
  if (!cfg) throw new Error('Invalid brigades_dashboard_config.json');
  const configuredUnits = asArray(cfg.units).length ? asArray(cfg.units) : asArray(cfg.brigades);
  if (!configuredUnits.length) throw new Error('No units in brigades_dashboard_config.json');

  const windowDays = Number(cfg.windowDays) > 0 ? Number(cfg.windowDays) : 3;
  const maxItemsPerBrigade = Number(cfg.maxItemsPerBrigade) > 0 ? Number(cfg.maxItemsPerBrigade) : 8;
  const maxItemsTotal = Number(cfg.maxItemsTotal) > 0 ? Number(cfg.maxItemsTotal) : 360;
  const minOfficialItems = Number(cfg.minOfficialItems) >= 0 ? Number(cfg.minOfficialItems) : 1;
  const includeMentionOnlyRows = Boolean(cfg.includeMentionOnlyRows);
  const significantKeywords = asArray(cfg.significantKeywords);
  const strikeKeywords = asArray(cfg.strikeKeywords).length
    ? cfg.strikeKeywords
    : ['удар', 'уражен', 'знищ', 'ліквід', 'влуч', 'strike', 'hit', 'destroy', 'eliminate', 'drone strike', 'бпла'];
  const reorgKeywords = asArray(cfg.reorgKeywords).length
    ? cfg.reorgKeywords
    : ['реорганіз', 'реформ', 'корпус', 'створенн', 'підпорядк', 'переформ', 'new corps', 'reorganization', 'command structure'];
  const excludeKeywords = asArray(cfg.excludeKeywords);

  const autoCfg = cfg.autoDiscovery || {};
  const autoEnabled = autoCfg.enabled !== false;
  const autoQueries = asArray(autoCfg.xKeywords).length
    ? asArray(autoCfg.xKeywords)
    : ['окрема бригада', 'окремий батальйон', 'полк зсу', 'корпус зсу', 'морська піхота україни', 'дшв зсу', 'тероборона бригада'];
  const autoMaxCandidates = Number(autoCfg.maxCandidates) > 0 ? Number(autoCfg.maxCandidates) : 12;
  const autoMaxNewUnits = Number(autoCfg.maxNewUnits) > 0 ? Number(autoCfg.maxNewUnits) : 25;
  const autoMinScore = Number(autoCfg.minScore) > 0 ? Number(autoCfg.minScore) : 3;
  const autoMinHits = Number(autoCfg.minHits) > 0 ? Number(autoCfg.minHits) : 1;
  const unitTerms = asArray(autoCfg.unitTerms).length ? asArray(autoCfg.unitTerms) : DEFAULT_UNIT_TERMS;
  const uaTerms = asArray(autoCfg.uaTerms).length ? asArray(autoCfg.uaTerms) : DEFAULT_UA_TERMS;
  const excludeProfileTerms = asArray(autoCfg.excludeProfileTerms).length
    ? asArray(autoCfg.excludeProfileTerms)
    : DEFAULT_EXCLUDE_PROFILE_TERMS;

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

  const twitterCfg = await readJson('public/data/rss_twitter_config.json', { authors: [] });
  const blockedHandles = new Set(
    [
      ...asArray(autoCfg.excludeHandles),
      ...asArray(twitterCfg.authors).map((x) => x?.handle).filter(Boolean),
    ].map((x) => String(x).toLowerCase())
  );

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

  async function fetchSourceBundle({ source, aliases = [], requireAliasMatch = true }) {
    const key = `${source.platform}:${source.handle}`;
    if (feedCache.has(key)) return feedCache.get(key);

    const factories = source.platform === 'facebook' ? FB_FEED_FACTORIES : X_FEED_FACTORIES;
    let outItems = [];
    let outMeta = null;

    for (const makeUrl of factories) {
      const url = makeUrl(source.handle);
      try {
        const xml = await fetchText(url);
        const meta = parseFeedMeta(xml);
        outMeta = meta;
        const identityBlob = normalizeText(`${meta.title} ${meta.description} ${meta.link} ${source.handle}`);
        const isIdentityValid = source.trusted || !requireAliasMatch || !aliases.length || matchesAnyAlias(identityBlob, aliases);
        if (!isIdentityValid) continue;

        const items = parseItems(xml, source)
          .map((item) => ({ ...item, origin: 'official' }))
          .filter((item) => item.url && item.title && withinDays(item.publishedAt, windowDays));

        if (items.length > 0) {
          outItems = items;
          break;
        }
      } catch {
        // try next mirror
      }
    }

    const result = { items: outItems, meta: outMeta };
    feedCache.set(key, result);
    return result;
  }

  async function fetchKeywordFeedItems(query) {
    const key = `x-keyword:${query}`;
    if (feedCache.has(key)) return feedCache.get(key);

    let outItems = [];
    for (const makeUrl of X_KEYWORD_FEED_FACTORIES) {
      const url = makeUrl(query);
      try {
        const xml = await fetchText(url);
        const src = { platform: 'x', handle: `keyword-${hashKey(query).slice(0, 8)}` };
        outItems = parseItems(xml, src)
          .filter((item) => item.url && item.title && withinDays(item.publishedAt, windowDays));
        if (outItems.length > 0) break;
      } catch {
        // try next mirror
      }
    }

    feedCache.set(key, outItems);
    return outItems;
  }

  const dashboardUnits = configuredUnits.map((unit, idx) => {
    const name = String(unit?.name || '').trim() || `Підрозділ ${idx + 1}`;
    const id = String(unit?.id || '').trim() || `unit-${hashKey(`${name}-${idx}`)}`;
    const aliases = Array.from(new Set([name, ...asArray(unit?.aliases).map((x) => String(x || '').trim()).filter(Boolean)]));
    const sources = asArray(unit?.sources)
      .filter((src) => src?.platform && src?.handle)
      .map((src) => ({ platform: String(src.platform).toLowerCase(), handle: String(src.handle).trim(), trusted: Boolean(src.trusted) }));
    return { ...unit, id, name, aliases, sources };
  });

  const knownHandles = new Set();
  for (const unit of dashboardUnits) {
    for (const src of asArray(unit.sources)) {
      if (String(src.platform).toLowerCase() === 'x') knownHandles.add(String(src.handle).toLowerCase());
    }
  }

  if (autoEnabled) {
    const candidateStats = new Map();
    const addCandidate = (handleRaw, score, sampleText = '') => {
      const handle = String(handleRaw || '').trim();
      if (!handle) return;
      const lower = handle.toLowerCase();
      if (blockedHandles.has(lower)) return;
      const prev = candidateStats.get(lower) || { handle, score: 0, hits: 0, sampleText: '' };
      prev.score += Number(score) || 0;
      prev.hits += 1;
      if (!prev.sampleText && sampleText) prev.sampleText = sampleText;
      candidateStats.set(lower, prev);
    };

    for (const item of mentionPool) {
      const txt = `${item.title || ''} ${item.summary || ''}`;
      for (const m of txt.match(/@([a-z0-9_]{2,32})/gi) || []) {
        addCandidate(m.replace(/^@/, ''), 1, txt);
      }
    }

    for (const q of autoQueries) {
      const items = await fetchKeywordFeedItems(q);
      for (const item of items) {
        const handle = extractXHandleFromUrl(item.url);
        if (!handle) continue;
        const txt = `${item.title || ''} ${item.summary || ''}`;
        let score = 1;
        if (hasAnyKeyword(txt, unitTerms)) score += 2;
        if (hasAnyKeyword(txt, uaTerms)) score += 1;
        addCandidate(handle, score, txt);
      }
    }

    const rankedCandidates = [...candidateStats.values()]
      .filter((x) => x.score >= autoMinScore)
      .filter((x) => x.hits >= autoMinHits || looksLikeUnitHandle(x.handle))
      .filter((x) => !knownHandles.has(x.handle.toLowerCase()))
      .sort((a, b) => (b.score - a.score) || (b.hits - a.hits))
      .slice(0, autoMaxCandidates);

    let autoAdded = 0;
    let autoEvaluated = 0;
    for (const cand of rankedCandidates) {
      if (autoAdded >= autoMaxNewUnits) break;
      autoEvaluated += 1;
      const source = { platform: 'x', handle: cand.handle, trusted: true };
      const { items, meta } = await fetchSourceBundle({ source, aliases: [], requireAliasMatch: false });
      if (!items.length) continue;
      if (items.length < minOfficialItems) continue;
      if (!isLikelyUkrainianUnitProfile({ meta, handle: cand.handle, unitTerms, uaTerms, excludeProfileTerms })) continue;

      const name = extractDisplayName(meta?.title || '', cand.handle);
      const aliases = Array.from(new Set([name, cand.handle, `@${cand.handle}`]));
      dashboardUnits.push({
        id: `unit-${cand.handle.toLowerCase()}`,
        name,
        aliases,
        sources: [source],
        autoDiscovered: true,
      });
      knownHandles.add(cand.handle.toLowerCase());
      autoAdded += 1;
    }
    console.log(`[syncBrigadesDashboard] auto-discovery candidates=${rankedCandidates.length}, evaluated=${autoEvaluated}, added=${autoAdded}`);
  }

  const brigadeRows = [];

  for (const brigade of dashboardUnits) {
    const aliases = Array.isArray(brigade.aliases) ? brigade.aliases : [];
    const sources = Array.isArray(brigade.sources) ? brigade.sources : [];

    const official = [];
    const seenOfficial = new Set();

    for (const source of sources) {
      if (!source?.platform || !source?.handle) continue;
      const { items } = await fetchSourceBundle({ source, aliases, requireAliasMatch: true });
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
      autoDiscovered: Boolean(brigade.autoDiscovered),
      officialItems: official.length,
      mentionItems: mentions.length,
      significantItems,
      strikeItems,
      reorgItems,
      hasOfficialFeed: official.length > 0,
      items: merged,
    });
  }

  const activeRows = brigadeRows.filter((row) =>
    includeMentionOnlyRows
      ? (row.officialItems + row.mentionItems) > 0
      : row.officialItems >= minOfficialItems
  );

  const sortedRows = activeRows
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
      units: sortedRows.length,
      unitsWithOfficialFeeds: sortedRows.filter((b) => b.hasOfficialFeed).length,
      autoDiscoveredUnits: sortedRows.filter((b) => b.autoDiscovered).length,
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
  console.log(
    `Wrote ${OUTPUT_PATH}: units=${payload.totals.units}, official=${payload.totals.officialItems}, strike=${payload.totals.strikeItems}, reorg=${payload.totals.reorgItems}, auto=${payload.totals.autoDiscoveredUnits}`
  );
}

main().catch((err) => {
  console.error('[syncBrigadesDashboard] failed:', err);
  process.exit(1);
});
