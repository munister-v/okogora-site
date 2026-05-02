import { useState, useEffect, lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowUpRight, ArrowLeft, Search, Filter, MapPin, Zap, AlertTriangle, CheckCircle, XCircle, BarChart2 } from 'lucide-react';

const TargetMap = lazy(() => import('../components/TargetMap'));

export interface Target {
  id: string;
  name: string;
  type: string;
  lat: number;
  lng: number;
  region: string;
  capacity?: string;
  status: 'active' | 'damaged' | 'destroyed';
  priority: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  owner?: string;
  unit?: string;
  coords_precise?: string;
  strike_history?: string;
}

const TYPE_LABELS: Record<string, string> = {
  npz: 'НПЗ / Нафтопереробка',
  airbase: 'Авіабаза',
  navy: 'ВМБ / Флот',
  ammo: 'Склад боєприпасів',
  radar: 'РЛС / СПРН',
  military: 'Військовий об\'єкт',
  logistics: 'Логістика / Транспорт',
  energy: 'Енергетика / АЕС',
  industry: 'ВПК / Промисловість',
};

const STATUS_META = {
  active:    { label: 'АКТИВНИЙ',   color: 'text-red-500',    bg: 'bg-red-500/10',    dot: 'bg-red-500',    icon: AlertTriangle },
  damaged:   { label: 'ПОШКОДЖЕНО', color: 'text-yellow-500', bg: 'bg-yellow-500/10', dot: 'bg-yellow-400', icon: Zap },
  destroyed: { label: 'ЗНИЩЕНО',    color: 'text-green-500',  bg: 'bg-green-500/10',  dot: 'bg-green-500',  icon: CheckCircle },
};

const PRIORITY_META = {
  critical: { label: 'КРИТИЧНИЙ', badge: 'border-red-500/60 text-red-500' },
  high:     { label: 'ВИСОКИЙ',   badge: 'border-orange-400/60 text-orange-400' },
  medium:   { label: 'СЕРЕДНІЙ',  badge: 'border-yellow-400/60 text-yellow-400' },
  low:      { label: 'НИЗЬКИЙ',   badge: 'border-white/20 text-white/40' },
};

type FilterType = 'all' | string;
type FilterStatus = 'all' | 'active' | 'damaged' | 'destroyed';
type FilterPriority = 'all' | 'critical' | 'high' | 'medium';

export default function TargetsPage() {
  const [targets, setTargets] = useState<Target[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [filterPriority, setFilterPriority] = useState<FilterPriority>('all');
  const [selected, setSelected] = useState<Target | null>(null);
  const [view, setView] = useState<'list' | 'map'>('list');

  useEffect(() => {
    fetch('/data/targets.json')
      .then(r => r.json())
      .then((d: Target[]) => { setTargets(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = targets.filter(t => {
    const q = search.toLowerCase();
    if (q && !t.name.toLowerCase().includes(q) && !t.region.toLowerCase().includes(q) && !t.description.toLowerCase().includes(q)) return false;
    if (filterType !== 'all' && t.type !== filterType) return false;
    if (filterStatus !== 'all' && t.status !== filterStatus) return false;
    if (filterPriority !== 'all' && t.priority !== filterPriority) return false;
    return true;
  });

  const stats = {
    total: targets.length,
    active: targets.filter(t => t.status === 'active').length,
    damaged: targets.filter(t => t.status === 'damaged').length,
    destroyed: targets.filter(t => t.status === 'destroyed').length,
    critical: targets.filter(t => t.priority === 'critical').length,
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#f4f4f4] selection:bg-[#f4f4f4] selection:text-[#0a0a0a]">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-[1000] border-b border-white/10 bg-[#0a0a0a]/90 backdrop-blur-md">
        <div className="grid grid-cols-2 md:grid-cols-4 px-4 md:px-8 py-3 md:py-4 text-[10px] md:text-xs font-mono uppercase tracking-widest items-center">
          <div className="col-span-1 flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2 hover:opacity-60 transition-opacity">
              <ArrowLeft className="w-3 h-3" />
            </Link>
            <div className="w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
              <div className="w-1.5 h-1.5 bg-[#0a0a0a] rounded-full animate-pulse" />
            </div>
            <Link to="/" className="font-bold tracking-tighter hover:opacity-60 transition-opacity">ОКО ГОРА</Link>
          </div>
          <div className="hidden md:block col-span-2 text-center text-white/30">
            БАЗА_ЦІЛЕЙ // РОСІЯ // КЛАСИФІКОВАНО
          </div>
          <div className="col-span-1 flex justify-end">
            <a href="https://t.me/oko_gora" target="_blank" rel="noreferrer"
              className="hover:opacity-60 transition-opacity flex items-center gap-1 font-bold">
              ТЕЛЕГРАМ <ArrowUpRight className="w-3 h-3" />
            </a>
          </div>
        </div>
      </nav>

      <main className="pt-24 pb-24 px-4 md:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-[1400px] mx-auto mb-16"
        >
          <div className="border-b border-white/10 pb-12 mb-12">
            <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-red-500/70 mb-6 block">
              / СТРАТЕГІЧНА БАЗА ДАНИХ
            </span>
            <h1 className="text-5xl md:text-8xl font-bold tracking-tighter uppercase leading-[0.85] mb-8">
              База<br />Цілей
            </h1>
            <p className="text-white/40 font-mono text-xs md:text-sm max-w-2xl leading-relaxed">
              Каталог критичної інфраструктури Росії — НПЗ, авіабази, склади боєприпасів, об'єкти ВПК та логістичні вузли.
              Координати, описи, статус ураження.
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-12">
            {[
              { label: 'ВСЬОГО ОБ\'ЄКТІВ', val: stats.total, color: 'text-white' },
              { label: 'АКТИВНИХ', val: stats.active, color: 'text-red-400' },
              { label: 'ПОШКОДЖЕНО', val: stats.damaged, color: 'text-yellow-400' },
              { label: 'ЗНИЩЕНО', val: stats.destroyed, color: 'text-green-400' },
              { label: 'КРИТИЧНИХ', val: stats.critical, color: 'text-red-500' },
            ].map(s => (
              <div key={s.label} className="border border-white/10 p-6">
                <div className={`text-3xl md:text-4xl font-bold tracking-tighter mb-2 ${s.color}`}>{s.val}</div>
                <div className="font-mono text-[9px] uppercase tracking-widest text-white/30">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4 mb-8">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
              <input
                type="text"
                placeholder="Пошук за назвою, регіоном..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-white/5 border border-white/10 pl-9 pr-4 py-2.5 font-mono text-xs text-white/80 placeholder-white/20 focus:outline-none focus:border-white/30 tracking-wider"
              />
            </div>

            {/* Type filter */}
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              className="bg-white/5 border border-white/10 px-4 py-2.5 font-mono text-xs text-white/60 focus:outline-none focus:border-white/30 tracking-wider"
            >
              <option value="all">ВСІ ТИПИ</option>
              {Object.entries(TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v.toUpperCase()}</option>
              ))}
            </select>

            {/* Status filter */}
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value as FilterStatus)}
              className="bg-white/5 border border-white/10 px-4 py-2.5 font-mono text-xs text-white/60 focus:outline-none focus:border-white/30 tracking-wider"
            >
              <option value="all">БУДЬ-ЯКИЙ СТАТУС</option>
              <option value="active">АКТИВНІ</option>
              <option value="damaged">ПОШКОДЖЕНІ</option>
              <option value="destroyed">ЗНИЩЕНІ</option>
            </select>

            {/* Priority filter */}
            <select
              value={filterPriority}
              onChange={e => setFilterPriority(e.target.value as FilterPriority)}
              className="bg-white/5 border border-white/10 px-4 py-2.5 font-mono text-xs text-white/60 focus:outline-none focus:border-white/30 tracking-wider"
            >
              <option value="all">БУДЬ-ЯКИЙ ПРІОРИТЕТ</option>
              <option value="critical">КРИТИЧНИЙ</option>
              <option value="high">ВИСОКИЙ</option>
              <option value="medium">СЕРЕДНІЙ</option>
            </select>

            {/* View toggle */}
            <div className="flex border border-white/10">
              <button
                onClick={() => setView('list')}
                className={`px-4 py-2.5 font-mono text-[10px] uppercase tracking-widest transition-colors ${view === 'list' ? 'bg-white/10 text-white' : 'text-white/30 hover:text-white/60'}`}
              >
                СПИСОК
              </button>
              <button
                onClick={() => setView('map')}
                className={`px-4 py-2.5 font-mono text-[10px] uppercase tracking-widest transition-colors ${view === 'map' ? 'bg-white/10 text-white' : 'text-white/30 hover:text-white/60'}`}
              >
                КАРТА
              </button>
            </div>
          </div>

          <div className="font-mono text-[10px] text-white/20 uppercase tracking-widest mb-8">
            <Filter className="w-3 h-3 inline mr-2" />
            {filtered.length} об'єктів з {targets.length}
          </div>
        </motion.div>

        {/* Map view */}
        {view === 'map' && (
          <div className="max-w-[1400px] mx-auto mb-16">
            <Suspense fallback={
              <div className="w-full h-[600px] bg-white/5 border border-white/10 flex items-center justify-center">
                <span className="font-mono text-[10px] uppercase tracking-widest text-white/20 animate-pulse">ЗАВАНТАЖЕННЯ МАПИ...</span>
              </div>
            }>
              <TargetMap targets={filtered} onSelect={setSelected} selected={selected} />
            </Suspense>
          </div>
        )}

        {/* List view */}
        {view === 'list' && (
          <div className="max-w-[1400px] mx-auto">
            {loading && (
              <div className="text-center py-24 font-mono text-[10px] uppercase tracking-widest text-white/20 animate-pulse">
                ЗАВАНТАЖЕННЯ...
              </div>
            )}

            {!loading && filtered.length === 0 && (
              <div className="text-center py-24 font-mono text-[10px] uppercase tracking-widest text-white/20">
                НІЧОГО НЕ ЗНАЙДЕНО
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filtered.map((t, i) => {
                const sm = STATUS_META[t.status];
                const pm = PRIORITY_META[t.priority];
                const StatusIcon = sm.icon;
                return (
                  <motion.div
                    key={t.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: Math.min(i * 0.04, 0.4) }}
                    onClick={() => setSelected(selected?.id === t.id ? null : t)}
                    className={`border cursor-pointer transition-all duration-300 ${selected?.id === t.id ? 'border-red-500/50 bg-red-500/5' : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/5'}`}
                  >
                    {/* Header */}
                    <div className="p-5 pb-4 flex flex-wrap justify-between gap-2">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${sm.dot} ${t.status === 'active' ? 'animate-pulse' : ''}`} />
                        <div className="min-w-0">
                          <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/30 mb-1">
                            {TYPE_LABELS[t.type] || t.type} · {t.region}
                          </div>
                          <h3 className="text-sm md:text-base font-bold uppercase tracking-tight text-white leading-tight">
                            {t.name}
                          </h3>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <span className={`font-mono text-[9px] uppercase tracking-widest px-2 py-0.5 border ${pm.badge}`}>
                          {pm.label}
                        </span>
                        <span className={`font-mono text-[9px] uppercase tracking-widest flex items-center gap-1 ${sm.color}`}>
                          <StatusIcon className="w-2.5 h-2.5" /> {sm.label}
                        </span>
                      </div>
                    </div>

                    {/* Expanded */}
                    {selected?.id === t.id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="px-5 pb-5 border-t border-white/10 pt-4 space-y-4"
                      >
                        <p className="text-white/60 text-sm leading-relaxed">{t.description}</p>

                        <div className="grid grid-cols-2 gap-3">
                          {t.coords_precise && (
                            <div>
                              <div className="font-mono text-[9px] text-white/30 uppercase tracking-widest mb-1">Координати</div>
                              <div className="font-mono text-xs text-green-400 flex items-center gap-1">
                                <MapPin className="w-3 h-3" /> {t.coords_precise}
                              </div>
                            </div>
                          )}
                          {t.capacity && (
                            <div>
                              <div className="font-mono text-[9px] text-white/30 uppercase tracking-widest mb-1">Потужність</div>
                              <div className="font-mono text-xs text-white/70 flex items-center gap-1">
                                <BarChart2 className="w-3 h-3" /> {t.capacity}
                              </div>
                            </div>
                          )}
                          {t.owner && (
                            <div>
                              <div className="font-mono text-[9px] text-white/30 uppercase tracking-widest mb-1">Власник</div>
                              <div className="font-mono text-xs text-white/60">{t.owner}</div>
                            </div>
                          )}
                          {t.unit && (
                            <div>
                              <div className="font-mono text-[9px] text-white/30 uppercase tracking-widest mb-1">Підрозділ</div>
                              <div className="font-mono text-xs text-white/60">{t.unit}</div>
                            </div>
                          )}
                        </div>

                        {t.strike_history && (
                          <div className="border border-green-500/20 bg-green-500/5 p-3">
                            <div className="font-mono text-[9px] text-green-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                              <CheckCircle className="w-2.5 h-2.5" /> ІСТОРІЯ УДАРІВ
                            </div>
                            <div className="font-mono text-xs text-green-300/70 leading-relaxed">{t.strike_history}</div>
                          </div>
                        )}

                        <div className="flex gap-3 pt-1">
                          <a
                            href={`https://www.google.com/maps?q=${t.lat},${t.lng}&z=14`}
                            target="_blank"
                            rel="noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="font-mono text-[9px] uppercase tracking-widest text-white/30 hover:text-white/70 transition-colors flex items-center gap-1"
                          >
                            Google Maps <ArrowUpRight className="w-2.5 h-2.5" />
                          </a>
                          <a
                            href={`https://www.openstreetmap.org/?mlat=${t.lat}&mlon=${t.lng}#map=14/${t.lat}/${t.lng}`}
                            target="_blank"
                            rel="noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="font-mono text-[9px] uppercase tracking-widest text-white/30 hover:text-white/70 transition-colors flex items-center gap-1"
                          >
                            OSM <ArrowUpRight className="w-2.5 h-2.5" />
                          </a>
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-white/10 px-4 md:px-8 py-12 bg-[#0a0a0a]">
        <div className="max-w-[1400px] mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <Link to="/" className="text-2xl font-bold tracking-tighter uppercase hover:opacity-60 transition-opacity">
            Око Гора
          </Link>
          <div className="font-mono text-[9px] text-white/20 uppercase tracking-widest">
            ДАНІ ОНОВЛЮЮТЬСЯ АВТОМАТИЧНО · © {new Date().getFullYear()} OKO GORA GROUP
          </div>
        </div>
      </footer>
    </div>
  );
}
