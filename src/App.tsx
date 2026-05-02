import { motion } from 'motion/react';
import { useState, useEffect, lazy, Suspense, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Radio, Activity, Database, Shield, Terminal, Rocket, Rss, Target } from 'lucide-react';
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

const STRIKE_KEYWORDS = ['знищено', 'уражено', 'ураження', 'влучання', 'strike', 'destroyed', 'hit', 'explosion', 'уражен', 'підбито', 'горить', 'вибух'];

function countStrikesFromRss(items: RssItem[]): number {
  const base = 482;
  const matched = items.filter(item => {
    const text = ((item.titleUk || item.title || '') + ' ' + (item.summaryUk || item.summary || '')).toLowerCase();
    return STRIKE_KEYWORDS.some(kw => text.includes(kw));
  }).length;
  return base + matched;
}

export default function App() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [rssItems, setRssItems] = useState<RssItem[]>([]);
  const [fbItems, setFbItems] = useState<RssItem[]>([]);
  const [investigations, setInvestigations] = useState<InvestigationArticle[]>([]);
  const [sharedItemId, setSharedItemId] = useState<string>('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setSeo({
      title: 'Стратегічний OSINT Монітор',
      description: 'Око Гора: OSINT-аналітика, аеророзвідка, інтерактивна мапа та розслідування відкритих джерел.',
      path: '/',
      type: 'website',
    });

    fetch('/data/posts.json')
      .then(r => r.json())
      .then((data: Post[]) => setPosts(normalizePosts(data)))
      .catch(() => setPosts([]));

    fetch(`/data/rss_twitter.json?t=${Date.now()}`)
      .then(r => r.json())
      .then(data => setRssItems(Array.isArray(data?.items) ? data.items : []))
      .catch(() => setRssItems([]));

    fetch(`/data/rss_facebook.json?t=${Date.now()}`)
      .then(r => r.json())
      .then(data => setFbItems(Array.isArray(data?.items) ? data.items : []))
      .catch(() => setFbItems([]));

    fetch(`/data/investigations.json?t=${Date.now()}`)
      .then(r => r.json())
      .then((data: InvestigationArticle[]) => setInvestigations(Array.isArray(data) ? data : []))
      .catch(() => setInvestigations([]));
  }, []);

  function formatRssDate(iso: string) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
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
    const dayMap = new Map<string, number>();
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date(now - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      days.push(key);
      dayMap.set(key, i);
    }

    type Event = {
      day: string;
      source: 'X' | 'Facebook' | 'Telegram';
      sourceName: string;
      text: string;
      type: 'Удари' | 'Логістика' | 'ППО/Авіа' | 'Море';
    };

    const pickType = (text: string): Event['type'] => {
      const t = text.toLowerCase();
      if (/(fleet|naval|морськ|black sea|sevastopol|порт)/i.test(t)) return 'Море';
      if (/(airbase|airfield|f-16|ппо|air defense|авіа|аеродром)/i.test(t)) return 'ППО/Авіа';
      if (/(logistics|нпз|refinery|depot|склад|rail|supply)/i.test(t)) return 'Логістика';
      return 'Удари';
    };

    const events: Event[] = [];
    for (const item of rssItems) {
      const ts = new Date(item.publishedAt).getTime();
      if (Number.isNaN(ts) || now - ts > 7 * 24 * 60 * 60 * 1000) continue;
      const day = new Date(ts).toISOString().slice(0, 10);
      if (!dayMap.has(day)) continue;
      const text = `${item.titleUk || item.title || ''} ${item.summaryUk || item.summary || ''}`;
      events.push({ day, source: 'X', sourceName: item.author || `@${item.handle || 'x'}`, text, type: pickType(text) });
    }
    for (const item of fbItems) {
      const ts = new Date(item.publishedAt).getTime();
      if (Number.isNaN(ts) || now - ts > 7 * 24 * 60 * 60 * 1000) continue;
      const day = new Date(ts).toISOString().slice(0, 10);
      if (!dayMap.has(day)) continue;
      const text = `${item.titleUk || item.title || ''} ${item.summaryUk || item.summary || ''}`;
      events.push({ day, source: 'Facebook', sourceName: item.author || `@${item.handle || 'fb'}`, text, type: pickType(text) });
    }
    for (const post of posts) {
      const ts = new Date(post.date).getTime();
      if (Number.isNaN(ts) || now - ts > 7 * 24 * 60 * 60 * 1000) continue;
      const day = new Date(ts).toISOString().slice(0, 10);
      if (!dayMap.has(day)) continue;
      const text = `${post.title || ''} ${post.text || ''}`;
      events.push({ day, source: 'Telegram', sourceName: 'Око Гора', text, type: pickType(text) });
    }

    const sources: Array<Event['source']> = ['X', 'Facebook', 'Telegram'];
    const byDaySource: Record<string, Record<Event['source'], number>> = {};
    const byTypeSource: Record<Event['type'], Record<Event['source'], number>> = {
      'Удари': { X: 0, Facebook: 0, Telegram: 0 },
      'Логістика': { X: 0, Facebook: 0, Telegram: 0 },
      'ППО/Авіа': { X: 0, Facebook: 0, Telegram: 0 },
      'Море': { X: 0, Facebook: 0, Telegram: 0 },
    };
    const topSourceMap = new Map<string, number>();
    for (const d of days) byDaySource[d] = { X: 0, Facebook: 0, Telegram: 0 };
    for (const e of events) {
      byDaySource[e.day][e.source] += 1;
      byTypeSource[e.type][e.source] += 1;
      topSourceMap.set(e.sourceName, (topSourceMap.get(e.sourceName) || 0) + 1);
    }

    const maxCell = Math.max(
      1,
      ...days.flatMap((d) => sources.map((s) => byDaySource[d][s])),
    );
    const topSources = Array.from(topSourceMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const trend = days.map((d) => ({
      day: d,
      total: sources.reduce((acc, s) => acc + byDaySource[d][s], 0),
    }));
    const maxTrend = Math.max(1, ...trend.map(t => t.total));

    return { days, sources, byDaySource, byTypeSource, maxCell, topSources, trend, maxTrend, total: events.length };
  }, [rssItems, fbItems, posts]);

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
            <a href="#map" className="hover:text-white transition-colors">Карта</a>
            <a href="#feed" className="hover:text-white transition-colors">Стрічка</a>
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
            <a href="#map" className="text-white/60 hover:text-[#c9a227] transition-colors py-1" onClick={() => setMobileMenuOpen(false)}>Карта</a>
            <a href="#feed" className="text-white/60 hover:text-[#c9a227] transition-colors py-1" onClick={() => setMobileMenuOpen(false)}>Стрічка</a>
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
          <motion.div variants={fadeIn} className="mb-16 md:mb-32 relative">
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
              <div className="ml-auto hidden md:block font-mono text-[9px] text-white/20 uppercase tracking-widest">
                СЛАВА_УКРАЇНІ // ГЕРОЯМ_СЛАВА
              </div>
            </div>

            <div id="map" className="grid grid-cols-1 lg:grid-cols-12 gap-8 border-t border-[#c9a227]/30 pt-8 md:pt-12 mt-12 md:mt-24 relative z-10">
              <div className="lg:col-span-5">
                <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#c9a227] mb-4 block">/ МІСІЯ</span>
                <p className="text-2xl md:text-4xl font-medium leading-[1.1] tracking-tight text-white">
                  Тотальний візуальний контроль. Аналітика бойового простору та оптична перевага.
                </p>
              </div>
              <div className="lg:col-start-8 lg:col-span-5">
                <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#c9a227] mb-4 block">/ ЕКОСИСТЕМA</span>
                <ul className="space-y-4 font-mono text-[10px] md:text-xs uppercase tracking-widest">
                  {[
                    { label: 'ПОВІТРЯНА РОЗВІДКА', n: '01' },
                    { label: 'КООРДИНАЦІЯ ТА ЦІЛЕВКАЗАННЯ', n: '02' },
                    { label: 'СИСТЕМИ ДАЛЕКОГО УРАЖЕННЯ', n: '03' },
                  ].map(item => (
                    <li key={item.n} className="flex justify-between border-b border-white/10 pb-2 hover:border-[#c9a227]/40 text-white/50 hover:text-white transition-all">
                      <span>{item.label}</span>
                      <span className="text-[#c9a227]">{item.n}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </motion.div>

          {/* Map */}
          <motion.div variants={fadeIn} className="mb-32 md:mb-48 w-full">
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
                  <p>[09:41:22] INCOMING SATELLITE PACKET: SENTINEL-2B</p>
                  <p>[09:41:25] DECRYPTING_GEOSPATIAL_LAYER...</p>
                  <p>[09:41:30] <span className="text-[#c9a227]">ANOMALY DETECTED: SECTOR G-14</span></p>
                  <p>[09:41:42] THERMAL_SIGNATURE_MATCH: T-90M</p>
                  <p>[09:41:55] BROADCASTING TO UNIT_7...</p>
                  <p className="animate-pulse text-[#c9a227]">_</p>
                </div>
                <div className="mt-8 pt-4 border-t border-[#c9a227]/10 flex justify-between opacity-30 text-[8px] uppercase tracking-widest">
                  <span>ШИФРУВАННЯ: AES-GCM</span>
                  <span>ВУЗОЛ: LVIV_PRIME</span>
                </div>
              </div>

              {/* Cards */}
              <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[#2e2d1e] border border-[#c9a227]/20 p-8 hover:border-[#c9a227]/60 hover:bg-[#363525] transition-all duration-500 group relative">
                  <Activity className="w-8 h-8 mb-6 text-[#c9a227]/40 group-hover:text-[#c9a227] transition-colors" />
                  <h4 className="text-2xl font-bold uppercase mb-2 tracking-tighter">SIGINT Аналізатор</h4>
                  <p className="text-sm text-white/50 leading-snug mb-8">Аналіз радіочастотного спектру та перехоплення сигналів зв'язку ворога в реальному часі.</p>
                  <div className="flex justify-between items-center font-mono text-[10px] tracking-widest pt-4 border-t border-white/10">
                    <span className="flex items-center gap-2 text-[#c9a227] animate-pulse"><Radio className="w-3 h-3" /> 424.000 MHZ</span>
                    <span className="text-white/30">ЗАШИФРОВАНО</span>
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
                  ЦІЛІСНІСТЬ_СИСТЕМИ_СТАБІЛЬНА // СИНХРОНІЗАЦІЯ_ХМАРИ_АКТИВНА
                </div>
              </div>
            </div>
          </motion.div>

          {/* Strike Analytics */}
          <motion.div variants={fadeIn} className="mb-32 md:mb-48">
            <div className="border-t border-[#c9a227]/30 pt-12 md:pt-24">
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end mb-16 gap-8">
                <div className="max-w-3xl">
                  <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#c9a227] mb-6 block">/ СТРАТЕГІЧНИЙ МОНІТОРИНГ</span>
                  <h2 className="text-5xl md:text-8xl font-bold tracking-tighter uppercase leading-[0.85] mb-4 text-white">
                    Аналітика <br />Ударів
                  </h2>
                </div>
                <div className="w-full lg:w-auto text-left lg:text-right bg-[#1c1c12] border border-[#c9a227]/20 p-8 lg:p-0 lg:bg-transparent lg:border-0">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-[#c9a227]/60 mb-3">/ Рахуємо разом</p>
                  <div className="text-7xl md:text-9xl font-bold tracking-tighter text-[#c9a227]">{countStrikesFromRss(rssItems)}</div>
                  <div className="font-mono text-[10px] uppercase tracking-widest mt-2 text-white/20">Всього підтверджених влучань</div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 md:gap-16">
                <div className="lg:col-span-7 bg-[#1c1c12] aspect-square md:aspect-video relative overflow-hidden group border border-[#c9a227]/10">
                  <img
                    src="missile_reach.png"
                    alt=""
                    className="w-full h-full object-cover opacity-50 grayscale group-hover:grayscale-0 transition-all duration-1000 scale-105 group-hover:scale-100"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#1c1c12] via-transparent to-transparent opacity-80" />
                  <div className="absolute bottom-8 left-8 right-8 flex justify-between items-center pointer-events-none">
                    <div className="font-mono text-[10px] text-white/50 space-y-1">
                      <p className="flex items-center gap-2 text-[#c9a227] font-bold uppercase">
                        <span className="w-2 h-2 bg-[#c9a227] rounded-full animate-ping" />
                        СТРАТЕГІЧНИЙ_ЗВ'ЯЗОК_АКТИВНИЙ
                      </p>
                      <p className="text-white/40">РАДІУС_МОНІТОРИНГУ: 1500 КМ</p>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-5 flex flex-col justify-between space-y-12">
                  <div className="space-y-10">
                    <div className="bg-[#2e2d1e] border border-[#c9a227]/20 p-8 md:p-12 relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-4 opacity-5">
                        <Rocket className="w-32 h-32 -rotate-12 text-[#c9a227]" />
                      </div>
                      <span className="font-mono text-[10px] uppercase tracking-widest text-[#c9a227] mb-8 block">/ Ракетна програма</span>
                      <div className="space-y-8">
                        {[
                          { name: 'Паляниця (Реактивний дрон)', progress: 85, dist: '750км' },
                          { name: 'Нептун (Модернізація R-360)', progress: 95, dist: '400км' },
                          { name: 'Дальні БПЛА (Бобер/Лютий)', progress: 100, dist: '1200км' },
                        ].map(m => (
                          <div key={m.name} className="space-y-3">
                            <div className="flex justify-between font-mono text-[10px] uppercase tracking-tighter">
                              <span className="font-bold text-white">{m.name}</span>
                              <span className="text-[#c9a227]">{m.dist}</span>
                            </div>
                            <div className="h-1.5 w-full bg-white/5 overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${m.progress}%` }}
                                transition={{ duration: 1.5, delay: 0.5 }}
                                className="h-full bg-[#c9a227]"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-px bg-[#c9a227]/10">
                      <div className="bg-[#2e2d1e] p-8 text-center">
                        <div className="text-4xl md:text-5xl font-bold mb-2 tracking-tighter text-white">124</div>
                        <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#c9a227]/60">НПЗ / Резервуари</div>
                      </div>
                      <div className="bg-[#2e2d1e] p-8 text-center">
                        <div className="text-4xl md:text-5xl font-bold mb-2 tracking-tighter text-white">42</div>
                        <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#c9a227]/60">Авіабази / Склади</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* 7D Dashboard */}
          <motion.section variants={fadeIn} className="mb-32 md:mb-48">
            <div className="border-t border-[#c9a227]/30 pt-12 md:pt-16">
              <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-10">
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#c9a227] mb-4 block">/ OSINT DASHBOARD</span>
                  <h2 className="text-4xl md:text-6xl font-bold tracking-tighter uppercase leading-[0.9]">Активність оф. джерел за 7 днів</h2>
                  <p className="mt-4 text-white/50 max-w-3xl text-sm">X, Facebook і Telegram в єдиному огляді: інтенсивність, матриця типів та джерел, пікові дні.</p>
                </div>
                <div className="bg-[#1c1c12] border border-[#c9a227]/20 px-6 py-5">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-[#c9a227]/70">Загалом подій (7 днів)</p>
                  <p className="text-5xl font-bold tracking-tighter text-white">{dashboard.total}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                <div className="xl:col-span-7 bg-[#1c1c12] border border-[#c9a227]/20 p-6 md:p-8">
                  <h3 className="font-mono text-[10px] uppercase tracking-widest text-[#c9a227]/70 mb-4">Heatmap · День × Джерело</h3>
                  <div className="space-y-2">
                    {dashboard.days.map((day) => (
                      <div key={day} className="grid grid-cols-[70px_repeat(3,minmax(0,1fr))] gap-2 items-center">
                        <span className="font-mono text-[10px] text-white/35 uppercase">{day.slice(5)}</span>
                        {dashboard.sources.map((src) => {
                          const value = dashboard.byDaySource[day][src];
                          const alpha = value === 0 ? 0.06 : 0.18 + (value / dashboard.maxCell) * 0.82;
                          return (
                            <div key={`${day}-${src}`} className="h-8 border border-[#c9a227]/20 flex items-center justify-between px-2" style={{ backgroundColor: `rgba(201,162,39,${alpha})` }}>
                              <span className="font-mono text-[9px] uppercase text-white/70">{src}</span>
                              <span className="font-mono text-[10px] font-bold text-white">{value}</span>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="xl:col-span-5 bg-[#2e2d1e] border border-[#c9a227]/20 p-6 md:p-8">
                  <h3 className="font-mono text-[10px] uppercase tracking-widest text-[#c9a227]/70 mb-4">Тренд · День</h3>
                  <div className="space-y-2">
                    {dashboard.trend.map((t) => (
                      <div key={t.day} className="flex items-center gap-3">
                        <span className="font-mono text-[10px] text-white/35 w-14">{t.day.slice(5)}</span>
                        <div className="h-3 bg-[#c9a227] transition-all" style={{ width: `${Math.max(6, (t.total / dashboard.maxTrend) * 100)}%` }} />
                        <span className="font-mono text-[10px] text-white/75">{t.total}</span>
                      </div>
                    ))}
                  </div>
                  <h3 className="font-mono text-[10px] uppercase tracking-widest text-[#c9a227]/70 mt-8 mb-3">Топ-джерела</h3>
                  <div className="space-y-2">
                    {dashboard.topSources.map(([name, count]) => (
                      <div key={name} className="flex items-center justify-between border-b border-white/10 pb-1">
                        <span className="text-white/70 text-sm truncate">{name}</span>
                        <span className="font-mono text-[10px] text-[#c9a227]">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-6 bg-[#1c1c12] border border-[#c9a227]/20 p-6 md:p-8">
                <h3 className="font-mono text-[10px] uppercase tracking-widest text-[#c9a227]/70 mb-4">Matrix · Тип події × Джерело</h3>
                <div className="grid grid-cols-[180px_repeat(3,minmax(0,1fr))] gap-2">
                  <div />
                  {dashboard.sources.map((src) => (
                    <div key={src} className="font-mono text-[10px] uppercase text-white/45">{src}</div>
                  ))}
                  {(Object.keys(dashboard.byTypeSource) as Array<keyof typeof dashboard.byTypeSource>).map((typeKey) => (
                    <div key={typeKey} className="contents">
                      <div className="font-mono text-[10px] uppercase text-white/65 border border-white/10 px-3 py-2">{typeKey}</div>
                      {dashboard.sources.map((src) => {
                        const value = dashboard.byTypeSource[typeKey][src];
                        const alpha = value === 0 ? 0.04 : 0.2 + Math.min(0.8, value / 14);
                        return (
                          <div key={`${typeKey}-${src}`} className="border border-[#c9a227]/20 px-3 py-2 font-mono text-sm font-bold text-white" style={{ backgroundColor: `rgba(201,162,39,${alpha})` }}>
                            {value}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.section>

          {/* Interactive Investigations */}
          <motion.section variants={fadeIn} className="mb-32 md:mb-48">
            <div className="border-t border-[#c9a227]/30 pt-12 md:pt-16">
              <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-10">
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#c9a227] mb-4 block">/ НОВИЙ РОЗДІЛ</span>
                  <h2 className="text-4xl md:text-6xl font-bold tracking-tighter uppercase leading-[0.9]">Інтерактивні розслідування</h2>
                </div>
                <a href="https://t.me/oko_gora" target="_blank" rel="noreferrer"
                  className="font-mono text-xs uppercase tracking-widest text-white/30 hover:text-[#c9a227] transition-colors">
                  Публічний фід доказів <ArrowUpRight className="inline w-3 h-3 ml-1" />
                </a>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {(investigations.length ? investigations.filter(i => (i.status || 'published') === 'published') : [
                  { id: 'fallback-1', title: 'Ланцюг подій', summary: "Покрокова реконструкція інцидентів за часом, географією та джерелами.", code: 'CASEFLOW', tags: [], publishedAt: '', status: 'published' as const },
                  { id: 'fallback-2', title: 'Гео-докази', summary: "Прив’язка кадрів до координат, об’єктів інфраструктури та супутникових шарів.", code: 'GEO-TRACE', tags: [], publishedAt: '', status: 'published' as const },
                  { id: 'fallback-3', title: 'Порівняння версій', summary: "Зіставлення заяв, медіа та фактичних змін на місцевості з маркерами довіри.", code: 'EVIDENCE-DELTA', tags: [], publishedAt: '', status: 'published' as const },
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

          {/* RSS / X feed */}
          <motion.section variants={fadeIn} className="mb-32 md:mb-48">
            <div className="border-t border-[#c9a227]/30 pt-12 md:pt-16">
              <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-10">
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#c9a227] mb-4 block">/ LIVE RSS</span>
                  <h2 className="text-4xl md:text-6xl font-bold tracking-tighter uppercase leading-[0.9]">RSS пости з X: OSINT/HUMINT</h2>
                  <p className="mt-4 text-white/50 max-w-3xl text-sm">
                    Автоматична вибірка за останні 3 дні по темах, пов'язаних з Україною, з фокусом на іноземних OSINT/HUMINT авторів.
                  </p>
                </div>
                <a href="https://x.com" target="_blank" rel="noreferrer"
                  className="font-mono text-xs uppercase tracking-widest text-white/30 hover:text-[#c9a227] transition-colors shrink-0">
                  Джерела X / Twitter <ArrowUpRight className="inline w-3 h-3 ml-1" />
                </a>
              </div>

              {rssItems.length === 0 ? (
                <div className="border border-[#c9a227]/20 bg-[#2e2d1e] p-8 font-mono text-xs uppercase tracking-widest text-white/30">
                  Дані RSS ще оновлюються. Перевір через кілька хвилин.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {rssItems.slice(0, 18).map(item => (
                    <article key={item.id} className="bg-[#2e2d1e] border border-[#c9a227]/15 p-6 hover:border-[#c9a227]/45 transition-colors">
                      <div className="flex items-center justify-between mb-4">
                        <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#c9a227]/60">{item.author}</p>
                        <Rss className="w-3.5 h-3.5 text-[#c9a227]/30" />
                      </div>
                      <h3 className="text-[1.65rem] font-extrabold tracking-tight mb-3 leading-[1.14] text-white">
                        {formatPreview(cleanRssText(item.titleUk || item.title || ''), 175)}
                      </h3>
                      <p className="text-[1rem] font-medium text-white/55 leading-relaxed mb-4 line-clamp-5">
                        {formatPreview(cleanRssText(item.summaryUk || item.summary || ''), 260)}
                      </p>
                      <div className="font-mono text-[9px] uppercase tracking-widest text-white/25 mb-4">
                        @{item.handle} · {formatRssDate(item.publishedAt)}
                      </div>
                      <div className="flex flex-wrap gap-2 mb-4">
                        {(item.tags || ['OSINT', 'HUMINT', 'UKRAINE']).slice(0, 3).map(tag => (
                          <span key={`${item.id}-${tag}`} className="px-2 py-1 border border-[#c9a227]/20 font-mono text-[8px] uppercase tracking-widest text-[#c9a227]/60">
                            {tag}
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center gap-4">
                        <a href={item.url} target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-white/30 hover:text-[#c9a227] transition-colors">
                          Відкрити пост <ArrowUpRight className="w-3 h-3" />
                        </a>
                        <button
                          type="button"
                          onClick={() => shareLink(item.id, cleanRssText(item.titleUk || item.title || ''), item.url)}
                          className="font-mono text-[10px] uppercase tracking-widest text-white/25 hover:text-[#c9a227] transition-colors"
                        >
                          {sharedItemId === item.id ? 'Скопійовано' : 'Поділитися'}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </motion.section>

          {/* Posts Feed */}
          <motion.div id="feed" variants={fadeIn} className="mb-32">
            <div className="flex justify-between items-end border-b border-[#c9a227]/30 pb-6 mb-12">
              <h2 className="text-4xl md:text-7xl font-bold tracking-tighter uppercase text-white">Стрічка</h2>
              <a href="https://t.me/oko_gora" target="_blank" rel="noreferrer"
                className="font-mono text-xs tracking-widest uppercase text-white/30 hover:text-[#c9a227] transition-colors flex items-center gap-1">
                Всі публікації <ArrowUpRight className="w-3 h-3" />
              </a>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-24">
              {posts.map(post => (
                <Link key={post.id} to={`/post/${post.id}`} className="group block">
                  <div className="aspect-[16/9] w-full overflow-hidden bg-[#2e2d1e] mb-6 relative border border-[#c9a227]/10 group-hover:border-[#c9a227]/30 transition-colors">
                    {post.image && (
                      <img
                        src={resolveImageUrl(post.image)}
                        alt={post.title}
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-1000"
                      />
                    )}
                    <div className="absolute inset-0 bg-[#252519]/20 group-hover:bg-transparent transition-colors" />
                  </div>
                  <div className="flex gap-4 mb-4 font-mono text-[9px] tracking-[0.2em] uppercase text-white/30">
                    <span className="font-bold text-[#c9a227]/70">{post.id}</span>
                    <span>{post.date}</span>
                  </div>
                  <h3 className="text-[2rem] md:text-[2.2rem] font-extrabold uppercase tracking-tight mb-4 group-hover:text-[#c9a227] transition-colors leading-[1.03]">
                    {post.title}
                  </h3>
                  <p className="text-white/55 leading-relaxed mb-6 text-[1rem] md:text-[1.08rem] font-medium line-clamp-5">
                    {formatPreview(post.text, 240)}
                  </p>
                  <div className="flex items-center gap-4 mb-5">
                    <button
                      type="button"
                      onClick={e => { e.preventDefault(); window.open(postTelegramUrl(post), '_blank', 'noopener,noreferrer'); }}
                      className="inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-widest text-white/25 hover:text-[#c9a227] transition-colors"
                    >
                      Джерело в Telegram <ArrowUpRight className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={e => { e.preventDefault(); shareLink(post.id, post.title, `${window.location.origin}/#/post/${post.id}`); }}
                      className="font-mono text-[9px] uppercase tracking-widest text-white/25 hover:text-[#c9a227] transition-colors"
                    >
                      {sharedItemId === post.id ? 'Скопійовано' : 'Поділитися'}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {post.tags.map(tag => (
                      <span key={tag} className="px-3 py-1 border border-[#c9a227]/20 font-mono text-[9px] tracking-widest uppercase text-[#c9a227]/50 group-hover:border-[#c9a227]/50 group-hover:text-[#c9a227]/80 transition-all">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </Link>
              ))}
            </div>
          </motion.div>

        </motion.div>
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-[#c9a227]/30 px-4 md:px-8 py-20 md:py-40 bg-[#1c1c12] text-white">
        <div className="max-w-[1800px] mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-16 mb-32">
            <div className="md:col-span-6">
              <h3 className="text-5xl md:text-8xl font-bold tracking-tighter uppercase mb-8 leading-[0.85] text-[#c9a227]">
                Око Гора
              </h3>
              <p className="text-white/30 max-w-md font-mono text-xs md:text-sm leading-relaxed">
                Незалежний ресурс з моніторингу, аеророзвідки та стратегічної аналітики бойового простору. Побудовано для тих, хто бачить далі горизонту.
              </p>
            </div>

            <div className="md:col-start-8 md:col-span-2 space-y-4">
              <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#c9a227]/50 block mb-8">/ НАВІГАЦІЯ</span>
              <ul className="space-y-4 font-mono text-xs tracking-widest uppercase text-white/40">
                <li><Link to="/targets" className="hover:text-[#c9a227] transition-colors flex items-center gap-2"><Target className="w-3 h-3" />БАЗА ЦІЛЕЙ</Link></li>
                <li><a href="#" className="hover:text-[#c9a227] transition-colors">МЕТОДОЛОГІЯ</a></li>
                <li><a href="#" className="hover:text-[#c9a227] transition-colors">АРХІВ УДАРІВ</a></li>
                <li><a href="#" className="hover:text-[#c9a227] transition-colors">КОНТАКТИ</a></li>
              </ul>
            </div>

            <div className="md:col-span-3 space-y-4 text-right">
              <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#c9a227]/50 block mb-8">/ ПРИЄДНАТИСЬ</span>
              <ul className="space-y-4 font-mono text-xs tracking-widest uppercase">
                <li>
                  <a href="https://t.me/oko_gora" target="_blank" rel="noreferrer"
                    className="flex items-center justify-end gap-2 text-white/50 hover:text-[#c9a227] transition-colors">
                    ТЕЛЕГРАМ КАНАЛ <ArrowUpRight className="w-4 h-4" />
                  </a>
                </li>
                <li>
                  <a href="https://x.com/oko_gora_tg" target="_blank" rel="noreferrer"
                    className="flex items-center justify-end gap-2 text-white/50 hover:text-[#c9a227] transition-colors font-bold">
                    X (TWITTER) РОЗВІДКА <ArrowUpRight className="w-4 h-4" />
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-[#c9a227]/10 flex flex-col md:flex-row justify-between items-center font-mono text-[9px] tracking-[0.3em] text-white/15 uppercase">
            <div>© {new Date().getFullYear()} OKO GORA GROUP. ВСІ ДАНІ ЗАШИФРОВАНІ.</div>
            <div className="mt-4 md:mt-0 flex gap-8">
              <span>СТАТУС: АКТИВНО</span>
              <span>ВЕРСІЯ: 3.0.0-STABLE</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
