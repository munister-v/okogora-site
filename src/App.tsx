import { motion } from 'motion/react';
import { useState, useEffect, lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Radio, Activity, Database, Shield, Terminal, Layers, UploadCloud, Rocket, Navigation, Rss, Target } from 'lucide-react';
import { Post } from './types';
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

export default function App() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [rssItems, setRssItems] = useState<RssItem[]>([]);

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
  }, []);

  function formatRssDate(iso: string) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('uk-UA', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div className="min-h-screen bg-[#252519] text-white selection:bg-[#c9a227] selection:text-[#1c1c12] font-sans overflow-x-hidden">

      {/* ── Navigation ─────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-[1000] border-b border-[#c9a227]/20 bg-[#252519]/95 backdrop-blur-md">
        <div className="grid grid-cols-2 md:grid-cols-4 px-4 md:px-8 py-3 md:py-4 text-[10px] md:text-xs font-mono uppercase tracking-widest items-center">
          <div className="col-span-1 flex items-center gap-2">
            <div className="w-4 h-4 bg-[#c9a227] rounded-sm flex items-center justify-center">
              <div className="w-1.5 h-1.5 bg-[#252519] rounded-sm animate-pulse" />
            </div>
            <span className="font-bold tracking-tighter text-white">ОКО ГОРА</span>
          </div>
          <div className="hidden md:block col-span-2 text-center text-white/30">
            СТРАТЕГІЧНИЙ_OSINT_МОНІТОР_V3.0_UA
          </div>
          <div className="col-span-1 flex justify-end items-center gap-4">
            <Link to="/targets" className="hidden md:flex items-center gap-1 text-[#c9a227] hover:text-white transition-colors font-bold">
              <Target className="w-3 h-3" /> БАЗА ЦІЛЕЙ
            </Link>
            <a href="https://t.me/oko_gora" target="_blank" rel="noreferrer"
              className="hover:text-[#c9a227] transition-colors flex items-center gap-1 font-bold">
              ТЕЛЕГРАМ <ArrowUpRight className="w-3 h-3" />
            </a>
          </div>
        </div>
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

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 border-t border-[#c9a227]/30 pt-8 md:pt-12 mt-12 md:mt-24 relative z-10">
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
                  <div className="text-7xl md:text-9xl font-bold tracking-tighter text-[#c9a227]">482</div>
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

          {/* Community Cards */}
          <motion.div variants={fadeIn} className="mb-32 md:mb-48 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
            <div className="bg-[#1c1c12] border border-[#c9a227]/20 text-white p-10 md:p-16 flex flex-col justify-between group cursor-pointer hover:border-[#c9a227]/50 transition-all">
              <div>
                <UploadCloud className="w-12 h-12 mb-10 text-[#c9a227]/30 group-hover:text-[#c9a227] transition-colors" />
                <h3 className="text-3xl md:text-5xl font-bold uppercase tracking-tighter mb-6 leading-[0.9]">Передача <br /> даних</h3>
                <p className="text-white/40 font-mono text-[10px] md:text-xs leading-relaxed max-w-sm">
                  Захищений шлюз для збору координат, фото та відео з окупованих територій. Повна анонімність гарантована.
                </p>
              </div>
              <div className="mt-12 flex justify-between items-center font-mono text-[10px] uppercase tracking-widest text-[#c9a227]/30 group-hover:text-[#c9a227]/60 transition-colors">
                <span>РІВЕНЬ_БЕЗПЕКИ: ВИСОКИЙ</span>
                <ArrowUpRight className="w-4 h-4" />
              </div>
            </div>

            <div className="bg-[#2e2d1e] border border-[#c9a227]/20 p-10 md:p-16 flex flex-col justify-between group cursor-pointer hover:border-[#c9a227]/50 transition-all">
              <div>
                <Layers className="w-12 h-12 mb-10 text-[#c9a227]/30 group-hover:text-[#c9a227] transition-colors" />
                <h3 className="text-3xl md:text-5xl font-bold uppercase tracking-tighter mb-6 leading-[0.9]">Архів та <br /> Аналіз</h3>
                <p className="text-white/40 font-mono text-[10px] md:text-xs leading-relaxed max-w-sm">
                  Доступ до детальної бази даних подій. Пошук за датою, типом техніки або сектором.
                </p>
              </div>
              <ul className="mt-12 space-y-2 font-mono text-[9px] md:text-[10px] tracking-widest text-[#c9a227]/40 uppercase">
                <li className="flex items-center gap-2"><Navigation className="w-3 h-3" /> Геолокація об'єктів</li>
                <li className="flex items-center gap-2"><Activity className="w-3 h-3" /> Статистика втрат</li>
              </ul>
            </div>
          </motion.div>

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
                {[
                  { title: 'Ланцюг подій', text: "Покрокова реконструкція інцидентів за часом, географією та джерелами.", code: 'CASEFLOW' },
                  { title: 'Гео-докази', text: "Прив’язка кадрів до координат, об’єктів інфраструктури та супутникових шарів.", code: 'GEO-TRACE' },
                  { title: 'Порівняння версій', text: "Зіставлення заяв, медіа та фактичних змін на місцевості з маркерами довіри.", code: 'EVIDENCE-DELTA' },
                ].map(item => (
                  <article key={item.code} className="bg-[#2e2d1e] border border-[#c9a227]/20 p-6 md:p-8 hover:border-[#c9a227]/50 transition-colors">
                    <p className="font-mono text-[9px] uppercase tracking-[0.25em] text-[#c9a227] mb-4">{item.code}</p>
                    <h3 className="text-2xl font-bold tracking-tight uppercase mb-4 text-white">{item.title}</h3>
                    <p className="text-white/50 text-sm leading-relaxed">{item.text}</p>
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
                      <h3 className="text-xl font-bold tracking-tight mb-3 leading-tight text-white">{item.titleUk || item.title}</h3>
                      <p className="text-sm text-white/50 leading-relaxed mb-4 line-clamp-4">{formatPreview(item.summaryUk || item.summary || '', 220)}</p>
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
                      <a href={item.url} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-white/30 hover:text-[#c9a227] transition-colors">
                        Відкрити пост <ArrowUpRight className="w-3 h-3" />
                      </a>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </motion.section>

          {/* Posts Feed */}
          <motion.div variants={fadeIn} className="mb-32">
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
                  <h3 className="text-2xl md:text-3xl font-bold uppercase tracking-tight mb-4 group-hover:text-[#c9a227] transition-colors">
                    {post.title}
                  </h3>
                  <p className="text-white/50 leading-relaxed mb-6 text-sm md:text-base line-clamp-4">
                    {formatPreview(post.text, 240)}
                  </p>
                  <button
                    type="button"
                    onClick={e => { e.preventDefault(); window.open(postTelegramUrl(post), '_blank', 'noopener,noreferrer'); }}
                    className="inline-flex items-center gap-1.5 mb-5 font-mono text-[9px] uppercase tracking-widest text-white/25 hover:text-[#c9a227] transition-colors"
                  >
                    Джерело в Telegram <ArrowUpRight className="w-3 h-3" />
                  </button>
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
