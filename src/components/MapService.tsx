import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Circle, CircleMarker, GeoJSON, LayersControl, Polyline, Popup, Tooltip, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import type { PathOptions } from 'leaflet';
import type { Feature, GeoJsonObject } from 'geojson';
import { Anchor, Map as MapIcon, Menu, Plane, RadioTower, X as CloseIcon, Ruler, Activity } from 'lucide-react';

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

type RssItem = {
  id: string;
  title?: string;
  titleUk?: string;
  summary?: string;
  summaryUk?: string;
  publishedAt?: string;
  url?: string;
  author?: string;
};

type InfrastructurePoint = {
  id: string;
  label: string;
  kind: 'aviation' | 'naval';
  position: [number, number];
  note: string;
};

type StrikeRegion = {
  id: string;
  label: string;
  position: [number, number];
  aliases: string[];
};

type RegionalStrike = StrikeRegion & {
  count: number;
  latestTitle: string;
  latestUrl: string;
  latestDate: string;
};

const INFRASTRUCTURE_POINTS: InfrastructurePoint[] = [
  { id: 'air-saratov', label: 'Саратовська область', kind: 'aviation', position: [51.55, 46.05], note: 'Публічно відомий регіон розміщення далекої авіації РФ. Маркер навмисно регіональний.' },
  { id: 'air-ryazan', label: 'Рязанська область', kind: 'aviation', position: [54.62, 39.75], note: 'Регіон авіаційної інфраструктури РФ; без точного позначення обʼєкта.' },
  { id: 'air-pskov', label: 'Псковська область', kind: 'aviation', position: [57.82, 28.35], note: 'Регіон військово-транспортної авіації РФ у відкритих джерелах.' },
  { id: 'air-rostov', label: 'Ростовська область', kind: 'aviation', position: [47.45, 40.1], note: 'Прифронтовий регіон авіаційної інфраструктури РФ.' },
  { id: 'air-krasnodar', label: 'Краснодарський край', kind: 'aviation', position: [45.2, 39.1], note: 'Регіон авіаційної інфраструктури РФ та південного логістичного контуру.' },
  { id: 'air-crimea', label: 'Крим', kind: 'aviation', position: [45.25, 34.25], note: 'Окупований регіон з авіаційною інфраструктурою РФ; маркер узагальнений.' },
  { id: 'air-chelyabinsk', label: 'Челябінська область', kind: 'aviation', position: [55.15, 61.4], note: 'Регіон авіаційної інфраструктури РФ у відкритих джерелах.' },
  { id: 'air-murmansk', label: 'Мурманська область', kind: 'aviation', position: [68.95, 33.1], note: 'Північний регіон авіаційної та морської військової інфраструктури РФ.' },
  { id: 'naval-black-sea', label: 'Чорноморський контур', kind: 'naval', position: [44.95, 36.2], note: 'Узагальнений маркер районів базування ЧФ РФ без деталізації причалів.' },
  { id: 'naval-baltic-kaliningrad', label: 'Калінінградський контур', kind: 'naval', position: [54.75, 20.45], note: 'Узагальнений регіон Балтійського флоту РФ.' },
  { id: 'naval-baltic-leningrad', label: 'Ленінградський контур', kind: 'naval', position: [59.9, 29.75], note: 'Узагальнений регіон морської інфраструктури РФ у Фінській затоці.' },
  { id: 'naval-northern', label: 'Північний флот', kind: 'naval', position: [69.05, 33.2], note: 'Узагальнений регіон базування Північного флоту РФ.' },
  { id: 'naval-caspian', label: 'Каспійський контур', kind: 'naval', position: [46.35, 48.05], note: 'Узагальнений регіон Каспійської флотилії РФ.' },
  { id: 'naval-pacific', label: 'Тихоокеанський контур', kind: 'naval', position: [43.12, 132.0], note: 'Узагальнений регіон Тихоокеанського флоту РФ.' },
];

const STRIKE_REGIONS: StrikeRegion[] = [
  { id: 'ru-belgorod', label: 'Бєлгородська область', position: [50.7, 37.1], aliases: ['бєлгород', 'белгород', 'belgorod'] },
  { id: 'ru-kursk', label: 'Курська область', position: [51.7, 36.2], aliases: ['курськ', 'kursk'] },
  { id: 'ru-bryansk', label: 'Брянська область', position: [53.2, 34.4], aliases: ['брянськ', 'bryansk'] },
  { id: 'ru-rostov', label: 'Ростовська область', position: [47.45, 40.1], aliases: ['ростов', 'rostov', 'таганрог', 'taganrog'] },
  { id: 'ru-krasnodar', label: 'Краснодарський край', position: [45.2, 39.1], aliases: ['краснодар', 'krasnodar', 'туапсе', 'tuapse', 'новоросійськ', 'новороссийск', 'novorossiysk', 'приморсько-ахтарськ', 'приморско-ахтарск'] },
  { id: 'ru-volgograd', label: 'Волгоградська область', position: [48.7, 44.5], aliases: ['волгоград', 'volgograd'] },
  { id: 'ru-saratov', label: 'Саратовська область', position: [51.55, 46.05], aliases: ['саратов', 'saratov', 'енгельс', 'engels'] },
  { id: 'ru-ryazan', label: 'Рязанська область', position: [54.62, 39.75], aliases: ['рязань', 'ryazan', 'дягілево', 'дягилево', 'dyagilevo'] },
  { id: 'ru-samara', label: 'Самарська область', position: [53.2, 50.15], aliases: ['самар', 'samara', 'куйбишев', 'куйбышев', 'novokuibyshevsk', 'новокуйбишев'] },
  { id: 'ru-tatarstan', label: 'Татарстан', position: [55.7, 51.0], aliases: ['татарстан', 'tatarstan', 'нижньокамськ', 'нижнекамск', 'nizhnekamsk', 'танеко', 'taneco', 'елабуга', 'yelabuga'] },
  { id: 'ru-bashkortostan', label: 'Башкортостан', position: [54.7, 56.0], aliases: ['башкортостан', 'bashkortostan', 'уфа', 'ufa', 'салават', 'salavat'] },
  { id: 'ru-nizhny', label: 'Нижегородська область', position: [56.25, 44.0], aliases: ['нижегород', 'nizhny', 'кстово', 'kstovo', 'норси', 'norsi'] },
  { id: 'ru-leningrad', label: 'Ленінградська область', position: [59.75, 30.2], aliases: ['ленінград', 'ленинград', 'санкт-петербург', 'st petersburg', 'петербург', 'усть-луга', 'ust-luga', 'приморськ', 'приморск', 'primorsk'] },
  { id: 'ru-moscow', label: 'Москва / Московська область', position: [55.75, 37.6], aliases: ['москва', 'moscow', 'московськ', 'московск'] },
  { id: 'ru-orel', label: 'Орловська область', position: [52.95, 36.05], aliases: ['орел', 'орёл', 'oryol', 'orel'] },
  { id: 'ru-tula', label: 'Тульська область', position: [54.2, 37.6], aliases: ['тула', 'tula'] },
  { id: 'ru-voronezh', label: 'Воронезька область', position: [51.65, 39.2], aliases: ['воронеж', 'voronezh'] },
  { id: 'ru-astrakhan', label: 'Астраханська область', position: [46.35, 48.05], aliases: ['астрахан', 'astrakhan'] },
  { id: 'ru-perm', label: 'Пермський край', position: [58.0, 56.25], aliases: ['перм', 'perm'] },
  { id: 'ru-chuvashia', label: 'Чувашія', position: [56.15, 47.25], aliases: ['чуваш', 'cheboksary', 'чебоксар'] },
  { id: 'ru-crimea', label: 'Крим', position: [45.25, 34.25], aliases: ['крим', 'crimea', 'севастопол', 'sevastopol', 'саки', 'saky', 'бельбек', 'belbek'] },
];

const STRIKE_RE = /(удар|влуч|уражен|знищен|атака|атакован|пожеж|вибух|дрон|бпла|strike|struck|hit|attack|explosion|blast|fire|drone|uav)/i;
const RUSSIA_CONTEXT_RE = /(росі|росс|russia|russian|рф|окупован|crimea|крим|севастопол)/i;

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

function MapEvents({
  onMouseMove,
  onClick,
}: {
  onMouseMove: (lat: number, lng: number) => void;
  onClick: (lat: number, lng: number) => void;
}) {
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

function territoryStatusLabel(status: 'loading' | 'ready' | 'error') {
  if (status === 'ready') return 'ГОТОВО';
  if (status === 'error') return 'ПОМИЛКА';
  return 'ЗАВАНТАЖЕННЯ';
}

function cleanText(value = '') {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' });
  } catch {
    return value.slice(0, 10);
  }
}

function buildRegionalStrikes(items: RssItem[]) {
  const now = Date.now();
  const windowMs = 7 * 24 * 60 * 60 * 1000;
  const byRegion = new Map<string, RegionalStrike>();
  const seen = new Set<string>();

  for (const item of items) {
    const ts = new Date(item.publishedAt || '').getTime();
    if (Number.isNaN(ts) || now - ts > windowMs) continue;

    const title = cleanText(item.titleUk || item.title || '');
    const text = `${title} ${cleanText(item.summaryUk || item.summary || '')}`;
    if (!STRIKE_RE.test(text) || !RUSSIA_CONTEXT_RE.test(text)) continue;

    const low = text.toLowerCase();
    const matchedRegions = STRIKE_REGIONS.filter((region) =>
      region.aliases.some((alias) => low.includes(alias.toLowerCase())),
    );

    for (const region of matchedRegions) {
      const key = `${region.id}:${title.toLowerCase().slice(0, 120)}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const current = byRegion.get(region.id);
      if (!current) {
        byRegion.set(region.id, {
          ...region,
          count: 1,
          latestTitle: title || 'Повідомлення без заголовка',
          latestUrl: item.url || '',
          latestDate: item.publishedAt || '',
        });
        continue;
      }

      current.count += 1;
      if (ts > new Date(current.latestDate || '').getTime()) {
        current.latestTitle = title || current.latestTitle;
        current.latestUrl = item.url || current.latestUrl;
        current.latestDate = item.publishedAt || current.latestDate;
      }
    }
  }

  return Array.from(byRegion.values()).sort((a, b) => b.count - a.count);
}

export default function MapService() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [telemetry, setTelemetry] = useState({ lat: 45.0, lng: 35.0 });
  const [measurePoints, setMeasurePoints] = useState<[number, number][]>([]);
  const [distance, setDistance] = useState<number | null>(null);
  const [regionalStrikes, setRegionalStrikes] = useState<RegionalStrike[]>([]);
  const [strikeUpdatedAt, setStrikeUpdatedAt] = useState('');
  const [territoryGeojson, setTerritoryGeojson] = useState<GeoJsonObject | null>(null);
  const [territoryStatus, setTerritoryStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    fetch(`/data/territory_geojson.json?_t=${Math.floor(Date.now() / (6 * 60 * 60 * 1000))}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<GeoJsonObject>;
      })
      .then((data) => {
        if (!cancelled) {
          setTerritoryGeojson(data);
          setTerritoryStatus('ready');
        }
      })
      .catch(() => {
        if (!cancelled) setTerritoryStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    function loadRegionalStrikes() {
      const t = Date.now();
      Promise.all([
        fetch(`/data/rss_twitter.json?_t=${t}`).then((r) => (r.ok ? r.json() : { items: [] })),
        fetch(`/data/rss_facebook.json?_t=${t}`).then((r) => (r.ok ? r.json() : { items: [] })),
      ])
        .then(([xData, fbData]) => {
          if (cancelled) return;
          const items = [
            ...(Array.isArray(xData?.items) ? xData.items : []),
            ...(Array.isArray(fbData?.items) ? fbData.items : []),
          ] as RssItem[];
          setRegionalStrikes(buildRegionalStrikes(items));
          setStrikeUpdatedAt(new Date().toISOString());
        })
        .catch(() => {
          if (!cancelled) setRegionalStrikes([]);
        });
    }

    loadRegionalStrikes();
    const interval = setInterval(loadRegionalStrikes, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const calculateDistance = (p1: [number, number], p2: [number, number]) => {
    const lat1 = p1[0];
    const lon1 = p1[1];
    const lat2 = p2[0];
    const lon2 = p2[1];
    const earthRadiusKm = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return earthRadiusKm * c;
  };

  const handleMapClick = (lat: number, lng: number) => {
    if (measurePoints.length === 2) {
      setMeasurePoints([[lat, lng]]);
      setDistance(null);
      return;
    }

    if (measurePoints.length === 1) {
      const nextPoints: [number, number][] = [...measurePoints, [lat, lng]];
      setMeasurePoints(nextPoints);
      setDistance(calculateDistance(nextPoints[0], nextPoints[1]));
      return;
    }

    setMeasurePoints([[lat, lng]]);
  };

  return (
    <div className="w-full flex flex-col font-sans">
      <div className="flex justify-between items-center mb-4 md:mb-6 font-mono text-[10px] md:text-xs uppercase tracking-[0.2em] border-b border-[#111111] pb-3">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-ping" />
          <MapIcon className="w-4 h-4" />
          <span className="font-bold">КАРТА // РЕГІОНАЛЬНИЙ OSINT-МОНІТОР</span>
        </div>
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="flex items-center gap-2 bg-[#111111] text-white px-3 py-1 text-[9px] hover:bg-zinc-800 transition-colors font-semibold"
        >
          {isSidebarOpen ? <CloseIcon className="w-3 h-3" /> : <Menu className="w-3 h-3" />}
          {isSidebarOpen ? 'ПРИХОВАТИ ПАНЕЛЬ' : 'ПОКАЗАТИ ПАНЕЛЬ'}
        </button>
      </div>

      <div className="relative w-full h-[520px] md:h-[800px] bg-[#0a0a0a] border border-[#111111]/20 overflow-hidden group shadow-2xl">
        <div className={`absolute top-4 md:top-6 left-4 md:left-6 z-[400] w-64 md:w-72 space-y-4 transition-all duration-700 ease-in-out ${isSidebarOpen ? 'translate-x-0 opacity-100' : '-translate-x-[120%] opacity-0 pointer-events-none'}`}>
          <div className="bg-[#111111]/95 backdrop-blur-xl border border-[#f4f4f4]/10 p-5 shadow-2xl">
            <div className="flex items-center gap-2 mb-3 border-b border-[#f4f4f4]/10 pb-3">
              <Activity className="w-3 h-3 text-red-400" />
              <span className="font-mono text-[10px] uppercase tracking-widest text-white/80">Статус карти</span>
            </div>
            <p className="font-mono text-[8px] uppercase tracking-widest text-white/35 leading-relaxed">
              ТОЧНІ ВІЙСЬКОВІ КООРДИНАТИ НЕ ВІДОБРАЖАЮТЬСЯ. ПОКАЗАНІ РЕГІОНАЛЬНІ OSINT-ІНДИКАТОРИ ТА ЗГАДКИ ЗА 7 ДНІВ.
            </p>
            <div className="mt-4 border border-white/10 bg-white/[0.03] p-3 font-mono text-[9px] text-white/65 leading-relaxed">
              Автооновлення: кожні 5 хвилин із RSS/X та Facebook-стрічок. Останнє оновлення: {strikeUpdatedAt ? formatDate(strikeUpdatedAt) : 'н/д'}.
            </div>
          </div>

          <div className="bg-[#111111]/95 backdrop-blur-xl border border-[#f4f4f4]/10 p-5 shadow-2xl">
            <div className="flex items-center gap-2 mb-3">
              <RadioTower className="w-3 h-3 text-red-300" />
              <span className="font-mono text-[10px] uppercase tracking-widest text-white/80">Удари по РФ · 7 днів</span>
            </div>
            <div className="space-y-2 font-mono text-[9px] text-white/60">
              {regionalStrikes.slice(0, 5).map((region) => (
                <div key={region.id} className="flex items-center justify-between gap-3 border-b border-white/5 pb-1">
                  <span className="truncate text-white/75">{region.label}</span>
                  <span className="text-red-300 font-bold">{region.count}</span>
                </div>
              ))}
              {regionalStrikes.length === 0 && (
                <div className="text-white/40 leading-relaxed">За останні 7 днів немає регіональних згадок, що пройшли фільтр.</div>
              )}
            </div>
          </div>

          <div className="bg-[#111111]/95 backdrop-blur-xl border border-[#f4f4f4]/10 p-5 shadow-2xl">
            <div className="flex items-center gap-2 mb-3">
              <Plane className="w-3 h-3 text-[#facc15]" />
              <Anchor className="w-3 h-3 text-sky-300" />
              <span className="font-mono text-[10px] uppercase tracking-widest text-white/80">Військова інфраструктура</span>
            </div>
            <div className="space-y-2 font-mono text-[9px] text-white/60">
              <div className="flex items-center justify-between border-b border-white/5 pb-1">
                <span>Авіаційні регіони</span>
                <span className="text-[#facc15] font-bold">{INFRASTRUCTURE_POINTS.filter((p) => p.kind === 'aviation').length}</span>
              </div>
              <div className="flex items-center justify-between border-b border-white/5 pb-1">
                <span>Морські контури</span>
                <span className="text-sky-300 font-bold">{INFRASTRUCTURE_POINTS.filter((p) => p.kind === 'naval').length}</span>
              </div>
              <p className="text-[8px] text-white/35 leading-relaxed">
                Маркери поставлені на рівні регіону/контуру і не є координатами конкретних військових обʼєктів.
              </p>
            </div>
          </div>

          <div className="bg-[#111111]/95 backdrop-blur-xl border border-[#f4f4f4]/10 p-5 shadow-2xl">
            <div className="flex items-center gap-2 mb-3">
              <MapIcon className="w-3 h-3 text-[#c9a227]" />
              <span className="font-mono text-[10px] uppercase tracking-widest text-white/80">Шар території</span>
            </div>
            <div className="space-y-2 font-mono text-[9px] text-white/60">
              <div className="flex items-center justify-between border-b border-white/5 pb-1">
                <span>OWL MAPS</span>
                <span className={territoryStatus === 'ready' ? 'text-green-300' : territoryStatus === 'error' ? 'text-red-300' : 'text-amber-300'}>
                  {territoryStatusLabel(territoryStatus)}
                </span>
              </div>
              <div className="text-[8px] text-white/35 leading-relaxed">
                Шар лишився як загальний контекст лінії контролю без додаткових зовнішніх точкових накладок.
              </div>
            </div>
          </div>

          <div className="bg-[#111111]/95 backdrop-blur-xl border border-[#f4f4f4]/10 p-5 shadow-2xl">
            <div className="flex items-center gap-2 mb-3">
              <Ruler className="w-3 h-3 text-orange-400" />
              <span className="font-mono text-[10px] uppercase tracking-widest text-white/80">Дистанційна лінійка</span>
            </div>
            <p className="text-[8px] font-mono text-white/40 leading-relaxed mb-3">
              Клікніть на мапу двічі, щоб виміряти відстань між двома точками.
            </p>
            {distance && (
              <div className="bg-orange-500/10 border border-orange-500/20 p-2 text-orange-500 font-mono text-[10px] text-center font-bold">
                ВІДСТАНЬ: {distance.toFixed(1)} КМ
              </div>
            )}
            <button
              onClick={() => {
                setMeasurePoints([]);
                setDistance(null);
              }}
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
              <span className="opacity-30 text-[#c9a227] font-bold">ТЕРИТОРІЯ</span>
              <span className="text-[#c9a227]/90">{territoryStatusLabel(territoryStatus)}</span>
            </div>
            <div className="flex justify-between gap-12 text-[9px] pt-1">
              <span className="opacity-30 text-red-300 font-bold">УДАРИ РФ</span>
              <span className="text-red-300/90">{regionalStrikes.length} РЕГІОНІВ</span>
            </div>
            <div className="flex justify-between gap-12 text-[9px] pt-1">
              <span className="opacity-30 text-sky-300 font-bold">ІНФРА</span>
              <span className="text-sky-300/90">{INFRASTRUCTURE_POINTS.length} МАРКЕРІВ</span>
            </div>
            <div className="flex justify-between gap-12 text-[9px] pt-1">
              <span className="opacity-30 text-orange-300 font-bold">ВИМІР</span>
              <span className="text-orange-300/90">{measurePoints.length}/2 ТОЧКИ</span>
            </div>
          </div>
        </div>

        <MapContainer
          center={[53.4, 43.2]}
          zoom={4}
          scrollWheelZoom
          className="w-full h-full z-0 cursor-crosshair"
          zoomControl={false}
        >
          <LayersControl position="bottomright">
            <LayersControl.BaseLayer name="Тактична темна">
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

          {INFRASTRUCTURE_POINTS.map((point) => {
            const isAviation = point.kind === 'aviation';
            const color = isAviation ? '#facc15' : '#38bdf8';
            return (
              <CircleMarker
                key={point.id}
                center={point.position}
                radius={7}
                pathOptions={{
                  color: '#ffffff',
                  weight: 1.5,
                  fillColor: color,
                  fillOpacity: 0.88,
                }}
              >
                <Tooltip direction="top" offset={[0, -6]} opacity={0.95}>
                  <span className="font-mono text-[10px]">
                    {isAviation ? 'Авіаційний регіон' : 'Морський контур'} · {point.label}
                  </span>
                </Tooltip>
                <Popup className="tactical-popup">
                  <div className="font-mono p-3 bg-[#111111] text-white border border-white/10 min-w-[250px]">
                    <div className="flex justify-between items-start mb-2 border-b border-white/15 pb-2 gap-2">
                      <h5 className="font-bold text-white uppercase text-xs tracking-tight leading-tight">{point.label}</h5>
                      <span className="text-[8px] px-1.5 py-0.5 bg-white/10" style={{ color }}>
                        {isAviation ? 'АВІА' : 'ФЛОТ'}
                      </span>
                    </div>
                    <p className="text-[9px] text-white/60 leading-relaxed">{point.note}</p>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}

          {regionalStrikes.map((region) => {
            const radius = Math.min(16, 7 + region.count * 2);
            return (
              <CircleMarker
                key={`strike-${region.id}`}
                center={region.position}
                radius={radius}
                pathOptions={{
                  color: '#ffffff',
                  weight: 2,
                  fillColor: '#ef4444',
                  fillOpacity: 0.72,
                }}
              >
                <Tooltip direction="top" offset={[0, -radius]} opacity={0.95}>
                  <span className="font-mono text-[10px]">
                    {region.label}: {region.count} згад.
                  </span>
                </Tooltip>
                <Popup className="tactical-popup">
                  <div className="font-mono p-3 bg-[#111111] text-white border border-white/10 min-w-[270px]">
                    <div className="flex justify-between items-start mb-2 border-b border-white/15 pb-2 gap-2">
                      <h5 className="font-bold text-white uppercase text-xs tracking-tight leading-tight">{region.label}</h5>
                      <span className="text-[8px] px-1.5 py-0.5 bg-red-500/15 text-red-200">{region.count} / 7 ДНІВ</span>
                    </div>
                    <div className="space-y-2 text-[9px]">
                      <p className="text-white/60 leading-relaxed">Регіональна OSINT-агрегація повідомлень про удари по території РФ. Маркер не є точною геолокацією події.</p>
                      {region.latestTitle && (
                        <p className="text-white/85 leading-relaxed border-t border-white/5 pt-2">{region.latestTitle}</p>
                      )}
                      <div className="flex justify-between border-t border-white/5 pt-2">
                        <span className="opacity-45 uppercase">Останнє:</span>
                        <span className="text-white/75">{region.latestDate ? formatDate(region.latestDate) : 'н/д'}</span>
                      </div>
                      {region.latestUrl && (
                        <div className="flex justify-between">
                          <span className="opacity-45 uppercase">Джерело:</span>
                          <a href={region.latestUrl} target="_blank" rel="noreferrer" className="text-blue-300 hover:text-blue-200">відкрити</a>
                        </div>
                      )}
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}

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

          {measurePoints.map((point, index) => (
            <Circle
              key={`measure-${index}`}
              center={point}
              radius={100}
              pathOptions={{ color: '#f97316', fillColor: '#f97316', fillOpacity: 0.5 }}
            />
          ))}
        </MapContainer>

        <div className="absolute inset-0 pointer-events-none z-[450] opacity-[0.03] overflow-hidden bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]" />
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
        .measurement-tooltip {
          background: rgba(17, 17, 17, 0.92) !important;
          border: 1px solid rgba(249, 115, 22, 0.35) !important;
          box-shadow: none !important;
        }
        .measurement-tooltip .leaflet-tooltip-content {
          margin: 4px 8px !important;
        }
        .leaflet-control-layers {
          background: rgba(17, 17, 17, 0.92) !important;
          color: #f4f4f4 !important;
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
          border-radius: 0 !important;
          box-shadow: 0 18px 45px rgba(0, 0, 0, 0.28) !important;
        }
      `}</style>
    </div>
  );
}
