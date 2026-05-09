import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, CircleMarker, GeoJSON, LayersControl, useMapEvents, Polyline, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import type { PathOptions } from 'leaflet';
import type { GeoJsonObject, Feature } from 'geojson';

function territoryStyle(feature?: Feature): PathOptions {
  const props = feature?.properties ?? {};
  return {
    color: (props['stroke'] as string) ?? '#c9a227',
    fillColor: (props['fill'] as string) ?? 'transparent',
    opacity: (props['stroke-opacity'] as number) ?? 1,
    fillOpacity: (props['fill-opacity'] as number) ?? 0.35,
    weight: props['stroke-width'] != null ? (props['stroke-width'] as number) * 1.05 : 1.5,
  };
}

const canvasRenderer = L.canvas({ padding: 0.5 });

function TerritoryLayer({ geojson }: { geojson: GeoJsonObject }) {
  return (
    <GeoJSON
      key="territory-layer"
      data={geojson}
      style={territoryStyle}
      renderer={canvasRenderer}
      onEachFeature={(feature, layer) => {
        const name = feature.properties?.name;
        const desc = feature.properties?.description;
        if (name || desc) {
          layer.bindPopup(
            `<div style="font-family:monospace;font-size:11px"><b>${name ?? ''}</b>${desc ? `<br>${desc}` : ''}</div>`
          );
        }
      }}
    />
  );
}
import { Map as MapIcon, Shield, Target, Anchor, Plane, Filter, Menu, X as CloseIcon, Ruler, Activity, Clock } from 'lucide-react';
import type { Post, StrategicTarget } from '../types';
import { postTelegramUrl } from '../lib/posts';

type OperationalFilterId = 'strikes' | 'navy' | 'airbases' | 'logistics';
type FilterId = OperationalFilterId | 'strategic';

type RssItem = {
  id: string;
  title: string;
  titleUk?: string;
  summary: string;
  summaryUk?: string;
  publishedAt: string;
  url: string;
  author?: string;
};

type FeedEvent = {
  id: string;
  title: string;
  excerpt: string;
  dateIso: string;
  source: 'telegram' | 'rss' | 'facebook';
  sourceName: string;
  sourceUrl: string;
  type: OperationalFilterId;
  location: string;
  position: [number, number];
  confidence: number;
  precision: 'exact' | 'settlement';
  status: 'ПІДТВЕРДЖЕНО' | 'ЙМОВІРНО' | 'АНАЛІТИКА';
};

type LocationPoint = {
  name: string;
  aliases: string[];
  position: [number, number];
  typeHint?: OperationalFilterId;
  precision: 'exact' | 'settlement' | 'broad';
};

type StrategicFeed = {
  generatedAt?: string;
  itemCount?: number;
  items?: StrategicTarget[];
};

const LOCATION_POINTS: LocationPoint[] = [
  { name: 'Туапсе', aliases: ['туапсе', 'tuapse'], position: [44.1065, 39.0739], typeHint: 'logistics', precision: 'settlement' },
  { name: 'Авіабаза Шагол', aliases: ['шагол', 'shagol', 'chelyabinsk shagol'], position: [55.2572, 61.2983], typeHint: 'airbases', precision: 'exact' },
  { name: 'Дружне (Крим)', aliases: ['дружне', 'druzhne', 'druzhnoe'], position: [44.8972, 34.2917], typeHint: 'strikes', precision: 'settlement' },
  { name: 'Севастополь', aliases: ['севастополь', 'sevastopol'], position: [44.6167, 33.5254], typeHint: 'navy', precision: 'settlement' },
  { name: 'Степногірськ', aliases: ['stepnohirsk', 'степногірськ'], position: [47.5167, 35.7833], typeHint: 'strikes', precision: 'settlement' },
  { name: 'Перм', aliases: ['перм', 'perm'], position: [58.0105, 56.2502], typeHint: 'logistics', precision: 'settlement' },
  { name: 'Бєлгород', aliases: ['белгород', 'бєлгород', 'belgorod'], position: [50.5954, 36.5879], typeHint: 'logistics', precision: 'settlement' },
  { name: 'Чілія', aliases: ['chilia', 'chilia veche'], position: [45.4167, 29.2833], typeHint: 'airbases', precision: 'settlement' },
  { name: 'Покровськ', aliases: ['покровськ', 'pokrovsk'], position: [48.282, 37.181], typeHint: 'strikes', precision: 'settlement' },
  { name: 'Лиман', aliases: ['лиман', 'lyman'], position: [49.0139, 37.8028], typeHint: 'strikes', precision: 'settlement' },
  { name: 'Купʼянськ', aliases: ['купʼянськ', 'купянськ', 'kupyansk'], position: [49.7106, 37.6156], typeHint: 'strikes', precision: 'settlement' },
  { name: 'Торецьк', aliases: ['торецьк', 'toretsk'], position: [48.3986, 37.8472], typeHint: 'strikes', precision: 'settlement' },
  { name: 'Краматорськ', aliases: ['краматорськ', 'kramatorsk'], position: [48.7231, 37.5563], typeHint: 'strikes', precision: 'settlement' },
  { name: 'Оріхів', aliases: ['оріхів', 'орехов', 'orikhiv'], position: [47.5676, 35.7851], typeHint: 'strikes', precision: 'settlement' },
  { name: 'Гуляйполе', aliases: ['гуляйпол', 'huliaipole', 'gulyaypole'], position: [47.6642, 36.2572], typeHint: 'strikes', precision: 'settlement' },
  { name: 'Вовчанськ', aliases: ['вовчанськ', 'volchansk', 'vovchansk'], position: [50.2908, 36.9419], typeHint: 'strikes', precision: 'settlement' },
  { name: 'Сіверськ', aliases: ['сіверськ', 'seversk', 'siversk'], position: [48.8686, 38.102], typeHint: 'strikes', precision: 'settlement' },
  { name: 'Часів Яр', aliases: ['часів яр', 'chasiv yar'], position: [48.5864, 37.8326], typeHint: 'strikes', precision: 'settlement' }
];

const KEYWORDS: Record<OperationalFilterId, RegExp[]> = {
  strikes: [
    /уражен/gi, /знищен/gi, /удар/gi, /strike/gi, /struck/gi, /hit\b/gi, /destroyed/gi, /attack/gi, /drone/gi, /бпла/gi, /влуч/gi
  ],
  navy: [
    /navy/gi, /fleet/gi, /морськ/gi, /sea\b/gi, /black sea/gi, /порт/gi, /harbor/gi, /бухт/gi, /кораб/gi, /vessel/gi
  ],
  airbases: [
    /аеродром/gi, /airbase/gi, /airfield/gi, /f-16/gi, /су-\d+/gi, /air defense/gi, /ппо/gi, /авіабаз/gi, /scrambled/gi
  ],
  logistics: [
    /логіст/gi, /logistics/gi, /нпз/gi, /refinery/gi, /depot/gi, /склад/gi, /rail/gi, /конво/gi, /колон/gi, /supply/gi
  ]
};

const CONFIRMED_RE = /(підтвердж|confirmed|destroyed|знищен|уражен|successful hit|occupied)/i;
const PROBABLE_RE = /(ймовір|likely|assess|reportedly|можливо|claimed)/i;
const MIN_EVENT_CONFIDENCE = 0.55;
const UKR_MONTHS: Record<string, number> = {
  січ: 0,
  фев: 1,
  лют: 1,
  мар: 2,
  квіт: 3,
  апр: 3,
  трав: 4,
  май: 4,
  черв: 5,
  лип: 6,
  серп: 7,
  вер: 8,
  жовт: 9,
  ноя: 10,
  лист: 10,
  груд: 11,
  дек: 11,
};

const createTacticalIcon = (color: string, label: string) => new L.DivIcon({
  className: 'tactical-marker',
  html: `
    <div class="relative group">
      <div style="position:absolute;inset:0;border-radius:50%;background-color:${color}33;animation:ping 1.2s cubic-bezier(0,0,0.2,1) infinite"></div>
      <div style="width:14px;height:14px;background-color:${color};border:2px solid #fff;border-radius:50%;box-shadow:0 0 14px ${color};position:relative;z-index:10"></div>
      <div style="position:absolute;left:20px;top:50%;transform:translateY(-50%);background:rgba(17,17,17,0.95);color:#fff;font-size:8px;font-family:monospace;padding:2px 6px;white-space:nowrap;border:1px solid rgba(255,255,255,0.1);opacity:0;pointer-events:none;z-index:50">
        ${label}
      </div>
    </div>
  `,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function cleanText(text: string) {
  return (text || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeForKey(text: string) {
  return cleanText(text)
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parsePostDate(value: string) {
  const raw = (value || '').toLowerCase().replace(/\./g, '').trim();
  const m = raw.match(/(\d{1,2})\s+([\p{L}]+)\s+(\d{4})(?:\s*\/\s*(\d{1,2}):(\d{2}))?/u);
  if (!m) return new Date().toISOString();

  const day = Number(m[1]);
  const monthKey = m[2].slice(0, 4);
  const month = UKR_MONTHS[monthKey] ?? UKR_MONTHS[m[2].slice(0, 3)] ?? new Date().getMonth();
  const year = Number(m[3]);
  const hour = Number(m[4] || 0);
  const minute = Number(m[5] || 0);
  const d = new Date(Date.UTC(year, month, day, hour, minute));
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function findLocations(text: string) {
  const low = text.toLowerCase();
  const matched = LOCATION_POINTS.filter((point) => point.aliases.some((alias) => low.includes(alias.toLowerCase())));

  const uniq = new Map<string, LocationPoint>();
  matched.forEach((loc) => {
    uniq.set(`${loc.name}:${loc.position[0]}:${loc.position[1]}`, loc);
  });
  return Array.from(uniq.values());
}

function countMatches(text: string, patterns: RegExp[]) {
  return patterns.reduce((acc, pattern) => {
    const matches = text.match(pattern);
    return acc + (matches?.length || 0);
  }, 0);
}

function classifyType(text: string, locationHints: OperationalFilterId[]) {
  const scores: Record<OperationalFilterId, number> = {
    strikes: countMatches(text, KEYWORDS.strikes),
    navy: countMatches(text, KEYWORDS.navy),
    airbases: countMatches(text, KEYWORDS.airbases),
    logistics: countMatches(text, KEYWORDS.logistics),
  };

  for (const hint of locationHints) {
    scores[hint] += 2;
  }

  let best: OperationalFilterId = 'strikes';
  let bestScore = -1;
  (Object.keys(scores) as OperationalFilterId[]).forEach((k) => {
    if (scores[k] > bestScore) {
      best = k;
      bestScore = scores[k];
    }
  });

  return { type: best, score: bestScore };
}

function statusFromText(text: string): FeedEvent['status'] {
  if (CONFIRMED_RE.test(text)) return 'ПІДТВЕРДЖЕНО';
  if (PROBABLE_RE.test(text)) return 'ЙМОВІРНО';
  return 'АНАЛІТИКА';
}

function scoreConfidence(keywordScore: number, locationCount: number, source: 'telegram' | 'rss' | 'facebook', status: FeedEvent['status']) {
  let conf = 0.44 + Math.min(keywordScore, 7) * 0.055 + Math.min(locationCount, 2) * 0.16;
  if (source === 'telegram') conf += 0.07;
  if (source === 'facebook') conf += 0.02;
  if (status === 'ПІДТВЕРДЖЕНО') conf += 0.08;
  if (status === 'ЙМОВІРНО') conf -= 0.03;
  return clamp(conf, 0.35, 0.97);
}

function precisionLabel(value: FeedEvent['precision']) {
  return value === 'exact' ? 'ТОЧНА ТОЧКА' : 'ЦЕНТР НАСЕЛЕНОГО ПУНКТУ';
}

function confidenceLabel(value: number) {
  if (value >= 0.78) return 'ВИСОКА';
  if (value >= 0.62) return 'СЕРЕДНЯ';
  return 'БАЗОВА';
}

function withinDays(iso: string, days: number) {
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return false;
  const min = Date.now() - days * 24 * 60 * 60 * 1000;
  return ts >= min;
}

function strategicCategoryLabel(category: StrategicTarget['category']) {
  switch (category) {
    case 'occupation':
      return 'ОКУПАЦІЙНА ЗОНА';
    case 'airbase':
      return 'АВІАЦІЙНИЙ ОБʼЄКТ';
    case 'naval':
      return 'МОРСЬКИЙ ОБʼЄКТ';
    case 'logistics':
      return 'ЛОГІСТИЧНИЙ ОБʼЄКТ';
    default:
      return 'СТРАТЕГІЧНИЙ ШАР';
  }
}

function strategicYear(item: StrategicTarget) {
  const text = `${item.titleUk || ''} ${item.title || ''}`;
  const match = text.match(/\b(20\d{2})\b/);
  return match ? Number(match[1]) : null;
}

function strategicYearLabel(year: number | null) {
  if (!year) return 'БЕЗ ДАТИ';
  return `${year}`;
}

function strategicAccent(item: StrategicTarget) {
  const year = strategicYear(item);
  if (year === 2022) return '#7dd3fc';
  if (year === 2024) return '#facc15';
  if (year === 2025) return '#fb923c';
  if (year === 2026) return '#f43f5e';
  return strategicCategoryColor(item.category);
}

function strategicCategoryColor(category: StrategicTarget['category']) {
  switch (category) {
    case 'occupation':
      return '#ff7a00';
    case 'airbase':
      return '#ffcc00';
    case 'naval':
      return '#4cc3ff';
    case 'logistics':
      return '#00d27a';
    default:
      return '#d8d8d8';
  }
}

function buildEvents(posts: Post[], rss: RssItem[], facebook: RssItem[], windowDays = 14) {
  const events: FeedEvent[] = [];
  const dedup = new Set<string>();

  const postItems = (posts || []).map((post) => ({
    id: post.id,
    title: post.title || '',
    excerpt: post.text || '',
    dateIso: parsePostDate(post.date),
    source: 'telegram' as const,
    sourceName: 'Telegram',
    sourceUrl: postTelegramUrl(post),
  }));

  const rssItems = (rss || []).map((item) => ({
    id: item.id,
    title: item.titleUk || item.title || '',
    excerpt: item.summaryUk || item.summary || '',
    dateIso: item.publishedAt || new Date().toISOString(),
    source: 'rss' as const,
    sourceName: item.author ? `X / ${item.author}` : 'X RSS',
    sourceUrl: item.url,
  }));

  const facebookItems = (facebook || []).map((item) => ({
    id: item.id,
    title: item.titleUk || item.title || '',
    excerpt: item.summaryUk || item.summary || '',
    dateIso: item.publishedAt || new Date().toISOString(),
    source: 'facebook' as const,
    sourceName: item.author ? `Facebook / ${item.author}` : 'Facebook RSS',
    sourceUrl: item.url,
  }));

  const feed = [...postItems, ...rssItems, ...facebookItems];

  for (const item of feed) {
    if (!withinDays(item.dateIso, windowDays)) continue;
    const raw = `${item.title} ${item.excerpt}`;
    const clean = cleanText(raw);
    if (!clean) continue;

    const locations = findLocations(clean);
    if (locations.length === 0) continue;

    const locationHints = locations
      .map((loc) => loc.typeHint)
      .filter(Boolean) as OperationalFilterId[];

    const { type, score } = classifyType(clean, locationHints);
    const status = statusFromText(clean);
    const confidence = scoreConfidence(score, locations.length, item.source, status);
    if (confidence < MIN_EVENT_CONFIDENCE) continue;

    for (const location of locations.filter((loc) => loc.precision !== 'broad').slice(0, 1)) {
      const normKey = `${normalizeForKey(item.title).slice(0, 96)}|${location.name}|${type}`;
      if (dedup.has(normKey)) continue;
      dedup.add(normKey);

      events.push({
        id: `${item.id}:${location.name}`,
        title: cleanText(item.title),
        excerpt: cleanText(item.excerpt),
        dateIso: item.dateIso,
        source: item.source,
        sourceName: item.sourceName,
        sourceUrl: item.sourceUrl,
        type,
        location: location.name,
        position: location.position,
        confidence,
        precision: location.precision === 'exact' ? 'exact' : 'settlement',
        status,
      });
    }
  }

  return events
    .sort((a, b) => {
      const dt = new Date(b.dateIso).getTime() - new Date(a.dateIso).getTime();
      if (dt !== 0) return dt;
      return b.confidence - a.confidence;
    })
    .slice(0, 60);
}

function MapEvents({ onMouseMove, onClick }: { onMouseMove: (lat: number, lng: number) => void; onClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    mousemove(e) {
      onMouseMove(e.latlng.lat, e.latlng.lng);
    },
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function MapService() {
  const [activeFilters, setActiveFilters] = useState<FilterId[]>(['strikes', 'navy', 'airbases', 'logistics', 'strategic']);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showOnlyExactEvents, setShowOnlyExactEvents] = useState(false);
  const [telemetry, setTelemetry] = useState({ lat: 45.0, lng: 35.0 });
  const [measurePoints, setMeasurePoints] = useState<[number, number][]>([]);
  const [distance, setDistance] = useState<number | null>(null);
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [strategicItems, setStrategicItems] = useState<StrategicTarget[]>([]);
  const [strategicGeneratedAt, setStrategicGeneratedAt] = useState('');
  const [territoryGeojson, setTerritoryGeojson] = useState<GeoJsonObject | null>(null);
  const [territoryStatus, setTerritoryStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  const icons = useMemo(() => ({
    strikes: createTacticalIcon('#ff3333', 'Подія з геотегом'),
    navy: createTacticalIcon('#3399ff', 'Морський обʼєкт'),
    airbases: createTacticalIcon('#ffcc00', 'Авіаційний обʼєкт'),
    logistics: createTacticalIcon('#00ff66', 'Логістика'),
    strategic: createTacticalIcon('#ff7a00', 'Зовнішній геошар'),
  }), []);

  useEffect(() => {
    let mounted = true;

    function loadData() {
      const t = Date.now();
      Promise.all([
        fetch(`/data/rss_twitter.json?_t=${t}`).then((r) => (r.ok ? r.json() : { items: [] })),
        fetch(`/data/rss_facebook.json?_t=${t}`).then((r) => (r.ok ? r.json() : { items: [] })),
        fetch(`/data/strategic_targets.json?_t=${t}`).then((r) => (r.ok ? r.json() : { items: [] })),
      ])
        .then(([rssData, fbData, strategicData]) => {
          if (!mounted) return;
          const mapped = buildEvents(
            [],
            Array.isArray(rssData?.items) ? rssData.items : [],
            Array.isArray(fbData?.items) ? fbData.items : [],
            7,
          );
          setEvents(mapped);
          const strategicFeed = strategicData as StrategicFeed;
          const items = Array.isArray(strategicFeed?.items) ? strategicFeed.items : [];
          setStrategicItems(items);
          setStrategicGeneratedAt(strategicFeed?.generatedAt || '');
        })
        .catch(() => {});
    }

    loadData();
    const interval = setInterval(loadData, 5 * 60 * 1000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(`/data/territory_geojson.json?_t=${Math.floor(Date.now() / (6 * 60 * 60 * 1000))}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<GeoJsonObject>;
      })
      .then((data) => {
        if (!cancelled) { setTerritoryGeojson(data); setTerritoryStatus('ready'); }
      })
      .catch(() => {
        if (!cancelled) setTerritoryStatus('error');
      });
    return () => { cancelled = true; };
  }, []);

  const filteredEvents = useMemo(
    () => events.filter((e) => activeFilters.includes(e.type) && (!showOnlyExactEvents || e.precision === 'exact')),
    [events, activeFilters, showOnlyExactEvents],
  );

  const filteredStrategicItems = useMemo(
    () => (activeFilters.includes('strategic') ? strategicItems : []),
    [activeFilters, strategicItems],
  );

  const activityByType = useMemo(() => {
    const acc: Record<FilterId, number> = { strikes: 0, navy: 0, airbases: 0, logistics: 0, strategic: strategicItems.length };
    for (const e of events) acc[e.type] += 1;
    return acc;
  }, [events, strategicItems.length]);

  const mapCenter: [number, number] = useMemo(() => {
    const combined = [
      ...filteredEvents.map((event) => event.position),
      ...filteredStrategicItems.map((item) => item.position),
    ];
    if (combined.length === 0) return [47.2, 34.6];
    const sample = combined.slice(0, 12);
    const lat = sample.reduce((sum, position) => sum + position[0], 0) / sample.length;
    const lng = sample.reduce((sum, position) => sum + position[1], 0) / sample.length;
    return [lat, lng];
  }, [filteredEvents, filteredStrategicItems]);

  const exactEventCount = useMemo(() => events.filter((event) => event.precision === 'exact').length, [events]);
  const settlementEventCount = Math.max(0, events.length - exactEventCount);

  const sidebarStrategicItems = useMemo(
    () => filteredStrategicItems.slice(0, 4),
    [filteredStrategicItems],
  );

  const strategicUpdatedLabel = useMemo(() => {
    if (!strategicGeneratedAt) return '';
    try {
      return new Date(strategicGeneratedAt).toLocaleString('uk-UA', { dateStyle: 'short', timeStyle: 'short' });
    } catch {
      return strategicGeneratedAt;
    }
  }, [strategicGeneratedAt]);

  const strategicTopRegions = useMemo(() => {
    const counter = new Map<string, number>();
    for (const item of strategicItems) {
      const region = item.region || 'Інші зони';
      counter.set(region, (counter.get(region) || 0) + 1);
    }
    return Array.from(counter.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
  }, [strategicItems]);

  const strategicYearBands = useMemo(() => {
    const counter = new Map<string, number>();
    for (const item of strategicItems) {
      const yearKey = strategicYearLabel(strategicYear(item));
      counter.set(yearKey, (counter.get(yearKey) || 0) + 1);
    }
    return Array.from(counter.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [strategicItems]);

  const toggleFilter = (filter: FilterId) => {
    setActiveFilters((prev) =>
      prev.includes(filter) ? prev.filter((f) => f !== filter) : [...prev, filter],
    );
  };

  const calculateDistance = (p1: [number, number], p2: [number, number]) => {
    const lat1 = p1[0], lon1 = p1[1], lat2 = p2[0], lon2 = p2[1];
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const handleMapClick = (lat: number, lng: number) => {
    if (measurePoints.length === 2) {
      setMeasurePoints([[lat, lng]]);
      setDistance(null);
    } else if (measurePoints.length === 1) {
      const newPoints: [number, number][] = [...measurePoints, [lat, lng]];
      setMeasurePoints(newPoints);
      setDistance(calculateDistance(newPoints[0], newPoints[1]));
    } else {
      setMeasurePoints([[lat, lng]]);
    }
  };

  return (
    <div className="w-full flex flex-col font-sans">
      <div className="flex justify-between items-center mb-4 md:mb-6 font-mono text-[10px] md:text-xs uppercase tracking-[0.2em] border-b border-[#111111] pb-3">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-ping" />
          <MapIcon className="w-4 h-4" />
          <span className="font-bold">ТАКТИЧНИЙ МОНІТОР // АКТУАЛЬНІ RSS-ПОДІЇ</span>
        </div>
        <div className="flex items-center gap-4 md:gap-6 text-[#111111]/55">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="flex items-center gap-2 bg-[#111111] text-white px-3 py-1 text-[9px] hover:bg-zinc-800 transition-colors font-semibold"
          >
            {isSidebarOpen ? <CloseIcon className="w-3 h-3" /> : <Menu className="w-3 h-3" />}
            {isSidebarOpen ? 'ПРИХОВАТИ ПАНЕЛЬ' : 'ПОКАЗАТИ ПАНЕЛЬ'}
          </button>
          <div className="flex items-center gap-2 text-red-500 font-bold border-l border-[#111111]/10 pl-4 animate-pulse">
            <Activity className="w-3 h-3" />
            <span>{events.length + strategicItems.length} ТОЧОК</span>
          </div>
        </div>
      </div>

      <div className="relative w-full h-[520px] md:h-[800px] bg-[#0a0a0a] border border-[#111111]/20 overflow-hidden group shadow-2xl">
        <div className={`absolute top-4 md:top-6 left-4 md:left-6 z-[400] w-64 md:w-72 space-y-4 transition-all duration-700 ease-in-out ${isSidebarOpen ? 'translate-x-0 opacity-100' : '-translate-x-[120%] opacity-0 pointer-events-none'}`}>
          <div className="bg-[#111111]/95 backdrop-blur-xl border border-[#f4f4f4]/10 p-5 shadow-2xl">
            <div className="flex items-center gap-2 mb-5 border-b border-[#f4f4f4]/10 pb-3">
              <Filter className="w-3 h-3 text-blue-400" />
              <span className="font-mono text-[10px] uppercase tracking-widest text-white/80">Фільтри карти</span>
            </div>
            <p className="mb-3 font-mono text-[8px] uppercase tracking-widest text-white/35">RSS/Facebook за 14 діб. Зовнішні геошари увімкнені.</p>
            <div className="space-y-2.5">
              {[
                { id: 'strikes' as const, label: `Удари / BDA (${activityByType.strikes})`, color: 'bg-[#ff3333]', icon: Target },
                { id: 'navy' as const, label: `Морські цілі (${activityByType.navy})`, color: 'bg-[#3399ff]', icon: Anchor },
                { id: 'airbases' as const, label: `Авіабази РФ (${activityByType.airbases})`, color: 'bg-[#ffcc00]', icon: Plane },
                { id: 'logistics' as const, label: `Логістика (${activityByType.logistics})`, color: 'bg-[#00ff66]', icon: Shield },
                { id: 'strategic' as const, label: `Зовнішні геошари (${activityByType.strategic})`, color: 'bg-[#ff7a00]', icon: MapIcon },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => toggleFilter(f.id)}
                  className={`w-full flex items-center justify-between p-2.5 font-mono text-[9px] uppercase tracking-widest transition-all border ${activeFilters.includes(f.id) ? 'border-[#f4f4f4]/30 bg-[#f4f4f4]/10 text-white shadow-[0_0_10px_rgba(255,255,255,0.05)]' : 'border-transparent text-white/35 hover:text-white/60'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-1.5 h-1.5 rounded-full ${activeFilters.includes(f.id) ? f.color : 'bg-zinc-700 opacity-50'}`} />
                    <span className={activeFilters.includes(f.id) ? 'font-bold' : ''}>{f.label}</span>
                  </div>
                  <f.icon className={`w-3.5 h-3.5 transition-opacity ${activeFilters.includes(f.id) ? 'opacity-80' : 'opacity-20'}`} />
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowOnlyExactEvents((value) => !value)}
              className={`mt-4 w-full border px-3 py-2 text-left font-mono text-[9px] uppercase tracking-widest transition-colors ${showOnlyExactEvents ? 'border-green-400/60 bg-green-400/10 text-green-200' : 'border-white/10 text-white/45 hover:text-white/70'}`}
            >
              {showOnlyExactEvents ? 'Показано тільки точні події' : 'Показувати також центр населеного пункту'}
            </button>
          </div>

          <div className="bg-[#111111]/95 backdrop-blur-xl border border-[#f4f4f4]/10 p-5 shadow-2xl">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-3 h-3 text-green-400" />
              <span className="font-mono text-[10px] uppercase tracking-widest text-white/80">Останні геоподії</span>
            </div>
            <div className="space-y-2 text-[9px] font-mono text-[#f4f4f4]/60">
              {filteredEvents.slice(0, 4).map((event) => (
                <div key={event.id} className="border-b border-white/5 pb-1.5">
                  <div className="flex justify-between items-center gap-2">
                    <span className="truncate text-white/85">{event.location}</span>
                    <span className={event.status === 'ПІДТВЕРДЖЕНО' ? 'text-green-400' : event.status === 'ЙМОВІРНО' ? 'text-amber-400' : 'text-sky-400'}>{event.status}</span>
                  </div>
                  <div className="text-[8px] text-white/45">{precisionLabel(event.precision)} · {Math.round(event.confidence * 100)}%</div>
                  <div className="text-[8px] text-white/35 truncate">{event.title}</div>
                </div>
              ))}
              {filteredEvents.length === 0 && sidebarStrategicItems.map((item) => (
                <div key={item.id} className="border-b border-white/5 pb-1.5">
                  <div className="flex justify-between items-center gap-2">
                    <span className="truncate text-white/85">{item.titleUk || item.title}</span>
                    <span className="text-orange-300">{strategicCategoryLabel(item.category)}</span>
                  </div>
                  <div className="text-[8px] text-white/35 truncate">{item.mapTitle || item.sourceName}</div>
                </div>
              ))}
              {filteredEvents.length === 0 && sidebarStrategicItems.length === 0 && (
                <div className="text-white/45 leading-relaxed">Немає подій із достатньо точним геотегом у поточному наборі даних.</div>
              )}
              {sidebarStrategicItems.length > 0 && (
                <div className="pt-1 text-[8px] text-white/30">
                  Оновлено: {strategicUpdatedLabel || 'н/д'}
                </div>
              )}
            </div>
          </div>

          <div className="bg-[#111111]/95 backdrop-blur-xl border border-[#f4f4f4]/10 p-5 shadow-2xl">
            <div className="flex items-center gap-2 mb-3">
              <MapIcon className="w-3 h-3 text-orange-300" />
              <span className="font-mono text-[10px] uppercase tracking-widest text-white/80">Зовнішні геошари</span>
            </div>
            <p className="mb-3 font-mono text-[8px] uppercase tracking-widest text-white/35">
              GOOGLE MY MAPS · {strategicItems.length} ТОЧОК / ЗОН
            </p>
            <div className="space-y-2.5 text-[9px] font-mono text-[#f4f4f4]/65">
              {strategicTopRegions.map(([region, count]) => (
                <div key={region} className="flex items-center justify-between border-b border-white/5 pb-1">
                  <span className="truncate text-white/78">{region}</span>
                  <span className="text-orange-300 font-bold">{count}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {strategicYearBands.map(([year, count]) => (
                <span key={year} className="border border-white/10 px-2 py-1 text-[8px] text-white/60">
                  {year}: {count}
                </span>
              ))}
            </div>
            <p className="mt-3 text-[8px] text-white/32 leading-relaxed">
              Це довідковий шар, не поточні події. Він вимкнений при відкритті карти, щоб не змішувати архівні зони з актуальною стрічкою.
            </p>
          </div>

          <div className="bg-[#111111]/95 backdrop-blur-xl border border-[#f4f4f4]/10 p-5 shadow-2xl">
            <div className="flex items-center gap-2 mb-3">
              <Ruler className="w-3 h-3 text-orange-400" />
              <span className="font-mono text-[10px] uppercase tracking-widest text-white/80">Дистанційна Лінійка</span>
            </div>
            <p className="text-[8px] font-mono text-white/40 leading-relaxed mb-3">Клікніть на мапу, щоб виміряти відстань між об'єктами.</p>
            {distance && (
              <div className="bg-orange-500/10 border border-orange-500/20 p-2 text-orange-500 font-mono text-[10px] text-center font-bold">
                ВІДСТАНЬ: {distance.toFixed(1)} КМ
              </div>
            )}
            <button
              onClick={() => { setMeasurePoints([]); setDistance(null); }}
              className="w-full mt-3 text-[8px] font-mono uppercase text-white/20 hover:text-white/60 transition-colors"
            >
              [ ОЧИСТИТИ_ВИМІРИ ]
            </button>
          </div>
        </div>

        <div className="absolute bottom-6 left-6 z-[400] bg-[#111111]/90 text-[#f4f4f4] p-5 font-mono border border-[#f4f4f4]/10 backdrop-blur-md pointer-events-none shadow-2xl">
          <div className="flex items-center gap-3 mb-4 border-b border-[#f4f4f4]/10 pb-3">
            <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
            <span className="tracking-widest uppercase text-[10px] font-bold opacity-90">КООРДИНАТИ КУРСОРА</span>
          </div>
          <div className="space-y-2.5 text-[10px]">
            <div className="flex justify-between gap-12 border-b border-white/5 pb-1">
              <span className="opacity-30">ШИРОТА</span>
              <span className="font-bold text-white/85 tracking-tighter">{telemetry.lat.toFixed(6)}° N</span>
            </div>
            <div className="flex justify-between gap-12 border-b border-white/5 pb-1">
              <span className="opacity-30">ДОВГОТА</span>
              <span className="font-bold text-white/85 tracking-tighter">{telemetry.lng.toFixed(6)}° E</span>
            </div>
            <div className="flex justify-between gap-12 text-[9px] pt-1">
              <span className="opacity-30 text-blue-400 font-bold">ПОДІЇ</span>
              <span className="text-blue-400/80">{filteredEvents.length} ВИДИМО</span>
            </div>
            <div className="flex justify-between gap-12 text-[9px] pt-1">
              <span className="opacity-30 text-green-300 font-bold">ТОЧНІ</span>
              <span className="text-green-300/90">{exactEventCount} EXACT / {settlementEventCount} SETTLEMENT</span>
            </div>
            <div className="flex justify-between gap-12 text-[9px] pt-1">
              <span className="opacity-30 text-orange-300 font-bold">ШАРИ</span>
              <span className="text-orange-300/90">{filteredStrategicItems.length} / {strategicItems.length}</span>
            </div>
          </div>
        </div>

        {strategicItems.length === 0 && (
          <div className="absolute top-6 right-6 z-[500] bg-red-500/15 border border-red-400/40 text-red-200 px-4 py-3 font-mono text-[10px] uppercase tracking-widest shadow-2xl">
            ГЕОДАНІ НЕ ЗАВАНТАЖЕНІ
          </div>
        )}

        <div className="absolute bottom-6 right-6 z-[400] bg-[#111111]/90 text-[#f4f4f4] p-4 font-mono border border-[#f4f4f4]/10 backdrop-blur-md pointer-events-none shadow-2xl max-w-[220px]">
          <div className="mb-3 border-b border-[#f4f4f4]/10 pb-2">
            <span className="tracking-widest uppercase text-[10px] font-bold opacity-90">ЛЕГЕНДА ШАРІВ</span>
          </div>
          <div className="space-y-2 text-[9px]">
            {[
              ['#7dd3fc', '2022 / рання окупація'],
              ['#facc15', '2024 / зміни фронту'],
              ['#fb923c', '2025 / тиск на напрямках'],
              ['#f43f5e', '2026 / нові зони'],
            ].map(([color, label]) => (
              <div key={label} className="flex items-center gap-2">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-white/65">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <MapContainer
          center={mapCenter}
          zoom={6}
          scrollWheelZoom
          className="w-full h-full z-0 cursor-crosshair"
          zoomControl={false}
        >
          <LayersControl position="bottomright">
            <LayersControl.BaseLayer name="Тактична Темна">
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                attribution="&copy; CARTO"
              />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer checked name="Супутникова мапа">
              <TileLayer
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                attribution="&copy; ESRI"
              />
            </LayersControl.BaseLayer>
            <LayersControl.Overlay checked name={`Контроль території (owlmaps)${territoryStatus === 'loading' ? ' ⟳' : territoryStatus === 'error' ? ' ✕' : ''}`}>
              {territoryGeojson ? (
                <TerritoryLayer geojson={territoryGeojson} />
              ) : (
                <GeoJSON data={{ type: 'FeatureCollection', features: [] } as GeoJsonObject} />
              )}
            </LayersControl.Overlay>
          </LayersControl>

          <MapEvents
            onMouseMove={(lat, lng) => setTelemetry({ lat, lng })}
            onClick={(lat, lng) => handleMapClick(lat, lng)}
          />

          {measurePoints.length === 2 && (
            <Polyline
              positions={measurePoints}
              pathOptions={{ color: '#f97316', weight: 2, dashArray: '10, 10' }}
            >
              <Tooltip permanent direction="center" className="measurement-tooltip">
                <span className="font-mono text-[10px] font-bold text-orange-500">{distance?.toFixed(1)} км</span>
              </Tooltip>
            </Polyline>
          )}

          {measurePoints.map((p, i) => (
            <Circle key={`measure-${i}`} center={p} radius={100} pathOptions={{ color: '#f97316', fillColor: '#f97316', fillOpacity: 0.5 }} />
          ))}

          {filteredEvents.map((event) => (
            <React.Fragment key={event.id}>
              <Circle
                center={event.position}
                radius={4500 + Math.round(event.confidence * 4500)}
                pathOptions={{
                  color: event.type === 'strikes' ? '#ff3333' : event.type === 'navy' ? '#3399ff' : event.type === 'airbases' ? '#ffcc00' : '#00ff66',
                  fillColor: event.type === 'strikes' ? '#ff3333' : event.type === 'navy' ? '#3399ff' : event.type === 'airbases' ? '#ffcc00' : '#00ff66',
                  fillOpacity: 0.06,
                  weight: 0,
                }}
              />
              <Marker position={event.position} icon={icons[event.type]}>
                <Popup className="tactical-popup">
                  <div className="font-mono p-3 bg-[#111111] text-white border border-white/10 min-w-[250px]">
                    <div className="flex justify-between items-start mb-2 border-b border-white/15 pb-2 gap-2">
                      <h5 className="font-bold text-white uppercase text-xs tracking-tight leading-tight">{event.location}</h5>
                      <span className="text-[8px] px-1.5 py-0.5 bg-white/10 text-white/80">{event.status}</span>
                    </div>
                    <div className="space-y-2 text-[9px]">
                      <div className="text-white/90 leading-relaxed">{event.title}</div>
                      {event.excerpt && (
                        <div className="text-white/55 leading-relaxed border-t border-white/5 pt-2">{event.excerpt.slice(0, 170)}{event.excerpt.length > 170 ? '…' : ''}</div>
                      )}
                      <div className="flex justify-between border-t border-white/5 pt-2">
                        <span className="opacity-45 uppercase">Впевненість:</span>
                        <span className="text-green-400 font-bold">{confidenceLabel(event.confidence)} · {Math.round(event.confidence * 100)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="opacity-45 uppercase">Геотег:</span>
                        <span className={event.precision === 'exact' ? 'text-green-300 font-bold' : 'text-amber-300 font-bold'}>{precisionLabel(event.precision)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="opacity-45 uppercase">Джерело:</span>
                        <a href={event.sourceUrl} target="_blank" rel="noreferrer" className="text-blue-300 hover:text-blue-200">{event.sourceName}</a>
                      </div>
                    </div>
                  </div>
                </Popup>
              </Marker>
            </React.Fragment>
          ))}

          {filteredStrategicItems.map((item) => {
            const accent = strategicAccent(item);
            const year = strategicYear(item);
            return (
              <React.Fragment key={item.id}>
                <Circle
                  center={item.position}
                  radius={item.radiusMeters}
                  pathOptions={{
                    color: accent,
                    fillColor: accent,
                    fillOpacity: 0.08,
                    weight: 1,
                    dashArray: '6 6',
                  }}
                />
                <CircleMarker
                  center={item.position}
                  radius={7}
                  pathOptions={{
                    color: '#ffffff',
                    weight: 2,
                    fillColor: accent,
                    fillOpacity: 1,
                  }}
                >
                  <Tooltip direction="top" offset={[0, -4]} opacity={0.95}>
                    <span className="font-mono text-[10px]">
                      {item.titleUk || item.title}
                    </span>
                  </Tooltip>
                  <Popup className="tactical-popup">
                    <div className="font-mono p-3 bg-[#111111] text-white border border-white/10 min-w-[270px]">
                      <div className="flex justify-between items-start mb-2 border-b border-white/15 pb-2 gap-2">
                        <h5 className="font-bold text-white uppercase text-xs tracking-tight leading-tight">{item.titleUk || item.title}</h5>
                        <span className="text-[8px] px-1.5 py-0.5 bg-white/10 text-white/80">{year ? `${strategicCategoryLabel(item.category)} · ${year}` : strategicCategoryLabel(item.category)}</span>
                      </div>
                      <div className="space-y-2 text-[9px]">
                        <div className="text-white/55 leading-relaxed">{item.note || 'Імпортований зовнішній шар для контексту ситуації.'}</div>
                        <div className="flex justify-between border-t border-white/5 pt-2">
                          <span className="opacity-45 uppercase">Джерело:</span>
                          <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="text-blue-300 hover:text-blue-200">
                            {item.sourceName}
                          </a>
                        </div>
                        <div className="flex justify-between">
                          <span className="opacity-45 uppercase">Карта:</span>
                          <span className="text-white/75 text-right">{item.mapTitle}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="opacity-45 uppercase">Радіус:</span>
                          <span className="text-orange-300 font-bold">~ {Math.round(item.radiusMeters / 1000)} км</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="opacity-45 uppercase">Координати:</span>
                          <span className="text-white/75">{item.position[0].toFixed(2)}, {item.position[1].toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="opacity-45 uppercase">Точність:</span>
                          <span className="text-green-300 font-bold">З ДЖЕРЕЛА, БЕЗ ЗСУВУ</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="opacity-45 uppercase">Колір шару:</span>
                          <span className="font-bold" style={{ color: accent }}>{strategicYearLabel(year)}</span>
                        </div>
                      </div>
                    </div>
                  </Popup>
                </CircleMarker>
              </React.Fragment>
            );
          })}
        </MapContainer>

        <div className="absolute inset-0 pointer-events-none z-[450] opacity-[0.03] overflow-hidden bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]"></div>
      </div>

      <style>{`
        .leaflet-container {
          background: #0a0a0a !important;
        }
        .tactical-popup .leaflet-popup-content-wrapper {
          background: transparent !important;
          color: white !important;
          padding: 0 !important;
          border-radius: 0 !important;
          box-shadow: none !important;
        }
        .tactical-popup .leaflet-popup-content {
          margin: 0 !important;
        }
        .tactical-popup .leaflet-popup-tip {
          background: #111 !important;
        }
        .leaflet-control-layers {
          background: #111 !important;
          color: #f4f4f4 !important;
          border: 1px solid rgba(255,255,255,0.1) !important;
          font-family: monospace !important;
          font-size: 8px !important;
          text-transform: uppercase !important;
          border-radius: 0 !important;
        }
        .measurement-tooltip {
          background: #111 !important;
          border: 1px solid #f97316 !important;
          color: #f97316 !important;
          font-family: monospace !important;
          box-shadow: 0 0 10px rgba(249,115,22,0.3) !important;
          border-radius: 0 !important;
        }
      `}</style>
    </div>
  );
}
