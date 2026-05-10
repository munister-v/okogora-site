import { motion } from 'motion/react';
import { useState, useEffect, lazy, Suspense, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowUpRight, Activity, Database, Shield, Terminal, Rss, Target, Lock, BarChart3, MapPinned, Table2, RadioTower } from 'lucide-react';
import { Post, InvestigationArticle } from './types';
import { formatPreview, normalizePosts, postTelegramUrl, resolveImageUrl } from './lib/posts';
import { setSeo } from './lib/seo';

const MapService = lazy(() => import('./components/MapService'));

// ── Color tokens ──────────────────────────────────────────────────────────────
// bg:    #252519  (dark military olive)
// card:  #2e2d1e
// dark:  #1c1c12
// gold:  #c9a227
// text:  #ffffff

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] }
};

const staggerContainer = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { staggerChildren: 0.15 }
  }
};

type RssItem = {
  id: string;
  title: string;
  titleUk?: string;
  url: string;
  summary: string;
  summaryUk?: string;
  publishedAt: string;
  author: string;
  handle: string;
  tags?: string[];
};

type PechalStats = {
  generatedAt: string;
  sourceUrl: string;
  counters: {
    today: number;
    last7Days: number;
    last30Days: number;
    totalBySerial?: number;
    totalApproxByMaxPostId: number;
  };
  latestProofs?: Array<{
    id: number;
    datetime: string;
    url: string;
    dayKyiv: string;
    serial?: number | null;
  }>;
};

type SbsStatsPayload = {
  generatedAt: string;
  sourceUrl: string;
  latestDate: string;
  latestHour: number;
  collectedAt?: string;
  summary: {
    personnelKilled: number;
    personnelWounded: number;
    personnelCasualties: number;
    targetsHit: number;
    targetsDestroyed: number;
  };
  categories: Array<{
    id: number;
    label: string;
    hit: number;
    destroyed: number;
  }>;
  daily: Array<{
    date: string;
    hour: number;
    targetsHit: number;
    targetsDestroyed: number;
    personnelCasualties: number;
  }>;
  monthly: Array<{
    date: string;
    targetsHit: number;
    targetsDestroyed: number;
    personnelCasualties: number;
  }>;
  methodology?: string[];
};

type DeepstateTablePayload = {
  generatedAt: string;
  sourceUrl: string;
  latest: {
    day: string;
    occupiedKm2: number;
    occupiedPercent: number;
    diffKm2: number;
    text: string;
  } | null;
  rows: Array<{
    day: string;
    occupiedKm2: number;
    occupiedPercent: number;
    diffKm2: number;
    text: string;
  }>;
  areas: Array<{
    name: string;
    occupiedKm2: number;
    occupiedPercent: number;
    dailyAverageKm2: number;
  }>;
  recentWindowDays: number;
  netChangeKm2: number;
  maxAbsDiffKm2: number;
  methodology?: string[];
};

const SECTION_IDS = ['map', 'brigades', 'analytics', 'sbs', 'deepstate', 'investigations', 'rss', 'feed', 'contacts'] as const;
type SectionId = typeof SECTION_IDS[number];

type BrigadeDashboardItem = {
  id: string;
  title: string;
  titleUk?: string;
  summary?: string;
  summaryUk?: string;
  url: string;
  publishedAt: string;
  source: 'x' | 'facebook' | string;
  sourceLabel: string;
  origin: 'official' | 'mention';
  score?: number;
  strikeScore?: number;
  reorgScore?: number;
  isStrike?: boolean;
  isReorg?: boolean;
};

type BrigadeDashboardRow = {
  id: string;
  name: string;
  autoDiscovered?: boolean;
  officialItems: number;
  mentionItems: number;
  significantItems: number;
  strikeItems: number;
  reorgItems: number;
  hasOfficialFeed: boolean;
  items: BrigadeDashboardItem[];
};

type BrigadeDashboardPayload = {
  generatedAt: string;
  windowDays: number;
  totals: {
    units?: number;
    unitsWithOfficialFeeds?: number;
    autoDiscoveredUnits?: number;
    brigades: number;
    brigadesWithOfficialFeeds: number;
    officialItems: number;
    mentionItems: number;
    significantItems: number;
    strikeItems: number;
    reorgItems: number;
  };
  brigades: BrigadeDashboardRow[];
};

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<Post[]>([]);
  const [rssItems, setRssItems] = useState<RssItem[]>([]);
  const [fbItems, setFbItems] = useState<RssItem[]>([]);
  const [brigadeDashboard, setBrigadeDashboard] = useState<BrigadeDashboardPayload | null>(null);
  const [pechalStats, setPechalStats] = useState<PechalStats | null>(null);
  const [sbsStats, setSbsStats] = useState<SbsStatsPayload | null>(null);
  const [deepstateTable, setDeepstateTable] = useState<DeepstateTablePayload | null>(null);
  const [investigations, setInvestigations] = useState<InvestigationArticle[]>([]);
  const [sharedItemId, setSharedItemId] = useState<string>('');
  const [rssSourceFilter, setRssSourceFilter] = useState<'all' | 'x' | 'facebook'>('all');
  const [rssTopicFilter, setRssTopicFilter] = useState('all');
  const [rssSearch, setRssSearch] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  function scrollToSection(id: SectionId, smooth = true) {
    const node = document.getElementById(id);
    if (!node) return;
    node.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
  }

  function openSection(id: SectionId) {
    setMobileMenuOpen(false);
    if (location.pathname !== '/') {
      navigate('/', { replace: false });
      window.setTimeout(() => scrollToSection(id), 120);
      return;
    }
    scrollToSection(id);
  }

  useEffect(() => {
    setSeo({
      title: 'Стратегічний OSINT Монітор',
      description: 'Око Гора: OSINT-аналітика, аеророзвідка, інтерактивна мапа та розслідування відкритих джерел.',
      path: '/',
      type: 'website',
    });
  }, []);

  useEffect(() => {
    function loadData() {
      const t = Date.now();
      fetch(`/data/posts.json?_t=${t}`)
        .then(r => r.json())
        .then((data: Post[]) => setPosts(normalizePosts(data)))
        .catch(() => {});

      fetch(`/data/rss_twitter.json?_t=${t}`)
        .then(r => r.json())
        .then(data => setRssItems(Array.isArray(data?.items) ? data.items : []))
        .catch(() => {});

      fetch(`/data/rss_facebook.json?_t=${t}`)
        .then(r => r.json())
        .then(data => setFbItems(Array.isArray(data?.items) ? data.items : []))
        .catch(() => {});

      fetch(`/data/investigations.json?_t=${t}`)
        .then(r => r.json())
        .then((data: InvestigationArticle[]) => setInvestigations(Array.isArray(data) ? data : []))
        .catch(() => {});

      fetch(`/data/brigades_dashboard.json?_t=${t}`)
        .then(r => r.json())
        .then((data: BrigadeDashboardPayload) => setBrigadeDashboard(data && Array.isArray(data.brigades) ? data : null))
        .catch(() => {});

      fetch(`/data/pechalbeda_stats.json?_t=${t}`)
        .then(r => r.json())
        .then((data: PechalStats) => setPechalStats(data && data.counters ? data : null))
        .catch(() => {});

      fetch(`/data/sbs_stats_snapshot.json?_t=${t}`)
        .then(r => r.json())
        .then((data: SbsStatsPayload) => setSbsStats(data && data.summary ? data : null))
        .catch(() => {});

      fetch(`/data/deepstate_table.json?_t=${t}`)
        .then(r => r.json())
        .then((data: DeepstateTablePayload) => setDeepstateTable(data && Array.isArray(data.rows) ? data : null))
        .catch(() => {});
    }

    loadData();
    const interval = setInterval(loadData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const rawPath = (location.pathname || '').replace(/^\/+/, '').toLowerCase();
    if (!rawPath) return;
    if (!SECTION_IDS.includes(rawPath as SectionId)) return;
    navigate('/', { replace: true });
    window.setTimeout(() => scrollToSection(rawPath as SectionId, false), 80);
  }, [location.pathname, navigate]);

  function formatRssDate(iso: string) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('uk-UA', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  function formatNumber(value: number | undefined | null) {
    return Number(value || 0).toLocaleString('uk-UA');
  }

  function formatKm2(value: number | undefined | null) {
    return `${Number(value || 0).toLocaleString('uk-UA', { maximumFractionDigits: 1 })} км²`;
  }

  function formatSignedKm2(value: number | undefined | null) {
    const n = Number(value || 0);
    const sign = n > 0 ? '+' : '';
    return `${sign}${n.toLocaleString('uk-UA', { maximumFractionDigits: 2 })} км²`;
  }

  function formatSnapshotDate(iso: string | undefined) {
    if (!iso) return 'очікується';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString('uk-UA', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  function cleanRssText(text: string) {
    return (text || '')
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\bhttps?:\/\/(?:pbs\.twimg\.com|pic\.twitter\.com)\S+/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  async function shareLink(id: string, title: string, url: string) {
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
      setSharedItemId(id);
      setTimeout(() => setSharedItemId(''), 1800);
    } catch {
      // ignore user-cancelled share
    }
  }

  const dashboard = useMemo(() => {
    const now = Date.now();
    const days: string[] = [];
    const daySet = new Set<string>();
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date(now - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      days.push(key);
      daySet.add(key);
    }

    const UKR_MONTHS: Record<string, number> = {
      січ: 0, лют: 1, бер: 2, кві: 3, тра: 4, чер: 5, лип: 6, сер: 7, вер: 8, жов: 9, лис: 10, гру: 11,
    };

    const parseLoosePostDate = (value: string): number => {
      const raw = (value || '').toLowerCase().replace(/\./g, ' ').replace(/\s+/g, ' ').trim();
      const m = raw.match(/(\d{1,2})\s+([а-яіїєґ]{3,})\s+(\d{4})(?:\s*\/\s*(\d{1,2}):(\d{2}))?/u);
      if (!m) return Number.NaN;
      const day = Number(m[1]);
      const month = UKR_MONTHS[m[2].slice(0, 3)] ?? new Date().getMonth();
      const year = Number(m[3]);
      const hour = Number(m[4] || 0);
      const min = Number(m[5] || 0);
      return Date.UTC(year, month, day, hour, min);
    };

    type StrikeEvent = {
      day: string;
      source: 'X' | 'Facebook' | 'Telegram';
      oblast: string;
      headline: string;
      ts: number;
      url: string;
      sourceLabel: string;
    };

    const oblastAliases: Array<{ oblast: string; aliases: string[] }> = [
      { oblast: 'Харківська', aliases: ['харків', 'kharkiv'] },
      { oblast: 'Донецька', aliases: ['донецьк', 'donetsk'] },
      { oblast: 'Луганська', aliases: ['луган', 'luhansk', 'lugansk'] },
      { oblast: 'Сумська', aliases: ['суми', 'sumy'] },
      { oblast: 'Запорізька', aliases: ['запоріж', 'zaporizh'] },
      { oblast: 'Херсонська', aliases: ['херсон', 'kherson'] },
      { oblast: 'Дніпропетровська', aliases: ['дніпро', 'dnipro', 'дніпропетров', 'dnipropetrov'] },
      { oblast: 'Миколаївська', aliases: ['миколаїв', 'mykolaiv', 'nikolaev'] },
      { oblast: 'Одеська', aliases: ['одеса', 'odesa', 'odessa'] },
      { oblast: 'Київська', aliases: ['київ', 'kyiv'] },
      { oblast: 'Полтавська', aliases: ['полтав', 'poltava'] },
      { oblast: 'Чернігівська', aliases: ['черніг', 'chernihiv'] },
      { oblast: 'Крим', aliases: ['крим', 'crimea', 'севастопол', 'sevastopol'] },
      { oblast: 'РФ: Бєлгород', aliases: ['бєлгород', 'белгород', 'belgorod'] },
      { oblast: 'РФ: Курськ', aliases: ['курськ', 'kursk'] },
      { oblast: 'РФ: Брянськ', aliases: ['брянськ', 'bryansk'] },
      { oblast: 'РФ: Ростов', aliases: ['ростов', 'rostov'] },
      { oblast: 'РФ: Краснодар', aliases: ['краснодар', 'krasnodar', 'туапсе', 'tuapse'] },
    ];

    const STRIKE_RE = /(удар|влуч|уражен|знищен|strike|struck|hit|explosion|blast|attack|drone|missile|бпла)/i;

    const extractOblasts = (text: string): string[] => {
      const low = text.toLowerCase();
      const hit = oblastAliases
        .filter((x) => x.aliases.some((a) => low.includes(a)))
        .map((x) => x.oblast);
      return Array.from(new Set(hit));
    };

    const events: StrikeEvent[] = [];
    for (const item of rssItems) {
      const ts = new Date(item.publishedAt).getTime();
      if (Number.isNaN(ts) || now - ts > 7 * 24 * 60 * 60 * 1000) continue;
      const day = new Date(ts).toISOString().slice(0, 10);
      if (!daySet.has(day)) continue;
      const headline = cleanRssText(item.titleUk || item.title || '');
      const text = `${headline} ${cleanRssText(item.summaryUk || item.summary || '')}`;
      if (!STRIKE_RE.test(text)) continue;
      const hitOblasts = extractOblasts(text);
      for (const oblast of hitOblasts) {
        events.push({ day, source: 'X', oblast, headline, ts, url: item.url, sourceLabel: `@${item.handle || item.author || 'x-source'}` });
      }
    }
    for (const item of fbItems) {
      const ts = new Date(item.publishedAt).getTime();
      if (Number.isNaN(ts) || now - ts > 7 * 24 * 60 * 60 * 1000) continue;
      const day = new Date(ts).toISOString().slice(0, 10);
      if (!daySet.has(day)) continue;
      const headline = cleanRssText(item.titleUk || item.title || '');
      const text = `${headline} ${cleanRssText(item.summaryUk || item.summary || '')}`;
      if (!STRIKE_RE.test(text)) continue;
      const hitOblasts = extractOblasts(text);
      for (const oblast of hitOblasts) {
        events.push({ day, source: 'Facebook', oblast, headline, ts, url: item.url, sourceLabel: item.author || 'Facebook source' });
      }
    }
    for (const post of posts) {
      const ts = parseLoosePostDate(post.date);
      if (Number.isNaN(ts) || now - ts > 7 * 24 * 60 * 60 * 1000) continue;
      const day = new Date(ts).toISOString().slice(0, 10);
      if (!daySet.has(day)) continue;
      const headline = (post.title || '').trim();
      const text = `${headline} ${post.text || ''}`;
      if (!STRIKE_RE.test(text)) continue;
      const hitOblasts = extractOblasts(text);
      for (const oblast of hitOblasts) {
        events.push({ day, source: 'Telegram', oblast, headline, ts, url: postTelegramUrl(post), sourceLabel: '@oko_gora' });
      }
    }

    const uniqueEvents: StrikeEvent[] = [];
    const seenEventKey = new Set<string>();
    for (const e of events.sort((a, b) => b.ts - a.ts)) {
      const key = `${e.day}|${e.oblast}|${e.source}|${e.headline.toLowerCase().trim()}`;
      if (seenEventKey.has(key)) continue;
      seenEventKey.add(key);
      uniqueEvents.push(e);
    }

    const oblastTotals = new Map<string, number>();
    for (const e of uniqueEvents) {
      oblastTotals.set(e.oblast, (oblastTotals.get(e.oblast) || 0) + 1);
    }
    const oblasts = Array.from(oblastTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([oblast]) => oblast);

    const byDayOblast: Record<string, Record<string, number>> = {};
    for (const d of days) {
      byDayOblast[d] = {};
      for (const o of oblasts) byDayOblast[d][o] = 0;
    }
    for (const e of uniqueEvents) {
      if (!oblasts.includes(e.oblast)) continue;
      byDayOblast[e.day][e.oblast] += 1;
    }

    const maxCell = Math.max(
      1,
      ...days.flatMap((d) => oblasts.map((o) => byDayOblast[d][o] || 0)),
    );
    const trend = days.map((d) => ({
      day: d,
      total: oblasts.reduce((acc, o) => acc + (byDayOblast[d][o] || 0), 0),
    }));
    const maxTrend = Math.max(1, ...trend.map(t => t.total));

    const concreteByOblast = oblasts.map((oblast) => {
      const samples = uniqueEvents
        .filter((e) => e.oblast === oblast)
        .sort((a, b) => b.ts - a.ts)
        .slice(0, 3)
        .map((e) => ({
          headline: e.headline,
          url: e.url,
          source: e.source,
          sourceLabel: e.sourceLabel,
          day: e.day,
        }));
      return { oblast, total: oblastTotals.get(oblast) || 0, samples };
    });

    const bySource = {
      x: uniqueEvents.filter(e => e.source === 'X').length,
      facebook: uniqueEvents.filter(e => e.source === 'Facebook').length,
      telegram: uniqueEvents.filter(e => e.source === 'Telegram').length,
    };

    return { days, oblasts, byDayOblast, maxCell, trend, maxTrend, total: uniqueEvents.length, concreteByOblast, bySource };
  }, [rssItems, fbItems, posts]);

  const sbsTrend = [...(sbsStats?.daily || [])].reverse().slice(-14);
  const sbsMaxDaily = Math.max(1, ...sbsTrend.map((row) => row.targetsHit));
  const sbsTopCategories = (sbsStats?.categories || []).slice(0, 8);
  const sbsMaxCategory = Math.max(1, ...sbsTopCategories.map((row) => row.hit + row.destroyed));
  const deepstateRows = deepstateTable?.rows.slice(0, 8) || [];
  const deepstateMaxAbs = Math.max(1, deepstateTable?.maxAbsDiffKm2 || 1);
  const heroSignals = [
    { label: 'Telegram-пости', value: posts.length, note: 'стрічка Око Гора' },
    { label: 'OSINT RSS', value: rssItems.length + fbItems.length, note: 'X + Facebook' },
    { label: 'Активні підрозділи', value: brigadeDashboard?.totals.unitsWithOfficialFeeds ?? brigadeDashboard?.totals.brigadesWithOfficialFeeds ?? 0, note: 'останні 3 доби' },
    { label: 'Події ударів', value: dashboard.total, note: '7 днів / з посиланнями' },
  ];
  const rssFeed = useMemo(() => {
    const normalized = [
      ...rssItems.map((item) => ({ ...item, feedSource: 'x' as const, sourceLabel: 'X / Twitter' })),
      ...fbItems.map((item) => ({ ...item, feedSource: 'facebook' as const, sourceLabel: 'Facebook' })),
    ].map((item) => {
      const title = cleanRssText(item.titleUk || item.title || '');
      const summary = cleanRssText(item.summaryUk || item.summary || '');
      const tags = (item.tags?.length ? item.tags : ['OSINT', 'HUMINT', 'UKRAINE']).map((tag) => tag.toUpperCase());
      return {
        ...item,
        titleClean: title,
        summaryClean: summary,
        tagsClean: Array.from(new Set(tags)),
        ts: new Date(item.publishedAt).getTime() || 0,
      };
    }).sort((a, b) => b.ts - a.ts);

    const q = rssSearch.trim().toLowerCase();
    return normalized.filter((item) => {
      if (rssSourceFilter !== 'all' && item.feedSource !== rssSourceFilter) return false;
      if (rssTopicFilter !== 'all' && !item.tagsClean.includes(rssTopicFilter)) return false;
      if (!q) return true;
      return `${item.titleClean} ${item.summaryClean} ${item.author} ${item.handle} ${item.tagsClean.join(' ')}`.toLowerCase().includes(q);
    });
  }, [rssItems, fbItems, rssSourceFilter, rssTopicFilter, rssSearch]);
  const rssTopics = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of [...rssItems, ...fbItems]) {
      const tags = (item.tags?.length ? item.tags : ['OSINT', 'HUMINT', 'UKRAINE']).map((tag) => tag.toUpperCase());
      for (const tag of tags.slice(0, 5)) counts.set(tag, (counts.get(tag) || 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([tag, count]) => ({ tag, count }));
  }, [rssItems, fbItems]);

  return (
    <div className="min-h-screen bg-[#252519] text-white selection:bg-[#c9a227] selection:text-[#1c1c12] font-sans overflow-x-hidden">

      {/* ── Navigation ─────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-[1000] border-b border-[#c9a227]/20 bg-[#252519]/95 backdrop-blur-md">
        <div className="flex items-center justify-between px-4 md:px-8 py-3 md:py-4 text-[10px] md:text-xs font-mono uppercase tracking-widest">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-[#c9a227] rounded-sm flex items-center justify-center">
              <div className="w-1.5 h-1.5 bg-[#252519] rounded-sm animate-pulse" />
            </div>
            <Link to="/" className="font-bold tracking-tighter text-white hover:text-[#c9a227] transition-colors">ОКО ГОРА</Link>
          </div>
          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-6 text-white/50">
            <Link to="/" className="hover:text-white transition-colors">Головна</Link>
            <Link to="/targets" className="hover:text-white transition-colors flex items-center gap-1 text-[#c9a227] font-bold">
              <Target className="w-3 h-3" /> БАЗА ЦІЛЕЙ
            </Link>
            <button type="button" onClick={() => openSection('map')} className="hover:text-white transition-colors">Карта</button>
            <button type="button" onClick={() => openSection('brigades')} className="hover:text-white transition-colors">Підрозділи</button>
            <button type="button" onClick={() => openSection('analytics')} className="hover:text-white transition-colors">Аналітика</button>
            <button type="button" onClick={() => openSection('sbs')} className="hover:text-white transition-colors">SBS</button>
            <button type="button" onClick={() => openSection('deepstate')} className="hover:text-white transition-colors">DeepState</button>
            <button type="button" onClick={() => openSection('investigations')} className="hover:text-white transition-colors">Розслідування</button>
            <button type="button" onClick={() => openSection('rss')} className="hover:text-white transition-colors">RSS</button>
            <button type="button" onClick={() => openSection('feed')} className="hover:text-white transition-colors">Стрічка</button>
            <a href="https://t.me/oko_gora" target="_blank" rel="noreferrer"
              className="hover:text-[#c9a227] transition-colors flex items-center gap-1 font-bold text-white">
              ТЕЛЕГРАМ <ArrowUpRight className="w-3 h-3" />
            </a>
          </div>
          {/* Mobile hamburger */}
          <button
            className="md:hidden flex flex-col gap-[5px] p-1"
            onClick={() => setMobileMenuOpen(v => !v)}
            aria-label="Меню"
          >
            <span className={`block w-5 h-[2px] bg-[#c9a227] transition-all duration-300 ${mobileMenuOpen ? 'rotate-45 translate-y-[7px]' : ''}`} />
            <span className={`block w-5 h-[2px] bg-[#c9a227] transition-all duration-300 ${mobileMenuOpen ? 'opacity-0' : ''}`} />
            <span className={`block w-5 h-[2px] bg-[#c9a227] transition-all duration-300 ${mobileMenuOpen ? '-rotate-45 -translate-y-[7px]' : ''}`} />
          </button>
        </div>
        {/* Mobile dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-[#c9a227]/20 bg-[#1c1c12] px-4 py-4 flex flex-col gap-4 font-mono text-[11px] uppercase tracking-widest">
            <Link to="/" className="text-white/60 hover:text-[#c9a227] transition-colors py-1" onClick={() => setMobileMenuOpen(false)}>Головна</Link>
            <Link to="/targets" className="text-[#c9a227] font-bold flex items-center gap-1 py-1" onClick={() => setMobileMenuOpen(false)}>
              <Target className="w-3 h-3" /> БАЗА ЦІЛЕЙ
            </Link>
            <button type="button" onClick={() => openSection('map')} className="text-left text-white/60 hover:text-[#c9a227] transition-colors py-1">Карта</button>
            <button type="button" onClick={() => openSection('brigades')} className="text-left text-white/60 hover:text-[#c9a227] transition-colors py-1">Підрозділи</button>
            <button type="button" onClick={() => openSection('analytics')} className="text-left text-white/60 hover:text-[#c9a227] transition-colors py-1">Аналітика</button>
            <button type="button" onClick={() => openSection('sbs')} className="text-left text-white/60 hover:text-[#c9a227] transition-colors py-1">SBS</button>
            <button type="button" onClick={() => openSection('deepstate')} className="text-left text-white/60 hover:text-[#c9a227] transition-colors py-1">DeepState</button>
            <button type="button" onClick={() => openSection('investigations')} className="text-left text-white/60 hover:text-[#c9a227] transition-colors py-1">Розслідування</button>
            <button type="button" onClick={() => openSection('rss')} className="text-left text-white/60 hover:text-[#c9a227] transition-colors py-1">RSS</button>
            <button type="button" onClick={() => openSection('feed')} className="text-left text-white/60 hover:text-[#c9a227] transition-colors py-1">Стрічка</button>
            <a href="https://t.me/oko_gora" target="_blank" rel="noreferrer"
              className="text-white font-bold flex items-center gap-1 py-1 hover:text-[#c9a227] transition-colors">
              ТЕЛЕГРАМ <ArrowUpRight className="w-3 h-3" />
            </a>
          </div>
        )}
      </nav>

      {/* ── Main ───────────────────────────────────────────────────────────── */}
      <main className="pt-24 md:pt-40 px-4 md:px-8 pb-24">
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="max-w-[1800px] mx-auto"
        >

          {/* Hero Typography */}
          <motion.div variants={fadeIn} className="mb-16 md:mb-32 relative overflow-hidden">
            <div className="absolute inset-0 -z-20 pointer-events-none select-none">
              <img
                src="assets-zsu-patch.png"
                alt=""
                className="w-full h-full object-cover opacity-[0.08] md:opacity-[0.1] grayscale contrast-125"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-[#0c0d10]/30 via-[#0c0d10]/75 to-[#0c0d10]" />
            </div>
            <div className="absolute inset-0 -z-10 flex items-center justify-center overflow-hidden pointer-events-none select-none">
              <motion.img
                src="oko_logo.png"
                alt=""
                initial={{ opacity: 0, scale: 1.1, rotate: -2 }}
                animate={{ opacity: 0.06, scale: 1, rotate: 0 }}
                transition={{ duration: 4, ease: 'easeOut' }}
                className="w-[100%] md:w-[80%] lg:w-[60%] max-w-[1200px] filter brightness-200 mix-blend-screen"
              />
            </div>

            <h1 className="text-[14vw] md:text-[12vw] leading-[0.8] font-bold tracking-tighter uppercase mb-8 relative z-10 text-white">
              Око Гора
            </h1>

            {/* Ukrainian Armed Forces insignia strip — official Wikimedia SVGs */}
            <div className="flex flex-wrap items-center gap-5 mb-10 relative z-10">
              <div className="flex flex-col items-center gap-1.5 group cursor-default" title="Нарукавний знак ЗСУ">
                <div className="w-14 h-14 flex items-center justify-center border border-[#c9a227]/30 bg-[#c9a227]/10 group-hover:border-[#c9a227]/70 group-hover:bg-[#c9a227]/20 transition-all duration-300 p-1.5">
                  <img
                    src="assets-zsu-patch.png"
                    alt="Нарукавний знак ЗСУ"
                    className="w-full h-full object-contain"
                    loading="lazy"
                  />
                </div>
                <span className="font-mono text-[8px] tracking-widest text-[#c9a227]/70 group-hover:text-[#c9a227] transition-colors uppercase">ЗСУ</span>
              </div>
              {[
                { label: 'СВ',  title: 'Сухопутні війська',           url: 'https://upload.wikimedia.org/wikipedia/commons/3/36/%D0%9D%D0%97_%D0%A1%D0%92.svg' },
                { label: 'ПС',  title: 'Повітряні сили',              url: 'https://upload.wikimedia.org/wikipedia/commons/5/59/%D0%9D%D0%97_%D0%9F%D0%A1.svg' },
                { label: 'ВМС', title: 'Військово-морські сили',      url: 'https://upload.wikimedia.org/wikipedia/commons/5/51/%D0%9D%D0%97_%D0%92%D0%9C%D0%A1.svg' },
                { label: 'ССО', title: 'Сили спеціальних операцій',   url: 'https://upload.wikimedia.org/wikipedia/commons/0/0f/%D0%9D%D0%97_%D0%A1%D0%A1%D0%9E.svg' },
                { label: 'ДШВ', title: 'Десантно-штурмові війська',   url: 'https://upload.wikimedia.org/wikipedia/commons/8/81/%D0%9D%D0%97_%D0%92%D0%94%D0%92.svg' },
              ].map(branch => (
                <div key={branch.label} className="flex flex-col items-center gap-1.5 group cursor-default" title={branch.title}>
                  <div className="w-14 h-14 flex items-center justify-center border border-[#c9a227]/20 bg-[#c9a227]/5 group-hover:border-[#c9a227]/60 group-hover:bg-[#c9a227]/10 transition-all duration-300 p-1">
                    <img
                      src={branch.url}
                      alt={branch.title}
                      className="w-full h-full object-contain"
                      loading="lazy"
                      onError={e => { (e.target as HTMLImageElement).style.opacity = '0.2'; }}
                    />
                  </div>
                  <span className="font-mono text-[8px] tracking-widest text-[#c9a227]/50 group-hover:text-[#c9a227] transition-colors uppercase">{branch.label}</span>
                </div>
              ))}
              <a
                href="https://t.me/oko_gora"
                target="_blank"
                rel="noreferrer"
                className="ml-auto hidden md:inline-flex items-center gap-1.5 font-mono text-[9px] text-[#f3d97f]/55 hover:text-[#f3d97f] uppercase tracking-widest transition-colors"
              >
                t.me/oko_gora <ArrowUpRight className="w-3 h-3" />
              </a>
            </div>
            <div className="mb-8 md:mb-12 flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-l-2 border-[#c9a227]/80 bg-[#0f1012]/70 p-4 md:p-5">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#c9a227] mb-2">/ ПЛАТФОРМА TELEGRAM-КАНАЛУ</p>
                <p className="text-white/95 text-lg md:text-2xl font-extrabold leading-tight max-w-5xl">
                  Око Гора - цифрова платформа Telegram-каналу про новини, карту, джерела та аналітику.
                </p>
              </div>
              <a
                href="https://t.me/oko_gora"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 self-start md:self-auto shrink-0 border border-[#c9a227]/60 bg-[#c9a227]/12 px-4 py-3 font-mono text-[11px] md:text-xs tracking-widest uppercase text-[#f3d97f] hover:bg-[#c9a227]/20 hover:border-[#c9a227] transition-colors"
              >
                Перейти в Telegram <ArrowUpRight className="w-3.5 h-3.5" />
              </a>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-10 md:mb-14">
              {heroSignals.map((signal) => (
                <div key={signal.label} className="border border-[#c9a227]/20 bg-[#1c1c12]/80 p-4 md:p-5">
                  <p className="font-mono text-[9px] uppercase tracking-widest text-white/42">{signal.label}</p>
                  <p className="mt-2 text-3xl md:text-5xl font-black tracking-tighter text-[#f3d97f] tabular-nums">{formatNumber(signal.value)}</p>
                  <p className="mt-1 text-xs md:text-sm text-white/50 font-bold">{signal.note}</p>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Interactive Investigations */}
          <motion.section id="investigations" variants={fadeIn} className="mb-32 md:mb-48 scroll-mt-28">
            <div className="border-t border-[#c9a227]/30 pt-12 md:pt-16">
              <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-10">
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#c9a227] mb-4 block">/ НОВИЙ РОЗДІЛ</span>
                  <h2 className="text-4xl md:text-6xl font-bold tracking-tighter uppercase leading-[0.9]">Інтерактивні розслідування</h2>
                </div>
                <a href="https://t.me/oko_gora" target="_blank" rel="noreferrer"
                  className="font-mono text-xs uppercase tracking-widest text-white/30 hover:text-[#c9a227] transition-colors">
                  Telegram-канал <ArrowUpRight className="inline w-3 h-3 ml-1" />
                </a>
              </div>

              <div className="mb-6 border border-[#c9a227]/30 bg-[#11120d] p-5 md:p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 border border-[#c9a227]/40 bg-[#c9a227]/10 flex items-center justify-center shrink-0">
                    <Lock className="w-5 h-5 text-[#c9a227]" />
                  </div>
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-[#c9a227]/80">Розділ відкрито</p>
                    <p className="text-lg md:text-xl font-bold text-white">Перші розслідування вже доступні.</p>
                    <p className="text-sm text-white/55 mt-1">Матеріали виходять окремими кейсами з хронологією, таблицями, джерелами та короткими висновками.</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {(investigations.length ? investigations.filter(i => (i.status || 'published') === 'published') : [
                  { id: 'fallback-1', title: 'Хронологія події', summary: "Що сталося, коли зʼявилися перші повідомлення і які джерела це підтверджують.", code: 'TIMELINE', tags: [], publishedAt: '', status: 'published' as const },
                  { id: 'fallback-2', title: 'Місце на карті', summary: "Координати, найближчі обʼєкти, фото або відео, якщо вони є у відкритому доступі.", code: 'MAP', tags: [], publishedAt: '', status: 'published' as const },
                  { id: 'fallback-3', title: 'Що відомо зараз', summary: "Короткий висновок без перебільшень: що підтверджено, що потребує перевірки, де читати далі.", code: 'SUMMARY', tags: [], publishedAt: '', status: 'published' as const },
                ]).slice(0, 6).map(item => (
                  <article key={item.code} className="bg-[#2e2d1e] border border-[#c9a227]/20 p-6 md:p-8 hover:border-[#c9a227]/50 transition-colors">
                    <p className="font-mono text-[9px] uppercase tracking-[0.25em] text-[#c9a227] mb-4">{item.code}</p>
                    <h3 className="text-2xl font-bold tracking-tight uppercase mb-4 text-white">{item.title}</h3>
                    <p className="text-white/50 text-sm leading-relaxed">{item.summary}</p>
                    <div className="mt-4 flex items-center gap-4">
                      <Link to={`/investigation/${item.id}`} className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-white/65 hover:text-[#c9a227] transition-colors">
                        Детально <ArrowUpRight className="w-3 h-3" />
                      </Link>
                      {item.url && (
                        <a href={item.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-white/45 hover:text-[#c9a227] transition-colors">
                          Джерело <ArrowUpRight className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </motion.section>

          {/* Map */}
          <motion.div id="map" variants={fadeIn} className="mb-32 md:mb-48 w-full scroll-mt-28">
            <Suspense fallback={
              <div className="w-full h-[500px] md:h-[800px] bg-[#1c1c12] border border-[#c9a227]/20 flex items-center justify-center">
                <span className="font-mono text-[10px] uppercase tracking-widest text-[#c9a227]/40 animate-pulse">ЗАВАНТАЖЕННЯ_МАПИ...</span>
              </div>
            }>
              <MapService />
            </Suspense>
          </motion.div>

          {/* System Utilities */}
          <motion.div variants={fadeIn} className="mb-32 md:mb-48">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Terminal */}
              <div className="lg:col-span-1 bg-[#1c1c12] text-[#c9a227] p-6 font-mono text-[10px] leading-relaxed border border-[#c9a227]/25 shadow-2xl relative overflow-hidden">
                <div className="flex items-center gap-2 mb-4 border-b border-[#c9a227]/20 pb-2">
                  <Terminal className="w-3 h-3" />
                  <span className="uppercase tracking-widest text-[9px]">ПРЯМИЙ_ЕФІР_ДАННИХ</span>
                  <span className="ml-auto animate-pulse">●</span>
                </div>
                <div className="space-y-1 opacity-80 h-[120px] overflow-hidden text-white/70">
                  <p>[оновлено] Telegram-стрічка каналу підтягується з posts.json</p>
                  <p>[оновлено] RSS з X/Facebook очищається від HTML і дублів</p>
                  <p>[мапа] Показуємо цілі, події з постів і відкриті стратегічні обʼєкти</p>
                  <p>[джерела] SBS та DeepState мають окремі посилання на оригінали</p>
                  <p>[важливо] Кожну важливу цифру краще перевіряти за джерелом</p>
                  <p className="animate-pulse text-[#c9a227]">_</p>
                </div>
                <div className="mt-8 pt-4 border-t border-[#c9a227]/10 flex justify-between opacity-30 text-[8px] uppercase tracking-widest">
                  <span>ДАНІ: ВІДКРИТІ ДЖЕРЕЛА</span>
                  <span>ОНОВЛЕННЯ: АВТОМАТИЧНІ</span>
                </div>
              </div>

              {/* Cards */}
              <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[#2e2d1e] border border-[#c9a227]/20 p-8 hover:border-[#c9a227]/60 hover:bg-[#363525] transition-all duration-500 group relative">
                  <Activity className="w-8 h-8 mb-6 text-[#c9a227]/40 group-hover:text-[#c9a227] transition-colors" />
                  <h4 className="text-2xl font-bold uppercase mb-2 tracking-tighter">Горюшко · щоденне оновлення</h4>
                  <p className="text-sm text-white/50 leading-snug mb-6">Автоматичний лічильник нових записів у каналі за поточний день і за 7 днів. Сумарне значення беремо з останнього номера у тексті поста, не з ID Telegram.</p>
                  <div className="grid grid-cols-3 gap-2 mb-6 font-mono text-center">
                    <div className="border border-[#c9a227]/20 py-2">
                      <div className="text-lg font-bold text-[#c9a227]">{pechalStats?.counters.today ?? 0}</div>
                      <div className="text-[8px] uppercase tracking-widest text-white/40">сьогодні</div>
                    </div>
                    <div className="border border-[#c9a227]/20 py-2">
                      <div className="text-lg font-bold text-white">{pechalStats?.counters.last7Days ?? 0}</div>
                      <div className="text-[8px] uppercase tracking-widest text-white/40">7 днів</div>
                    </div>
                    <div className="border border-[#c9a227]/20 py-2">
                      <div className="text-lg font-bold text-white">{(pechalStats?.counters.totalBySerial ?? pechalStats?.counters.totalApproxByMaxPostId ?? 0).toLocaleString('uk-UA')}</div>
                      <div className="text-[8px] uppercase tracking-widest text-white/40">сумарно*</div>
                    </div>
                  </div>
                  <div className="mb-5 border border-[#c9a227]/18 bg-[#1c1c12]/55 p-3 font-mono text-[9px] uppercase tracking-widest text-white/42">
                    <div className="flex items-center justify-between gap-3">
                      <span>Оновлено</span>
                      <span className="text-white/75">{formatSnapshotDate(pechalStats?.generatedAt)}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <span>Останній пост</span>
                      {pechalStats?.latestProofs?.[0]?.url ? (
                        <a href={pechalStats.latestProofs[0].url} target="_blank" rel="noreferrer" className="text-[#c9a227] hover:text-[#f1d98a] transition-colors">
                          #{pechalStats.latestProofs[0].id}
                        </a>
                      ) : (
                        <span className="text-white/45">н/д</span>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-between items-center font-mono text-[10px] tracking-widest pt-4 border-t border-white/10">
                    <a href={pechalStats?.sourceUrl || 'https://t.me/s/pechalbeda200'} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-[#c9a227] hover:text-[#f1d98a] transition-colors"><Shield className="w-3 h-3" /> Відкрити канал</a>
                    <span className="text-white/30">*номер у пості</span>
                  </div>
                </div>

                <Link to="/targets" className="bg-[#2e2d1e] border border-[#c9a227]/20 p-8 hover:border-[#c9a227]/60 hover:bg-[#363525] transition-all duration-500 group relative block">
                  <Database className="w-8 h-8 mb-6 text-[#c9a227]/40 group-hover:text-[#c9a227] transition-colors" />
                  <h4 className="text-2xl font-bold uppercase mb-2 tracking-tighter">База Цілей</h4>
                  <p className="text-sm text-white/50 leading-snug mb-8">Каталог НПЗ, авіабаз, складів і об'єктів ВПК Росії з координатами та статусом ураження.</p>
                  <div className="flex justify-between items-center font-mono text-[10px] tracking-widest pt-4 border-t border-white/10">
                    <span className="flex items-center gap-2 text-[#c9a227]"><Shield className="w-3 h-3" /> 38+ ОБ'ЄКТІВ</span>
                    <span className="text-white/30 group-hover:text-[#c9a227] flex items-center gap-1 transition-colors">ВІДКРИТИ <ArrowUpRight className="w-3 h-3" /></span>
                  </div>
                </Link>
              </div>
            </div>

            {/* Dashboard strip */}
            <div className="mt-8 aspect-[21/4] w-full bg-[#1c1c12] relative overflow-hidden group border border-[#c9a227]/10">
              <img
                src="ui_dashboard.png"
                alt=""
                className="w-full h-full object-cover opacity-30 grayscale group-hover:opacity-50 group-hover:grayscale-0 transition-all duration-1000 scale-105 group-hover:scale-100"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-[#1c1c12] via-transparent to-[#1c1c12]" />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-[#c9a227]/30 font-mono text-[10px] tracking-[0.5em] uppercase">
                  Сайт збирає відкриті дані та дає швидкі переходи до джерел
                </div>
              </div>
            </div>
          </motion.div>

          {/* Brigades Dashboard */}
          <motion.section id="brigades" variants={fadeIn} className="mb-32 md:mb-48 scroll-mt-28">
            <div className="border-t border-[#c9a227]/30 pt-12 md:pt-16">
              <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-10">
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#c9a227] mb-4 block">/ UNITS DASHBOARD</span>
                  <h2 className="text-4xl md:text-6xl font-bold tracking-tighter uppercase leading-[0.9]">Активні підрозділи: ураження та реорганізація</h2>
                  <p className="mt-4 text-white/60 max-w-4xl text-sm leading-relaxed">
                    Автоматичний моніторинг офіційних X/Facebook-пабів українських підрозділів (бригади, полки, батальйони та інші) за останні 3 доби. Показуємо тільки ті підрозділи, що реально активні в цей період.
                  </p>
                </div>
                <div className="bg-[#1c1c12] border border-[#c9a227]/20 px-6 py-5 min-w-[260px]">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-[#c9a227]/70">Статус вибірки</p>
                  <p className="text-xl font-bold tracking-tight text-white">
                    {(brigadeDashboard?.totals.unitsWithOfficialFeeds ?? brigadeDashboard?.totals.brigadesWithOfficialFeeds ?? 0)}
                    /
                    {(brigadeDashboard?.totals.units ?? brigadeDashboard?.totals.brigades ?? 0)} активних
                  </p>
                  <p className="mt-1 text-xs text-white/45">Ураження: {brigadeDashboard?.totals.strikeItems ?? 0}</p>
                  <p className="text-xs text-white/45">Реорганізація: {brigadeDashboard?.totals.reorgItems ?? 0}</p>
                  <p className="text-xs text-white/45">Автознайдено підрозділів: {brigadeDashboard?.totals.autoDiscoveredUnits ?? 0}</p>
                  <p className="mt-1 text-xs text-white/45">Оновлено: {brigadeDashboard?.generatedAt ? formatRssDate(brigadeDashboard.generatedAt) : 'очікується...'}</p>
                </div>
              </div>

              {!brigadeDashboard || !brigadeDashboard.brigades.length ? (
                <div className="border border-[#c9a227]/20 bg-[#2e2d1e] p-8 font-mono text-xs uppercase tracking-widest text-white/40">
                  Дані дашборду підрозділів ще формуються. Запусти синхронізацію або зачекай автооновлення.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                  {brigadeDashboard.brigades.map((row) => (
                    <article key={row.id} className="bg-[#2b2a1f] border border-[#c9a227]/20 p-5 md:p-6">
                      <h3 className="text-xl font-extrabold leading-snug mb-4">
                        {row.name}
                        {row.autoDiscovered ? <span className="ml-2 text-[10px] align-middle px-2 py-0.5 border border-emerald-400/40 text-emerald-300 font-mono uppercase tracking-widest">auto</span> : null}
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4 font-mono text-center">
                        <div className="border border-[#c9a227]/20 py-2">
                          <div className="text-base font-bold text-[#c9a227]">{row.officialItems}</div>
                          <div className="text-[8px] uppercase tracking-widest text-white/40">офіційні</div>
                        </div>
                        <div className="border border-[#c9a227]/20 py-2">
                          <div className="text-base font-bold text-white">{row.mentionItems}</div>
                          <div className="text-[8px] uppercase tracking-widest text-white/40">згадки</div>
                        </div>
                        <div className="border border-[#c9a227]/20 py-2">
                          <div className="text-base font-bold text-white">{row.significantItems}</div>
                          <div className="text-[8px] uppercase tracking-widest text-white/40">значимі</div>
                        </div>
                        <div className="border border-[#c9a227]/20 py-2">
                          <div className="text-base font-bold text-white">{row.strikeItems}</div>
                          <div className="text-[8px] uppercase tracking-widest text-white/40">ураження</div>
                        </div>
                        <div className="border border-[#c9a227]/20 py-2">
                          <div className="text-base font-bold text-white">{row.reorgItems}</div>
                          <div className="text-[8px] uppercase tracking-widest text-white/40">реорганізація</div>
                        </div>
                      </div>

                      {row.items.length === 0 ? (
                        <p className="text-sm text-white/45 leading-relaxed">За останні 3 доби не знайдено релевантних постів у доступних публічних фідах.</p>
                      ) : (
                        <div className="space-y-3">
                          {row.items.slice(0, 3).map((item) => (
                            <a key={item.id} href={item.url} target="_blank" rel="noreferrer" className="block border border-white/10 p-3 hover:border-[#c9a227]/45 transition-colors">
                              <div className="flex items-center justify-between mb-2 font-mono text-[9px] tracking-widest uppercase">
                                <span className={item.origin === 'official' ? 'text-[#c9a227]' : 'text-white/50'}>{item.origin === 'official' ? 'Офіційний паб' : 'Моніторинг згадок'}</span>
                                <span className="text-white/35">{formatRssDate(item.publishedAt)}</span>
                              </div>
                              <p className="text-sm text-white/80 leading-snug">{formatPreview(item.titleUk || item.title || '', 130)}</p>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {item.isStrike && (
                                  <span className="px-2 py-0.5 border border-[#c9a227]/40 text-[9px] font-mono uppercase tracking-widest text-[#c9a227]">Ураження</span>
                                )}
                                {item.isReorg && (
                                  <span className="px-2 py-0.5 border border-sky-400/40 text-[9px] font-mono uppercase tracking-widest text-sky-300">Реорганізація</span>
                                )}
                              </div>
                            </a>
                          ))}
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </div>
          </motion.section>

          {/* 7D Dashboard */}
          <motion.section id="analytics" variants={fadeIn} className="mb-32 md:mb-48 scroll-mt-28">
            <div className="border-t border-[#c9a227]/30 pt-12 md:pt-16">
              <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-10">
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#c9a227] mb-4 block">/ OSINT DASHBOARD</span>
                  <h2 className="text-4xl md:text-6xl font-bold tracking-tighter uppercase leading-[0.9]">Карта згадок про удари (7 днів)</h2>
                  <p className="mt-4 text-white/60 max-w-3xl text-sm">Цей блок показує не підтверджену кількість реальних влучань, а інтенсивність згадок про удари у відкритих джерелах за останні 7 днів. Ми беремо пости з Telegram, X і Facebook, шукаємо маркери удару, визначаємо область за текстом і лишаємо посилання на першоджерело.</p>
                </div>
                <div className="bg-[#1c1c12] border border-[#c9a227]/20 px-6 py-5">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-[#c9a227]/70">Унікальних згадок (7 днів)</p>
                  <p className="text-5xl font-bold tracking-tighter text-white">{dashboard.total}</p>
                  <p className="mt-2 text-xs text-white/45">Після дедуплікації за днем, областю, джерелом і заголовком.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="border border-[#c9a227]/20 bg-[#1c1c12] p-4">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-[#c9a227]/70 mb-2">Що це за метрика</p>
                  <p className="text-sm text-white/70 leading-relaxed">Це індикатор інформаційної активності: скільки окремих згадок про удари зʼявилося у стрічці, а не офіційний BDA.</p>
                </div>
                <div className="border border-[#c9a227]/20 bg-[#1c1c12] p-4">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-[#c9a227]/70 mb-2">Що показує heatmap</p>
                  <p className="text-sm text-white/70 leading-relaxed">Кожна клітинка: скільки унікальних згадок про удари привʼязалося до конкретної області у конкретний день.</p>
                </div>
                <div className="border border-[#c9a227]/20 bg-[#1c1c12] p-4">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-[#c9a227]/70 mb-2">Що показує тренд</p>
                  <p className="text-sm text-white/70 leading-relaxed">Горизонтальна шкала праворуч: сумарна кількість згадок за добу по всіх областях, що увійшли в поточний топ.</p>
                </div>
                <div className="border border-[#c9a227]/20 bg-[#1c1c12] p-4">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-[#c9a227]/70 mb-2">Що таке “Конкретика”</p>
                  <p className="text-sm text-white/70 leading-relaxed">Нижче наведені реальні заголовки з джерел, дата та автор. Клік по рядку відкриває першоджерело.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
                <div className="border border-white/10 bg-[#0f1012] p-4">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-white/35 mb-2">Областей у топі</p>
                  <p className="text-3xl font-bold tracking-tighter text-white">{dashboard.oblasts.length}</p>
                </div>
                <div className="border border-white/10 bg-[#0f1012] p-4">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-white/35 mb-2">Середнє за добу</p>
                  <p className="text-3xl font-bold tracking-tighter text-white">{dashboard.days.length ? (dashboard.total / dashboard.days.length).toFixed(1) : '0.0'}</p>
                </div>
                <div className="border border-white/10 bg-[#0f1012] p-4">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-white/35 mb-2">Пік за добу</p>
                  <p className="text-3xl font-bold tracking-tighter text-white">{dashboard.maxTrend}</p>
                </div>
                <div className="border border-white/10 bg-[#0f1012] p-4">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-white/35 mb-2">Макс. клітинка</p>
                  <p className="text-3xl font-bold tracking-tighter text-white">{dashboard.maxCell}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                <div className="xl:col-span-7 bg-[#1c1c12] border border-[#c9a227]/20 p-6 md:p-8">
                  <h3 className="font-mono text-[10px] uppercase tracking-widest text-[#c9a227]/70 mb-2">Heatmap · День × Область</h3>
                  <p className="text-xs text-white/45 mb-4">Темніша клітинка означає більше згадок у межах цього дня та цієї області відносно інших клітинок у 7-денному вікні.</p>
                  <div className="space-y-2">
                    {dashboard.days.map((day) => (
                      <div key={day} className="grid gap-2 items-center" style={{ gridTemplateColumns: `70px repeat(${Math.max(1, dashboard.oblasts.length)}, minmax(0, 1fr))` }}>
                        <span className="font-mono text-[10px] text-white/35 uppercase">{day.slice(5)}</span>
                        {dashboard.oblasts.map((oblast) => {
                          const value = dashboard.byDayOblast[day][oblast] || 0;
                          const alpha = value === 0 ? 0.06 : 0.18 + (value / dashboard.maxCell) * 0.82;
                          return (
                            <div key={`${day}-${oblast}`} className="h-8 border border-[#c9a227]/20 flex items-center justify-between px-2" style={{ backgroundColor: `rgba(201,162,39,${alpha})` }}>
                              <span className="font-mono text-[9px] uppercase text-white/70 truncate">{oblast.replace('РФ: ', '')}</span>
                              <span className="font-mono text-[10px] font-bold text-white">{value}</span>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="xl:col-span-5 bg-[#2e2d1e] border border-[#c9a227]/20 p-6 md:p-8">
                  <h3 className="font-mono text-[10px] uppercase tracking-widest text-[#c9a227]/70 mb-2">Тренд · День</h3>
                  <p className="text-xs text-white/45 mb-4">Кожен рядок показує загальну кількість згадок про удари за добу по областях, що потрапили у топ цього блоку.</p>
                  <div className="space-y-2">
                    {dashboard.trend.map((t) => (
                      <div key={t.day} className="flex items-center gap-3">
                        <span className="font-mono text-[10px] text-white/35 w-14">{t.day.slice(5)}</span>
                        <div className="h-3 bg-[#c9a227] transition-all" style={{ width: `${Math.max(6, (t.total / dashboard.maxTrend) * 100)}%` }} />
                        <span className="font-mono text-[10px] text-white/75">{t.total}</span>
                      </div>
                    ))}
                  </div>
                  <h3 className="font-mono text-[10px] uppercase tracking-widest text-[#c9a227]/70 mt-8 mb-3">Топ-області</h3>
                  <div className="space-y-2">
                    {dashboard.concreteByOblast.slice(0, 6).map((row) => (
                      <div key={row.oblast} className="flex items-center justify-between border-b border-white/10 pb-1">
                        <span className="text-white/70 text-sm truncate">{row.oblast}</span>
                        <span className="font-mono text-[10px] text-[#c9a227]">{row.total}</span>
                      </div>
                    ))}
                  </div>
                  <h3 className="font-mono text-[10px] uppercase tracking-widest text-[#c9a227]/70 mt-8 mb-3">Джерела (7 днів)</h3>
                  <div className="space-y-2 font-mono text-[10px] uppercase tracking-widest">
                    <div className="flex items-center justify-between border-b border-white/10 pb-1"><span className="text-white/60">X / Twitter</span><span className="text-[#c9a227]">{dashboard.bySource.x}</span></div>
                    <div className="flex items-center justify-between border-b border-white/10 pb-1"><span className="text-white/60">Facebook</span><span className="text-[#c9a227]">{dashboard.bySource.facebook}</span></div>
                    <div className="flex items-center justify-between border-b border-white/10 pb-1"><span className="text-white/60">Telegram</span><span className="text-[#c9a227]">{dashboard.bySource.telegram}</span></div>
                  </div>
                </div>
              </div>

              <div className="mt-6 bg-[#1c1c12] border border-[#c9a227]/20 p-6 md:p-8">
                <h3 className="font-mono text-[10px] uppercase tracking-widest text-[#c9a227]/70 mb-4">Конкретика по областях</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {dashboard.concreteByOblast.map((row) => (
                    <div key={row.oblast} className="border border-[#c9a227]/20 bg-[#2e2d1e] p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono text-[10px] uppercase tracking-widest text-[#c9a227]">{row.oblast}</span>
                        <span className="font-mono text-[10px] text-white/50">{row.total} подій</span>
                      </div>
                      <div className="space-y-2">
                        {row.samples.length === 0 ? (
                          <p className="text-xs text-white/40">Немає заголовків у вікні 7 днів.</p>
                        ) : row.samples.map((s) => (
                          <a key={`${row.oblast}-${s.day}-${s.url}`} href={s.url} target="_blank" rel="noreferrer" className="block text-sm text-white/80 leading-snug hover:text-[#c9a227] transition-colors">
                            • [{s.source}] {s.headline}
                            <span className="ml-1 text-white/40 font-mono text-[10px]">({s.day.slice(5)} · {s.sourceLabel})</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-6 bg-[#0f1012] border border-[#c9a227]/20 p-6 md:p-8">
                <h3 className="font-mono text-[10px] uppercase tracking-widest text-[#c9a227]/70 mb-4">Методологія підрахунку</h3>
                <p className="text-sm text-white/55 leading-relaxed mb-4">Блок варто читати як моніторинг інформаційного навантаження по темі ударів. Один і той самий реальний епізод може дати кілька окремих згадок у різних джерелах, а окремі згадки можуть описувати наслідки, а не момент удару.</p>
                <ol className="list-decimal pl-5 space-y-2 text-sm text-white/75 leading-relaxed">
                  <li>Збираємо пости за останні 7 діб із Telegram, X і Facebook.</li>
                  <li>Враховуємо лише пости з маркерами удару: `удар`, `влуч`, `strike`, `missile`, `бпла` тощо.</li>
                  <li>Визначаємо область через словник гео-аліасів у тексті.</li>
                  <li>Видаляємо дублікати подій за ключем: день + область + джерело + заголовок.</li>
                  <li>Кожен пункт має пряме посилання на пост або сторінку, звідки взята інформація.</li>
                </ol>
              </div>
            </div>
          </motion.section>

          {/* SBS Stats */}
          <motion.section id="sbs" variants={fadeIn} className="mb-32 md:mb-48 scroll-mt-28">
            <div className="border-t border-[#c9a227]/30 pt-12 md:pt-16">
              <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-8">
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#c9a227] mb-4 block">/ SBS STATS</span>
                  <h2 className="text-4xl md:text-6xl font-bold uppercase leading-[0.92]">SBS: ураження за добу</h2>
                  <p className="mt-4 text-white/68 max-w-4xl text-sm md:text-base leading-relaxed">
                    Тут показана відкрита статистика SBS у зручному вигляді. Беремо останній доступний запис за добу, показуємо кількість уражених і знищених цілей, категорії техніки та посилання на оригінальну сторінку.
                  </p>
                </div>
                <a href="https://foosint.github.io/sbs-stats/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 border border-[#c9a227]/60 bg-[#c9a227]/12 px-4 py-2 font-mono text-[11px] md:text-xs tracking-widest uppercase text-[#f3d97f] hover:bg-[#c9a227]/20 hover:border-[#c9a227] transition-colors">
                  Відкрити джерело <ArrowUpRight className="w-3.5 h-3.5" />
                </a>
              </div>
              <div className="relative overflow-hidden border border-[#c9a227]/25 bg-[#10110d]">
                <div className="absolute inset-0 opacity-25" style={{ backgroundImage: 'linear-gradient(rgba(201,162,39,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(201,162,39,0.12) 1px, transparent 1px)', backgroundSize: '34px 34px' }} />
                <div className="absolute -right-28 -top-28 w-[520px] h-[520px] border border-[#c9a227]/20 rounded-full" />
                <div className="relative grid grid-cols-1 xl:grid-cols-12 gap-6 p-5 md:p-8">
                  <div className="xl:col-span-4 border border-[#c9a227]/25 bg-[#1c1c12]/90 p-5 md:p-7">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-mono text-[10px] uppercase tracking-widest text-[#c9a227]/70">останній зріз</p>
                        <h3 className="text-2xl md:text-3xl font-extrabold uppercase leading-none mt-2">Доба {sbsStats?.latestDate || '...'}</h3>
                        <p className="mt-2 text-xs text-white/48">Година: {sbsStats ? `${sbsStats.latestHour}:00 UTC` : 'очікується'} · оновлено {formatSnapshotDate(sbsStats?.generatedAt)}</p>
                      </div>
                      <RadioTower className="w-8 h-8 text-[#c9a227] shrink-0" />
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-7">
                      {[
                        ['Цілі hit', sbsStats?.summary.targetsHit, 'за поточну добу'],
                        ['Знищено', sbsStats?.summary.targetsDestroyed, 'destroyed'],
                        ['Втрати о/с', sbsStats?.summary.personnelCasualties, 'killed + wounded'],
                        ['KIA', sbsStats?.summary.personnelKilled, 'за SBS DB'],
                      ].map(([label, value, note]) => (
                        <div key={label as string} className="border border-[#c9a227]/18 bg-[#252519]/80 p-4">
                          <p className="font-mono text-[9px] uppercase tracking-widest text-white/42">{label}</p>
                          <p className="mt-2 text-3xl font-black tracking-tighter text-[#f3d97f] tabular-nums">{formatNumber(value as number)}</p>
                          <p className="mt-1 text-[11px] text-white/45">{note}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-6 border-t border-white/10 pt-5">
                      <p className="text-sm text-white/65 leading-relaxed">
                    Це не прогноз і не оцінка редакції. Це зріз із відкритої бази: якщо джерело оновило дані, сайт підтягує новий JSON.
                      </p>
                    </div>
                  </div>
                  <div className="xl:col-span-8 grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="lg:col-span-2 border border-[#c9a227]/20 bg-[#0f1012]/85 p-5">
                      <div className="flex items-center justify-between gap-4 mb-5">
                        <div>
                          <p className="font-mono text-[10px] uppercase tracking-widest text-[#c9a227]/70">категорії уражень</p>
                          <h4 className="text-2xl font-extrabold uppercase leading-none mt-1">Що саме фіксує SBS</h4>
                        </div>
                        <BarChart3 className="w-7 h-7 text-[#c9a227]" />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {(sbsTopCategories.length ? sbsTopCategories : [{ id: 0, label: 'Очікуємо синхронізацію', hit: 0, destroyed: 0 }]).map((item) => (
                          <div key={item.id} className="border border-[#c9a227]/18 bg-[#252519]/70 p-4">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-base md:text-lg font-extrabold uppercase leading-tight">{item.label}</p>
                              <p className="font-mono text-[10px] text-[#f3d97f] shrink-0">hit {formatNumber(item.hit)}</p>
                            </div>
                            <div className="mt-3 h-2 bg-white/10">
                              <div className="h-full bg-[#c9a227]" style={{ width: `${Math.max(3, ((item.hit + item.destroyed) / sbsMaxCategory) * 100)}%` }} />
                            </div>
                            <p className="mt-2 text-xs text-white/50">Знищено: <span className="font-bold text-white/80">{formatNumber(item.destroyed)}</span></p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="border border-[#c9a227]/20 bg-[#1c1c12]/80 p-5">
                      <p className="font-mono text-[10px] uppercase tracking-widest text-[#c9a227]/70 mb-4">добовий тренд hit</p>
                      <div className="space-y-2">
                        {sbsTrend.map((row) => (
                          <div key={`${row.date}-${row.hour}`} className="grid grid-cols-[76px_1fr_52px] items-center gap-3">
                            <span className="font-mono text-[10px] text-white/50">{row.date.slice(5)}</span>
                            <div className="h-3 bg-white/10">
                              <div className="h-full bg-[#c9a227]" style={{ width: `${Math.max(4, (row.targetsHit / sbsMaxDaily) * 100)}%` }} />
                            </div>
                            <span className="font-mono text-[10px] text-white/75 text-right">{formatNumber(row.targetsHit)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="border border-[#c9a227]/20 bg-[#1c1c12]/80 p-5">
                      <p className="font-mono text-[10px] uppercase tracking-widest text-[#c9a227]/70 mb-4">методологія</p>
                      <div className="space-y-3 text-sm text-white/67 leading-relaxed">
                        {(sbsStats?.methodology || [
                          'JSON ще не завантажено у браузері.',
                          'Після синхронізації тут буде методологія джерела.',
                        ]).map((line) => (
                          <p key={line} className="border-b border-white/10 pb-2">{line}</p>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.section>

          {/* DeepState Table */}
          <motion.section id="deepstate" variants={fadeIn} className="mb-32 md:mb-48 scroll-mt-28">
            <div className="border-t border-[#c9a227]/30 pt-12 md:pt-16">
              <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-8">
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#c9a227] mb-4 block">/ DEEPSTATE TABLE</span>
                  <h2 className="text-4xl md:text-6xl font-bold uppercase leading-[0.92]">DeepState: зміни фронту</h2>
                  <p className="mt-4 text-white/68 max-w-4xl text-sm md:text-base leading-relaxed">
                    Тут коротко показані останні рядки з таблиці DeepState: скільки змінилося, який текст пояснення і де відкрити повну таблицю.
                  </p>
                </div>
                <a href="https://deepstat.xyz/table" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 border border-[#c9a227]/60 bg-[#c9a227]/12 px-4 py-2 font-mono text-[11px] md:text-xs tracking-widest uppercase text-[#f3d97f] hover:bg-[#c9a227]/20 hover:border-[#c9a227] transition-colors">
                  Відкрити DeepState <ArrowUpRight className="w-3.5 h-3.5" />
                </a>
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                <div className="xl:col-span-7 border border-[#c9a227]/25 bg-[#10110d] p-5 md:p-7 overflow-hidden">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-widest text-[#c9a227]/70">data-diff matrix</p>
                      <h3 className="text-2xl md:text-3xl font-extrabold uppercase leading-none mt-2">Останні зміни за таблицею</h3>
                      <p className="mt-2 text-sm text-white/52">Мінус у DeepState означає збільшення окупованої площі, плюс — звільнення або уточнення на користь України.</p>
                    </div>
                    <MapPinned className="w-8 h-8 text-[#c9a227]" />
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                    {[
                      ['Окуповано', formatKm2(deepstateTable?.latest?.occupiedKm2), `${deepstateTable?.latest?.occupiedPercent?.toFixed(3) || '0.000'}%`],
                      ['Останній diff', formatSignedKm2(deepstateTable?.latest?.diffKm2), `рядок: ${deepstateTable?.latest?.day || '...'}`],
                      ['Сума вікна', formatSignedKm2(deepstateTable?.netChangeKm2), `${deepstateTable?.recentWindowDays || 0} останніх рядків`],
                      ['Оновлено', formatSnapshotDate(deepstateTable?.generatedAt), 'локальний JSON'],
                    ].map(([label, value, note]) => (
                      <div key={label} className="border border-[#c9a227]/18 bg-[#1c1c12]/80 p-4">
                        <p className="font-mono text-[9px] uppercase tracking-widest text-white/42">{label}</p>
                        <p className="mt-2 text-xl md:text-2xl font-black tracking-tighter text-[#f3d97f] tabular-nums">{value}</p>
                        <p className="mt-1 text-xs text-white/48">{note}</p>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-4 md:grid-cols-8 gap-2 min-h-[220px]">
                    {(deepstateRows.length ? deepstateRows : Array.from({ length: 8 }, (_, i) => ({ day: `${i + 1}`, diffKm2: 0, text: 'Очікуємо дані', occupiedKm2: 0, occupiedPercent: 0 }))).map((row, i) => {
                      const intensity = Math.max(0.12, Math.min(1, Math.abs(row.diffKm2) / deepstateMaxAbs));
                      const isRelease = row.diffKm2 > 0;
                      return (
                        <div
                          key={`${row.day}-${i}`}
                          className={`relative min-h-[120px] border p-3 flex flex-col justify-between ${isRelease ? 'border-sky-300/40 bg-sky-400/15' : 'border-[#c9a227]/35 bg-[#c9a227]/15'}`}
                          style={{ opacity: 0.48 + intensity * 0.52 }}
                          title={row.text}
                        >
                          <span className="font-mono text-[10px] text-white/60">день {row.day}</span>
                          <span className={`text-2xl font-black tracking-tighter tabular-nums ${isRelease ? 'text-sky-200' : 'text-[#f3d97f]'}`}>{formatSignedKm2(row.diffKm2)}</span>
                          <span className="font-mono text-[9px] uppercase tracking-widest text-white/38">{isRelease ? 'звільнення' : 'просування ворога'}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-5 border border-white/10 bg-[#1c1c12]/70 p-4">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-[#c9a227]/70 mb-2">останнє пояснення</p>
                    <p className="text-lg md:text-xl font-bold leading-snug text-white">{deepstateTable?.latest?.text || 'Очікуємо синхронізацію таблиці DeepState.'}</p>
                  </div>
                </div>
                <div className="xl:col-span-5 border border-[#c9a227]/25 bg-[#1c1c12] p-5 md:p-7">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-widest text-[#c9a227]/70">table rows</p>
                      <h3 className="text-2xl font-extrabold uppercase leading-none mt-2">Пояснення з рядків</h3>
                    </div>
                    <Table2 className="w-7 h-7 text-[#c9a227]" />
                  </div>
                  <div className="space-y-3 max-h-[560px] overflow-y-auto pr-1">
                    {deepstateRows.map((row) => (
                      <div key={`${row.day}-${row.text}`} className="grid grid-cols-[1fr_auto] gap-4 items-start border-b border-white/10 pb-3">
                        <div>
                          <p className="font-mono text-[10px] uppercase tracking-widest text-[#c9a227]/70">рядок {row.day} · {row.occupiedPercent.toFixed(3)}%</p>
                          <p className="text-base md:text-lg font-bold leading-snug mt-1">{row.text}</p>
                          <p className="text-xs text-white/45 mt-1">Окупована площа: {formatKm2(row.occupiedKm2)}</p>
                        </div>
                        <span className={`font-mono text-[9px] uppercase tracking-widest border px-2 py-1 shrink-0 ${row.diffKm2 > 0 ? 'border-sky-300/35 text-sky-200' : 'border-[#c9a227]/35 text-[#f3d97f]'}`}>{formatSignedKm2(row.diffKm2)}</span>
                      </div>
                    ))}
                    {deepstateRows.length === 0 && (
                      <p className="text-sm text-white/55">JSON DeepState ще не завантажено. Після синхронізації тут зʼявляться останні рядки таблиці.</p>
                    )}
                  </div>
                  <a href="https://deepstat.xyz/table" target="_blank" rel="noreferrer" className="mt-6 flex items-center justify-between border border-[#c9a227]/30 bg-[#c9a227]/10 p-4 font-mono text-[10px] uppercase tracking-widest text-[#f3d97f] hover:bg-[#c9a227]/15 transition-colors">
                    Перейти до актуальної таблиці
                    <ArrowUpRight className="w-4 h-4" />
                  </a>
                  <div className="mt-4 space-y-2 text-xs text-white/45 leading-relaxed">
                    {(deepstateTable?.methodology || []).map((line) => (
                      <p key={line}>• {line}</p>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.section>

          {/* RSS / X feed */}
          <motion.section id="rss" variants={fadeIn} className="mb-32 md:mb-48 scroll-mt-28">
            <div className="border-t border-[#c9a227]/30 pt-12 md:pt-16">
              <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-8">
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#c9a227] mb-4 block">/ LIVE RSS</span>
                  <h2 className="text-4xl md:text-6xl font-bold tracking-tighter uppercase leading-[0.9]">RSS OSINT-стрічка</h2>
                  <p className="mt-4 text-white/70 max-w-4xl text-sm md:text-base leading-relaxed font-medium">
                    Пости з X і Facebook за останні 3 дні про Україну, війну, підрозділи, удари та відкриті джерела. Текст очищається від HTML-вставок, картки сортуються за часом, а фільтри допомагають швидко знайти потрібну тему.
                  </p>
                </div>
                <a href="https://x.com" target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-2 self-start lg:self-auto border border-[#c9a227]/45 bg-[#c9a227]/10 px-4 py-3 font-mono text-[11px] uppercase tracking-widest text-[#f3d97f] hover:bg-[#c9a227]/16 transition-colors shrink-0">
                  Перевірити X <ArrowUpRight className="w-3.5 h-3.5" />
                </a>
              </div>

              <div className="mb-6 grid grid-cols-1 xl:grid-cols-12 gap-4">
                <div className="xl:col-span-5 border border-[#c9a227]/20 bg-[#1c1c12]/80 p-4 md:p-5">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-[#c9a227]/70 mb-3">швидкий пошук</p>
                  <input
                    value={rssSearch}
                    onChange={(e) => setRssSearch(e.target.value)}
                    placeholder="Пошук: Pokrovsk, drone, СБС, reorg..."
                    className="w-full bg-[#10110d] border border-[#c9a227]/25 px-4 py-3 text-base font-bold text-white placeholder:text-white/28 outline-none focus:border-[#c9a227]/70 transition-colors"
                  />
                </div>
                <div className="xl:col-span-4 border border-[#c9a227]/20 bg-[#1c1c12]/80 p-4 md:p-5">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-[#c9a227]/70 mb-3">джерело</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      ['all', 'Усі', rssItems.length + fbItems.length],
                      ['x', 'X', rssItems.length],
                      ['facebook', 'Facebook', fbItems.length],
                    ].map(([id, label, count]) => (
                      <button
                        key={id as string}
                        type="button"
                        onClick={() => setRssSourceFilter(id as 'all' | 'x' | 'facebook')}
                        className={`border px-3 py-2 text-left transition-colors ${rssSourceFilter === id ? 'border-[#c9a227] bg-[#c9a227]/18 text-[#f3d97f]' : 'border-white/10 bg-white/[0.03] text-white/52 hover:text-white hover:border-[#c9a227]/40'}`}
                      >
                        <span className="block font-mono text-[9px] uppercase tracking-widest">{label}</span>
                        <span className="block mt-1 text-xl font-black tabular-nums">{formatNumber(count as number)}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="xl:col-span-3 border border-[#c9a227]/20 bg-[#1c1c12]/80 p-4 md:p-5">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-[#c9a227]/70 mb-3">результат</p>
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <p className="text-4xl font-black tracking-tighter text-[#f3d97f] tabular-nums">{formatNumber(rssFeed.length)}</p>
                      <p className="text-xs text-white/45 font-bold">карток після фільтрів</p>
                    </div>
                    <Rss className="w-8 h-8 text-[#c9a227]/60 mb-1" />
                  </div>
                </div>
              </div>

              <div className="mb-8 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setRssTopicFilter('all')}
                  className={`px-3 py-2 border font-mono text-[10px] uppercase tracking-widest transition-colors ${rssTopicFilter === 'all' ? 'border-[#c9a227] bg-[#c9a227]/18 text-[#f3d97f]' : 'border-white/10 text-white/45 hover:text-white hover:border-[#c9a227]/40'}`}
                >
                  Усі теми
                </button>
                {rssTopics.map((topic) => (
                  <button
                    key={topic.tag}
                    type="button"
                    onClick={() => setRssTopicFilter(topic.tag)}
                    className={`px-3 py-2 border font-mono text-[10px] uppercase tracking-widest transition-colors ${rssTopicFilter === topic.tag ? 'border-[#c9a227] bg-[#c9a227]/18 text-[#f3d97f]' : 'border-white/10 text-white/45 hover:text-white hover:border-[#c9a227]/40'}`}
                  >
                    {topic.tag} <span className="text-white/35">{topic.count}</span>
                  </button>
                ))}
              </div>

              {rssItems.length + fbItems.length === 0 ? (
                <div className="border border-[#c9a227]/20 bg-[#2e2d1e] p-8 font-mono text-xs uppercase tracking-widest text-white/30">
                  Дані RSS ще оновлюються. Перевір через кілька хвилин.
                </div>
              ) : rssFeed.length === 0 ? (
                <div className="border border-[#c9a227]/20 bg-[#2e2d1e] p-8">
                  <p className="text-2xl font-black uppercase tracking-tight text-white">Нічого не знайдено</p>
                  <p className="mt-2 text-sm text-white/55 leading-relaxed">Спробуй очистити пошук або вибрати іншу тему. Фільтри працюють по перекладеному заголовку, опису, автору і тегам.</p>
                  <button type="button" onClick={() => { setRssSearch(''); setRssSourceFilter('all'); setRssTopicFilter('all'); }} className="mt-5 border border-[#c9a227]/40 px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-[#f3d97f] hover:bg-[#c9a227]/10 transition-colors">
                    Скинути фільтри
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                  {rssFeed.slice(0, 24).map((item, index) => (
                    <article
                      key={`${item.feedSource}-${item.id}`}
                      className={`${index === 0 ? 'lg:col-span-6 lg:row-span-2' : 'lg:col-span-3'} group relative overflow-hidden border border-[#c9a227]/18 bg-[#1c1c12] hover:border-[#c9a227]/55 transition-colors shadow-[0_14px_45px_rgba(0,0,0,0.24)]`}
                    >
                      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#c9a227] via-[#f3d97f] to-transparent opacity-60" />
                      <div className="p-5 md:p-6 flex min-h-full flex-col">
                        <div className="flex items-start justify-between gap-4 mb-5">
                          <div>
                            <p className="font-mono text-[9px] uppercase tracking-[0.24em] text-[#c9a227]/75">{item.sourceLabel}</p>
                            <p className="mt-1 font-mono text-[10px] tracking-wider text-white/38">@{item.handle || item.author}</p>
                          </div>
                          <span className="shrink-0 border border-[#c9a227]/22 bg-[#c9a227]/8 px-2 py-1 font-mono text-[9px] uppercase tracking-widest text-[#f3d97f]/80">
                            {formatRssDate(item.publishedAt)}
                          </span>
                        </div>
                        <h3 className={`${index === 0 ? 'text-2xl md:text-4xl' : 'text-xl md:text-2xl'} font-black tracking-tight mb-4 leading-[1.05] text-white group-hover:text-[#f3d97f] transition-colors`}>
                          {formatPreview(item.titleClean, index === 0 ? 230 : 150)}
                        </h3>
                        <p className={`${index === 0 ? 'text-base md:text-lg line-clamp-7' : 'text-[0.98rem] line-clamp-5'} font-semibold text-white/72 leading-relaxed mb-5`}>
                          {formatPreview(item.summaryClean, index === 0 ? 420 : 240)}
                        </p>
                        <div className="mt-auto">
                          <div className="flex flex-wrap gap-2 mb-4">
                            {item.tagsClean.slice(0, index === 0 ? 5 : 3).map(tag => (
                              <button
                                key={`${item.id}-${tag}`}
                                type="button"
                                onClick={() => setRssTopicFilter(tag)}
                                className="px-2.5 py-1 border border-[#c9a227]/20 font-mono text-[8px] uppercase tracking-widest text-[#c9a227]/62 hover:text-[#f3d97f] hover:border-[#c9a227]/50 transition-colors"
                              >
                                {tag}
                              </button>
                            ))}
                          </div>
                          <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-white/10">
                            <a href={item.url} target="_blank" rel="noreferrer"
                              className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-white/65 hover:text-[#c9a227] transition-colors">
                              Відкрити пост <ArrowUpRight className="w-3 h-3" />
                            </a>
                            <button
                              type="button"
                              onClick={() => shareLink(item.id, item.titleClean, item.url)}
                              className="font-mono text-[10px] uppercase tracking-widest text-white/45 hover:text-[#c9a227] transition-colors"
                            >
                              {sharedItemId === item.id ? 'Скопійовано' : 'Поділитися'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </motion.section>

          {/* Posts Feed */}
          <motion.section id="feed" variants={fadeIn} className="mb-32 scroll-mt-28">
            <div className="border-t border-[#c9a227]/30 pt-12 md:pt-16">
              <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5 border-b border-[#c9a227]/22 pb-7 mb-8 md:mb-10">
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#c9a227] mb-4 block">/ ПУБЛІКАЦІЇ КАНАЛУ</span>
                  <h2 className="text-4xl md:text-7xl font-bold tracking-tighter uppercase text-white leading-[0.88]">Стрічка Око Гора</h2>
                  <p className="mt-4 max-w-3xl text-base md:text-lg font-semibold leading-relaxed text-white/64">
                    Останні пости з Telegram-каналу: коротке превʼю, джерело внизу картки та швидка кнопка для поширення.
                  </p>
                </div>
                <a href="https://t.me/oko_gora" target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-2 self-start lg:self-auto border border-[#c9a227]/45 bg-[#c9a227]/10 px-4 py-3 font-mono text-[11px] uppercase tracking-widest text-[#f3d97f] hover:bg-[#c9a227]/16 hover:border-[#c9a227]/70 transition-colors">
                  Відкрити Telegram <ArrowUpRight className="w-3.5 h-3.5" />
                </a>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 md:gap-6">
                {posts.map((post, index) => {
                  const isLead = index === 0;
                  const postUrl = `/#/post/${post.id}`;
                  return (
                    <article
                      key={post.id}
                      className={`${isLead ? 'lg:col-span-6 lg:row-span-2' : 'lg:col-span-3'} group overflow-hidden border border-[#c9a227]/18 bg-[#1c1c12] hover:border-[#c9a227]/55 transition-colors shadow-[0_18px_55px_rgba(0,0,0,0.24)]`}
                    >
                      <Link to={`/post/${post.id}`} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c9a227]/80">
                        <div className={`${isLead ? 'aspect-[16/10] md:aspect-[21/10]' : 'aspect-[16/9]'} relative overflow-hidden bg-[#252519]`}>
                          {post.image ? (
                            <img
                              src={resolveImageUrl(post.image)}
                              alt={post.title}
                              loading="lazy"
                              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                              className="w-full h-full object-cover opacity-85 group-hover:opacity-100 group-hover:scale-[1.035] transition-all duration-700"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-[radial-gradient(circle_at_30%_20%,rgba(201,162,39,0.22),transparent_34%),linear-gradient(135deg,#2e2d1e,#10110d)]">
                              <img src="oko_logo.png" alt="" className="w-20 h-20 object-contain opacity-28" loading="lazy" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-[#0c0d10] via-[#0c0d10]/18 to-transparent" />
                          <div className="absolute left-4 top-4 flex flex-wrap items-center gap-2">
                            <span className="border border-[#c9a227]/45 bg-[#0c0d10]/72 px-2.5 py-1 font-mono text-[9px] uppercase tracking-widest text-[#f3d97f]">
                              {post.id}
                            </span>
                            <span className="border border-white/15 bg-[#0c0d10]/58 px-2.5 py-1 font-mono text-[9px] uppercase tracking-widest text-white/68">
                              {post.date}
                            </span>
                          </div>
                        </div>

                        <div className="p-5 md:p-6">
                          <div className="mb-4 flex items-center justify-between gap-4 font-mono text-[9px] uppercase tracking-[0.22em] text-white/36">
                            <span>Telegram / Око Гора</span>
                            <span>{(post.tags || []).slice(0, 1).map(tag => `#${tag}`).join(' ')}</span>
                          </div>
                          <h3 className={`${isLead ? 'text-3xl md:text-5xl' : 'text-[1.7rem] md:text-[2rem]'} font-black uppercase tracking-tight mb-4 group-hover:text-[#f3d97f] transition-colors leading-[1.02] text-white`}>
                            {post.title}
                          </h3>
                          <p className={`${isLead ? 'text-base md:text-lg line-clamp-7' : 'text-[1rem] line-clamp-5'} text-white/68 leading-relaxed mb-5 font-semibold`}>
                            {formatPreview(post.text, isLead ? 420 : 260)}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {(post.tags || []).slice(0, isLead ? 6 : 4).map(tag => (
                              <span key={tag} className="px-2.5 py-1 border border-[#c9a227]/20 font-mono text-[8px] tracking-widest uppercase text-[#c9a227]/64 group-hover:border-[#c9a227]/50 group-hover:text-[#f3d97f] transition-all">
                                #{tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      </Link>

                      <div className="mx-5 md:mx-6 mb-5 md:mb-6 flex flex-wrap items-center gap-3 border-t border-white/10 pt-4">
                        <button
                          type="button"
                          onClick={() => window.open(postTelegramUrl(post), '_blank', 'noopener,noreferrer')}
                          className="inline-flex min-h-11 items-center gap-1.5 border border-[#c9a227]/25 bg-[#c9a227]/8 px-3 py-2 font-mono text-[9px] uppercase tracking-widest text-white/62 hover:text-[#f3d97f] hover:border-[#c9a227]/55 hover:bg-[#c9a227]/12 transition-colors"
                        >
                          Джерело в Telegram <ArrowUpRight className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => shareLink(post.id, post.title, `${window.location.origin}${postUrl}`)}
                          className="inline-flex min-h-11 items-center border border-white/10 px-3 py-2 font-mono text-[9px] uppercase tracking-widest text-white/48 hover:text-[#f3d97f] hover:border-[#c9a227]/45 transition-colors"
                        >
                          {sharedItemId === post.id ? 'Скопійовано' : 'Поділитися з друзями'}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </motion.section>

        </motion.div>
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer id="contacts" className="relative overflow-hidden border-t border-[#c9a227]/30 px-4 md:px-8 py-12 md:py-20 bg-[#10110d] text-white scroll-mt-28">
        <div className="absolute inset-0 pointer-events-none opacity-35" style={{ backgroundImage: 'linear-gradient(rgba(201,162,39,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(201,162,39,0.08) 1px, transparent 1px)', backgroundSize: '42px 42px' }} />
        <div className="absolute -right-32 -bottom-32 w-[460px] h-[460px] rounded-full border border-[#c9a227]/15 pointer-events-none" />
        <div className="max-w-[1800px] mx-auto relative">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 md:gap-8 mb-8 md:mb-12">
            <div className="xl:col-span-5 border border-[#c9a227]/25 bg-[#1c1c12]/88 p-6 md:p-8">
              <div className="flex items-start gap-4 mb-7">
                <div className="w-12 h-12 md:w-14 md:h-14 border border-[#c9a227]/40 bg-[#c9a227]/10 flex items-center justify-center shrink-0">
                  <img src="oko_logo.png" alt="" className="w-8 h-8 md:w-10 md:h-10 object-contain opacity-90" loading="lazy" />
                </div>
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#c9a227]/75">/ ЦИФРОВА ПЛАТФОРМА КАНАЛУ</p>
                  <h3 className="mt-2 text-4xl md:text-6xl font-black tracking-tighter uppercase leading-[0.82] text-[#f3d97f]">
                    Око Гора
                  </h3>
                </div>
              </div>
              <p className="text-white/72 max-w-2xl text-base md:text-lg font-bold leading-relaxed">
                Це сайт Telegram-каналу «Око Гора - новини та аналітика». Тут зібрані пости, карта, RSS-джерела, статистика SBS, таблиця DeepState і посилання для перевірки.
              </p>
              <div className="grid grid-cols-2 gap-3 mt-7">
                {[
                  ['Оновлено SBS', sbsStats?.latestDate || 'очікується'],
                  ['DeepState рядків', deepstateRows.length],
                  ['RSS записів', rssItems.length + fbItems.length],
                  ['Подій 7 днів', dashboard.total],
                ].map(([label, value]) => (
                  <div key={label as string} className="border border-[#c9a227]/16 bg-[#252519]/70 p-3 md:p-4">
                    <p className="font-mono text-[8px] md:text-[9px] uppercase tracking-widest text-white/38">{label}</p>
                    <p className="mt-1 text-xl md:text-2xl font-black tracking-tighter text-white tabular-nums">{typeof value === 'number' ? formatNumber(value) : value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="xl:col-span-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="border border-[#c9a227]/20 bg-[#1c1c12]/72 p-5 md:p-6">
                <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#c9a227]/70 block mb-5">/ РОЗДІЛИ</span>
                <div className="grid grid-cols-1 gap-2 font-mono text-[11px] md:text-xs tracking-widest uppercase">
                  {[
                    ['Карта', 'map'],
                    ['Підрозділи', 'brigades'],
                    ['Аналітика ударів', 'analytics'],
                    ['SBS Stats', 'sbs'],
                    ['DeepState', 'deepstate'],
                    ['RSS', 'rss'],
                    ['Стрічка', 'feed'],
                  ].map(([label, id]) => (
                    <button key={id} type="button" onClick={() => openSection(id as SectionId)} className="flex items-center justify-between gap-3 border-b border-white/10 py-2 text-left text-white/58 hover:text-[#f3d97f] hover:border-[#c9a227]/40 transition-colors">
                      <span>{label}</span>
                      <ArrowUpRight className="w-3 h-3 opacity-45" />
                    </button>
                  ))}
                  <Link to="/targets" className="flex items-center justify-between gap-3 border-b border-white/10 py-2 text-left text-[#f3d97f] hover:border-[#c9a227]/40 transition-colors">
                    <span>База цілей</span>
                    <Target className="w-3 h-3" />
                  </Link>
                </div>
              </div>

              <div className="border border-[#c9a227]/20 bg-[#1c1c12]/72 p-5 md:p-6">
                <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#c9a227]/70 block mb-5">/ ДЖЕРЕЛА</span>
                <div className="space-y-3 font-mono text-[11px] md:text-xs tracking-widest uppercase">
                  {[
                    ['Telegram канал', 'https://t.me/oko_gora'],
                    ['X / Twitter', 'https://x.com/oko_gora_tg'],
                    ['SBS Stats', 'https://foosint.github.io/sbs-stats/'],
                    ['DeepState Table', 'https://deepstat.xyz/table'],
                  ].map(([label, href]) => (
                    <a key={href} href={href} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 border-b border-white/10 py-2 text-white/58 hover:text-[#f3d97f] hover:border-[#c9a227]/40 transition-colors">
                      <span>{label}</span>
                      <ArrowUpRight className="w-3 h-3 opacity-55" />
                    </a>
                  ))}
                </div>
              </div>
            </div>

            <div className="xl:col-span-3 border border-[#c9a227]/25 bg-[#c9a227]/10 p-5 md:p-6 flex flex-col justify-between gap-6">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#f3d97f]/80">/ CONTACT</p>
                <h4 className="mt-3 text-2xl md:text-3xl font-black uppercase leading-none">Слідкувати за оновленнями</h4>
                <p className="mt-4 text-sm md:text-base text-white/65 leading-relaxed font-medium">
                  Найшвидше оновлення, пояснення до мапи та нові розбори публікуються у Telegram.
                </p>
              </div>
              <div className="space-y-3">
                <a href="https://t.me/oko_gora" target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 bg-[#f3d97f] text-[#10110d] px-4 py-3 font-mono text-[11px] md:text-xs font-black uppercase tracking-widest hover:bg-white transition-colors">
                  Відкрити Telegram
                  <ArrowUpRight className="w-4 h-4" />
                </a>
                <button type="button" onClick={() => shareLink('footer-home', 'Око Гора', window.location.origin)} className="w-full flex items-center justify-between gap-3 border border-[#c9a227]/40 px-4 py-3 font-mono text-[11px] md:text-xs font-black uppercase tracking-widest text-[#f3d97f] hover:bg-[#c9a227]/12 transition-colors">
                  {sharedItemId === 'footer-home' ? 'Посилання скопійовано' : 'Поділитися сайтом'}
                  <ArrowUpRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="border-t border-[#c9a227]/12 pt-5 md:pt-6 flex flex-col lg:flex-row justify-between gap-4 font-mono text-[9px] md:text-[10px] tracking-[0.22em] text-white/34 uppercase">
            <div className="leading-relaxed">© {new Date().getFullYear()} OKO GORA. ЦИФРОВА ПЛАТФОРМА TELEGRAM-КАНАЛУ. ДАНІ З ВІДКРИТИХ ДЖЕРЕЛ.</div>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              <span>STATUS: ACTIVE</span>
              <span>SBS: {sbsStats?.latestDate || 'WAITING'}</span>
              <span>DEEPSTATE: {deepstateTable?.latest?.day ? `ROW ${deepstateTable.latest.day}` : 'WAITING'}</span>
              <span>VERSION: 3.1.0</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
