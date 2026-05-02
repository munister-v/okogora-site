import fs from 'node:fs/promises';
import crypto from 'node:crypto';

const CONFIG_PATH = 'public/data/strategic_maps_config.json';
const OUTPUT_PATH = 'public/data/strategic_targets.json';

const DEFAULT_CONFIG = {
  maxItems: 400,
  sources: [
    {
      id: 'stormap365-russo-ukrainian-war',
      name: 'StorMap365 / Russo-Ukrainian war',
      viewerUrl: 'https://www.google.com/maps/d/u/0/viewer?mid=1eZFpbhLP0dG-D351mWczHJ0-Fg4YbQs&ll',
      categoryHint: 'occupation',
      enabled: true,
      tags: ['EXTERNAL_LAYER', 'GOOGLE_MY_MAPS', 'RUSSIA', 'UKRAINE'],
    },
  ],
};

const REGION_UK = {
  kherson: 'Херсонської області',
  zaporizhye: 'Запорізької області',
  zaporizhzhia: 'Запорізької області',
  donetsk: 'Донецької області',
  luhansk: 'Луганської області',
  lugansk: 'Луганської області',
  kharkiv: 'Харківської області',
  sumy: 'Сумської області',
  dnipropetrovsk: 'Дніпропетровської області',
  mykolaiv: 'Миколаївської області',
};

const REGION_CONTEXT = {
  kherson: {
    military: 'контроль лівобережжя та вогневий вплив на дельту Дніпра',
    infra: 'логістика через прибережні траси, переправи та вузли постачання до Криму',
  },
  zaporizhye: {
    military: 'тиск на південному фронті та формування опорних рубежів',
    infra: 'вплив на сухопутний коридор, траси постачання і тилові склади',
  },
  zaporizhzhia: {
    military: 'тиск на південному фронті та формування опорних рубежів',
    infra: 'вплив на сухопутний коридор, траси постачання і тилові склади',
  },
  donetsk: {
    military: 'активні наступальні дії на ключових напрямках східного фронту',
    infra: 'контроль дорожніх вузлів, промислових зон та залізничних підходів',
  },
  luhansk: {
    military: 'закріплення рубежів і маневр резервами на східній ділянці',
    infra: 'використання дорожньої та залізничної мережі для перекидання сил',
  },
  lugansk: {
    military: 'закріплення рубежів і маневр резервами на східній ділянці',
    infra: 'використання дорожньої та залізничної мережі для перекидання сил',
  },
  kharkiv: {
    military: 'тиск на прикордонних секторах і спроби розширення плацдармів',
    infra: 'вплив на прикордонну логістику, магістралі та підвезення боєприпасів',
  },
  sumy: {
    military: 'активність у прикордонній зоні з ризиком диверсійного проникнення',
    infra: 'тиск на прикордонні траси, пункти накопичення та транспортні вузли',
  },
  dnipropetrovsk: {
    military: 'наближення бойової активності до центральних тилових районів',
    infra: 'загроза для транспортних коридорів і опорної логістики фронту',
  },
  mykolaiv: {
    military: 'вплив на оборону півдня та підходи до чорноморського узбережжя',
    infra: 'контроль прибережної інфраструктури, доріг та тилового забезпечення',
  },
  crimea: {
    military: 'стратегічний військовий плацдарм РФ на Чорному морі',
    infra: 'вузол аеродромної, морської та складської інфраструктури',
  },
  sevastopol: {
    military: 'базування корабельного компонента та військово-морських засобів',
    infra: 'портова інфраструктура, ремонтні потужності і логістика флоту',
  },
  tuzla: {
    military: 'контроль підходів у районі Керченської протоки',
    infra: 'вплив на морську логістику та інженерні обʼєкти протоки',
  },
  toretsk: {
    military: 'контактна зона з інтенсивними боями на тактичній глибині',
    infra: 'вузли доріг і міська інфраструктура у зоні вогневого впливу',
  },
  bakhmut: {
    military: 'виснажливі бої за тактичні висоти та опорні райони',
    infra: 'промислова та дорожня мережа як основа маневру підрозділів',
  },
  terny: {
    military: 'локальні штурмові дії на стиках підрозділів',
    infra: 'контроль польових шляхів і тактичних підʼїздів',
  },
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function hashKey(input) {
  return crypto.createHash('sha1').update(input).digest('hex').slice(0, 16);
}

function normalizeWhitespace(text) {
  return String(text || '')
    .replace(/\\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeTitleKey(title) {
  return normalizeWhitespace(title)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .trim();
}

function classifyCategory(title, hint = 'strategic') {
  const text = normalizeWhitespace(title).toLowerCase();
  if (/(captured|occupied|occupation|toretsk area|район)/i.test(text)) return 'occupation';
  if (/(airbase|airfield|аеродром|авіабаз)/i.test(text)) return 'airbase';
  if (/(naval|fleet|port|harbor|sevastopol|black sea|морськ)/i.test(text)) return 'naval';
  if (/(logistics|refinery|depot|warehouse|rail|supply|нпз|склад)/i.test(text)) return 'logistics';
  if (['occupation', 'airbase', 'naval', 'logistics', 'strategic'].includes(String(hint))) return hint;
  return 'strategic';
}

function extractRegion(rawTitle) {
  const title = normalizeWhitespace(rawTitle);
  const match = title.match(/part of the ([A-Za-z' -]+?) region/i);
  if (match?.[1]) return match[1].trim();
  if (/crimea/i.test(title)) return 'Crimea';
  if (/sevastopol/i.test(title)) return 'Sevastopol';
  if (/tuzla/i.test(title)) return 'Tuzla';
  if (/toretsk/i.test(title)) return 'Toretsk';
  if (/bakhmut/i.test(title)) return 'Bakhmut';
  if (/terny/i.test(title)) return 'Terny';
  return '';
}

function translateTitle(rawTitle) {
  const title = normalizeWhitespace(rawTitle);
  const region = extractRegion(title);
  const yearMatch = title.match(/\b(20\d{2})\b/);
  const yearSuffix = yearMatch ? ` (${yearMatch[1]})` : '';

  if (/captured crimea and sevastopol/i.test(title)) return 'Окуповані Крим і Севастополь';
  if (/captured tuzla/i.test(title)) return 'Окупована Тузла';
  if (/toretsk area/i.test(title)) return 'Район Торецька';

  if (region) {
    const regionKey = region.toLowerCase();
    const regionUk = REGION_UK[regionKey];
    if (regionUk) return `Окупована частина ${regionUk}${yearSuffix}`;
    if (region === 'Terny') return `Окупована частина району Тернів${yearSuffix}`;
    if (region === 'Bakhmut') return `Окупована частина району Бахмута${yearSuffix}`;
    if (region === 'Sevastopol') return `Окупований Севастополь${yearSuffix}`;
    if (region === 'Crimea') return `Окупований Крим${yearSuffix}`;
    if (region === 'Tuzla') return `Окупована Тузла${yearSuffix}`;
    if (region === 'Toretsk') return `Район Торецька${yearSuffix}`;
  }

  return title;
}

function extractYear(rawTitle) {
  const match = String(rawTitle || '').match(/\b(20\d{2})\b/);
  return match ? Number(match[1]) : null;
}

function regionContext(regionRaw) {
  const key = String(regionRaw || '').toLowerCase();
  return REGION_CONTEXT[key] || null;
}

function categoryContext(category) {
  if (category === 'airbase') {
    return {
      military: 'майданчик бойової авіації, БПЛА або засобів ППО',
      infra: 'злітно-посадкова та технічна інфраструктура забезпечення вильотів',
    };
  }
  if (category === 'naval') {
    return {
      military: 'військово-морський район із потенційною активністю корабельного складу',
      infra: 'портові споруди, причали, склади ПММ та обслуговування флоту',
    };
  }
  if (category === 'logistics') {
    return {
      military: 'тилова зона накопичення та перекидання ресурсів',
      infra: 'дорожні, залізничні або складські вузли постачання',
    };
  }
  if (category === 'occupation') {
    return {
      military: 'район окупаційної присутності та фортифікаційного закріплення',
      infra: 'контроль транспортних коридорів, вузлів і тилового забезпечення',
    };
  }
  return {
    military: 'стратегічний район із потенційним військовим значенням',
    infra: 'локальна критична інфраструктура у зоні моніторингу',
  };
}

function buildStrategicNote({ rawTitle, titleUk, category, region, radiusMeters }) {
  const year = extractYear(rawTitle);
  const categoryInfo = categoryContext(category);
  const regionInfo = regionContext(region);
  const lead = year
    ? `Зона зафіксована у шарі ${year} року.`
    : 'Зона зафіксована у зовнішньому стратегічному шарі.';
  const military = regionInfo?.military || categoryInfo.military;
  const infra = regionInfo?.infra || categoryInfo.infra;
  const radiusKm = Math.round(Number(radiusMeters || 0) / 1000);
  const sizeText = radiusKm > 0 ? `Оціночний радіус покриття: близько ${radiusKm} км.` : '';

  return `${lead} Воєнний контекст: ${military}. Інфраструктурний контекст: ${infra}. ${sizeText} Назва з джерела: ${titleUk || rawTitle}.`
    .replace(/\s+/g, ' ')
    .trim();
}

function approxRadiusMeters(bbox) {
  if (!Array.isArray(bbox) || bbox.length !== 4) return 7000;
  const [minLng, maxLat, maxLng, minLat] = bbox.map(Number);
  if ([minLng, maxLat, maxLng, minLat].some((value) => Number.isNaN(value))) return 7000;

  const latSpanKm = Math.abs(maxLat - minLat) * 111.32;
  const meanLatRad = ((maxLat + minLat) / 2) * Math.PI / 180;
  const lngSpanKm = Math.abs(maxLng - minLng) * 111.32 * Math.max(0.2, Math.cos(meanLatRad));
  const diagKm = Math.sqrt(latSpanKm * latSpanKm + lngSpanKm * lngSpanKm);

  return Math.round(clamp(Math.max(diagKm * 560, 4000), 4000, 160000));
}

async function loadConfig() {
  try {
    const raw = JSON.parse(await fs.readFile(CONFIG_PATH, 'utf8'));
    return {
      maxItems: Number(raw?.maxItems) > 0 ? Number(raw.maxItems) : DEFAULT_CONFIG.maxItems,
      sources: Array.isArray(raw?.sources) && raw.sources.length ? raw.sources : DEFAULT_CONFIG.sources,
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

async function fetchViewerHtml(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; okogora-strategic-sync/1.0)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'uk-UA,uk;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      redirect: 'follow',
      signal: controller.signal,
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    if (!text.includes('_pageData')) throw new Error('page_data_missing');
    return text;
  } finally {
    clearTimeout(timer);
  }
}

function extractPageDataString(html) {
  const match = html.match(/var _pageData = "([\s\S]*?)";<\/script>/);
  if (!match?.[1]) throw new Error('page_data_extract_failed');
  return match[1];
}

function decodePageData(raw) {
  const decoded = JSON.parse(`"${raw}"`);
  return JSON.parse(decoded);
}

function traverseArrays(node, visitor) {
  if (!Array.isArray(node)) return;
  visitor(node);
  for (const child of node) {
    traverseArrays(child, visitor);
  }
}

function extractFeatureFromNode(node, source, mapTitle) {
  if (!Array.isArray(node) || node.length < 6) return null;

  const geometry = node[4];
  const labelData = node[5];
  if (!Array.isArray(geometry) || !Array.isArray(labelData)) return null;

  const bbox = Array.isArray(geometry[0]) && Array.isArray(geometry[0][0]) ? geometry[0][0] : null;
  const position = Array.isArray(geometry[4]) ? geometry[4] : null;
  const externalId = typeof geometry[6] === 'string' ? geometry[6] : '';
  const layerId = typeof geometry[3] === 'string' ? geometry[3] : '';
  const rawTitle = Array.isArray(labelData[0]) ? normalizeWhitespace(labelData[0][0]) : '';

  if (!rawTitle || !externalId || !layerId) return null;
  if (!Array.isArray(bbox) || bbox.length !== 4) return null;
  if (!Array.isArray(position) || position.length < 2) return null;
  if (/^(многоугольник|polygon)\b/i.test(rawTitle)) return null;

  const lat = Number(position[0]);
  const lng = Number(position[1]);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;

  const category = classifyCategory(rawTitle, source.categoryHint);
  const translatedTitle = translateTitle(rawTitle);
  const region = extractRegion(rawTitle);
  const radiusMeters = approxRadiusMeters(bbox);

  return {
    id: `strat-${source.id}-${externalId.toLowerCase()}`,
    sourceId: source.id,
    sourceName: source.name,
    sourceUrl: source.viewerUrl,
    mapTitle,
    title: rawTitle,
    titleUk: translatedTitle,
    category,
    region,
    layerLabel: source.name,
    position: [lat, lng],
    bbox: bbox.map(Number),
    radiusMeters,
    note: buildStrategicNote({ rawTitle, titleUk: translatedTitle, category, region, radiusMeters }),
    importedAt: new Date().toISOString(),
    tags: Array.from(new Set([...(source.tags || []), category.toUpperCase()])),
  };
}

function deduplicateItems(items, maxItems) {
  const seenIds = new Set();
  const seenKeys = new Set();

  return items
    .filter((item) => {
      if (seenIds.has(item.id)) return false;
      seenIds.add(item.id);

      const key = `${normalizeTitleKey(item.titleUk || item.title)}|${item.position[0].toFixed(4)}|${item.position[1].toFixed(4)}`;
      if (seenKeys.has(key)) return false;
      seenKeys.add(key);
      return true;
    })
    .slice(0, maxItems);
}

async function main() {
  const config = await loadConfig();
  const enabledSources = (config.sources || []).filter((source) => source && source.enabled !== false && source.viewerUrl);

  let previousItems = [];
  try {
    const prev = JSON.parse(await fs.readFile(OUTPUT_PATH, 'utf8'));
    previousItems = Array.isArray(prev?.items) ? prev.items : [];
  } catch {
    previousItems = [];
  }

  const allItems = [];
  const sourceStats = [];

  for (const source of enabledSources) {
    try {
      const html = await fetchViewerHtml(source.viewerUrl);
      const pageData = decodePageData(extractPageDataString(html));
      const mapTitle = String(pageData?.[1]?.[2] || source.name || 'External Map');
      const features = [];

      traverseArrays(pageData, (node) => {
        const feature = extractFeatureFromNode(node, source, mapTitle);
        if (feature) features.push(feature);
      });

      const uniqueFeatures = deduplicateItems(features, config.maxItems);
      allItems.push(...uniqueFeatures);
      sourceStats.push({
        id: source.id,
        name: source.name,
        viewerUrl: source.viewerUrl,
        mapTitle,
        itemCount: uniqueFeatures.length,
        ok: true,
      });
      console.log(`OK ${source.id} -> ${uniqueFeatures.length}`);
    } catch (error) {
      sourceStats.push({
        id: source.id,
        name: source.name,
        viewerUrl: source.viewerUrl,
        itemCount: 0,
        ok: false,
        error: String(error?.message || error),
      });
      console.log(`FAIL ${source.id}: ${String(error?.message || error)}`);
    }
  }

  let items = deduplicateItems(allItems, config.maxItems);
  if (items.length < 10 && previousItems.length > 0) {
    items = deduplicateItems(previousItems, config.maxItems);
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    itemCount: items.length,
    sources: sourceStats,
    items,
  };

  await fs.writeFile(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`Saved ${items.length} strategic items`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
