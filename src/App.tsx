import { motion } from 'motion/react';
import { ArrowUpRight, Crosshair, Map, Radio, Eye, Activity, Database, Shield, Zap, Terminal, FileSearch, Layers, UploadCloud, Users, Target, Rocket, BarChart3, Menu, X as CloseIcon, Navigation, Info, Clock, AlertTriangle } from 'lucide-react';
import MapService from './components/MapService';

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] }
};

const staggerContainer = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15
    }
  }
};

const posts = [
  {
    id: 'TG-1889',
    date: '27 КВІТ 2026 / 11:47',
    title: 'Ітоги атаки БПЛА: Туапсинський резервуарний парк',
    text: 'Детальний аналіз ураження об\'єктів у Краснодарському краї. Знищено 24 резервуари (52%), пошкоджено 4. Загалом 61% потужностей виведено з ладу.',
    image: 'tuapse_satellite.png',
    tags: ['СУПУТНИК', 'ДРОНИ', 'АНАЛІТИКА']
  },
  {
    id: 'TG-1888',
    date: '26 КВІТ 2026 / 16:00',
    title: 'Ураження об\'єктів у Криму: кораблі та авіація',
    text: 'Результати комбінованої атаки. Зафіксовано пошкодження ВДК "Ямал", "Фильченков", розвідувального судна "Иван Хурс" та літака МіГ-31.',
    image: 'crimea_thermal.png',
    tags: ['ФЛОТ', 'КРИМ', 'БОЙОВА_РОБОТА']
  },
  {
    id: 'TG-1887',
    date: '27 КВІТ 2026 / 10:43',
    title: 'Нові підрозділи БПЛА: СБС "Окремий батальйон"',
    text: 'Розгортання нових розвідувально-ударних комплексів. Перші кадри роботи дронів середнього радіусу дії від новостворених підрозділів СБС.',
    image: 'uav_recon.png',
    tags: ['БПЛА', 'РОЗВІДКА', 'СТРАТЕГІЯ']
  },
  {
    id: 'TG-1886',
    date: '25 КВІТ 2026 / 09:15',
    title: 'Моніторинг логістики: порт Туапсе',
    text: 'Аналіз пошкоджень насосних станцій та трубопровідних вузлів. Критичне сповільнення відвантаження нафтопродуктів через морський термінал.',
    image: 'port_damage.png',
    tags: ['ЛОГІСТИКА', 'ПОРТ', 'УРАЖЕННЯ']
  }
];

export default function App() {
  return (
    <div className="min-h-screen bg-[#f4f4f4] text-[#111111] selection:bg-[#111111] selection:text-[#f4f4f4] font-sans overflow-x-hidden">
      {/* Navigation Bar */}
      <nav className="fixed top-0 left-0 right-0 z-[1000] border-b border-[#111111]/20 bg-[#f4f4f4]/90 backdrop-blur-md">
        <div className="grid grid-cols-2 md:grid-cols-4 px-4 md:px-8 py-3 md:py-4 text-[10px] md:text-xs font-mono uppercase tracking-widest items-center">
          <div className="col-span-1 flex items-center gap-2">
            <div className="w-4 h-4 bg-[#111111] rounded-full flex items-center justify-center">
              <div className="w-1.5 h-1.5 bg-[#f4f4f4] rounded-full animate-pulse" />
            </div>
            <span className="font-bold tracking-tighter">ОКО ГОРА</span>
          </div>
          <div className="hidden md:block col-span-2 text-center text-[#111111]/40">
            СТРАТЕГІЧНИЙ_OSINT_МОНІТОР_V3.0_UA
          </div>
          <div className="col-span-1 flex justify-end">
            <a href="https://t.me/oko_gora" target="_blank" rel="noreferrer" className="hover:opacity-60 transition-opacity flex items-center gap-1 font-bold">
              ТЕЛЕГРАМ <ArrowUpRight className="w-3 h-3" />
            </a>
          </div>
        </div>
      </nav>

      {/* Main Hero */}
      <main className="pt-24 md:pt-40 px-4 md:px-8 pb-24">
        <motion.div 
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="max-w-[1800px] mx-auto"
        >
          {/* Header Typography */}
          <motion.div variants={fadeIn} className="mb-16 md:mb-32 relative">
            {/* Background Logo */}
            <div className="absolute inset-0 -z-10 flex items-center justify-center overflow-hidden pointer-events-none select-none">
              <motion.img 
                src="oko_logo.png" 
                alt="Oko Gora Logo Background" 
                initial={{ opacity: 0, scale: 1.1, rotate: -2 }}
                animate={{ opacity: 0.18, scale: 1, rotate: 0 }}
                transition={{ duration: 4, ease: "easeOut" }}
                className="w-[100%] md:w-[80%] lg:w-[60%] max-w-[1200px] mix-blend-multiply filter contrast-125 brightness-90"
              />
            </div>

            <h1 className="text-[14vw] md:text-[12vw] leading-[0.8] font-bold tracking-tighter uppercase mb-8 relative z-10">
              Око Гора
            </h1>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 border-t border-[#111111] pt-8 md:pt-12 mt-12 md:mt-24 relative z-10">
              <div className="lg:col-span-5">
                <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#111111]/40 mb-4 block">/ МІСІЯ</span>
                <p className="text-2xl md:text-4xl font-medium leading-[1.1] tracking-tight">
                  Тотальний візуальний контроль. Аналітика бойового простору та оптична перевага.
                </p>
              </div>
              <div className="lg:col-start-8 lg:col-span-5">
                <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#111111]/40 mb-4 block">/ ЕКОСИСТЕМA</span>
                <ul className="space-y-4 font-mono text-[10px] md:text-xs uppercase tracking-widest">
                  <li className="flex justify-between border-b border-[#111111]/10 pb-2 hover:opacity-100 opacity-60 transition-opacity">
                    <span>ПОВІТРЯНА РОЗВІДКА</span>
                    <span>01</span>
                  </li>
                  <li className="flex justify-between border-b border-[#111111]/10 pb-2 hover:opacity-100 opacity-60 transition-opacity">
                    <span>КООРДИНАЦІЯ ТА ЦІЛЕВКАЗАННЯ</span>
                    <span>02</span>
                  </li>
                  <li className="flex justify-between border-b border-[#111111]/10 pb-2 hover:opacity-100 opacity-60 transition-opacity">
                    <span>СИСТЕМИ ДАЛЕКОГО УРАЖЕННЯ</span>
                    <span>03</span>
                  </li>
                </ul>
              </div>
            </div>
          </motion.div>

          {/* Map Service Block */}
          <motion.div variants={fadeIn} className="mb-32 md:mb-48 w-full">
             <MapService />
          </motion.div>

          {/* System Utilities & Dashboard */}
          <motion.div variants={fadeIn} className="mb-32 md:mb-48">
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Terminal Side */}
              <div className="lg:col-span-1 bg-[#111111] text-[#00ff41] p-6 font-mono text-[10px] leading-relaxed border border-[#00ff41]/20 shadow-2xl relative overflow-hidden group">
                <div className="flex items-center gap-2 mb-4 border-b border-[#00ff41]/20 pb-2">
                  <Terminal className="w-3 h-3" />
                  <span className="uppercase tracking-widest text-[9px]">ПРЯМИЙ_ЕФІР_ДАННИХ</span>
                  <span className="ml-auto animate-pulse">●</span>
                </div>
                <div className="space-y-1 opacity-80 h-[120px] overflow-hidden">
                  <p>[09:41:22] INCOMING SATELLITE PACKET: SENTINEL-2B</p>
                  <p>[09:41:25] DECRYPTING_GEOSPATIAL_LAYER...</p>
                  <p>[09:41:30] ANOMALY DETECTED: SECTOR G-14</p>
                  <p>[09:41:42] THERMAL_SIGNATURE_MATCH: T-90M</p>
                  <p>[09:41:55] BROADCASTING TO UNIT_7...</p>
                  <p className="animate-pulse">_</p>
                </div>
                <div className="mt-8 pt-4 border-t border-[#00ff41]/10 flex justify-between opacity-30 text-[8px] uppercase tracking-widest">
                  <span>ШИФРУВАННЯ: AES-GCM</span>
                  <span>ВУЗОЛ: LVIV_PRIME</span>
                </div>
              </div>

              {/* Utility Cards */}
              <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white border border-[#111111]/10 p-8 hover:bg-[#111111] hover:text-[#f4f4f4] transition-all duration-500 group relative">
                  <Activity className="w-8 h-8 mb-6 group-hover:text-green-500 transition-colors" />
                  <h4 className="text-2xl font-bold uppercase mb-2 tracking-tighter">SIGINT Аналізатор</h4>
                  <p className="text-sm opacity-60 leading-snug mb-8">Аналіз радіочастотного спектру та перехоплення сигналів зв'язку ворога в реальному часі.</p>
                  <div className="flex justify-between items-center font-mono text-[10px] tracking-widest pt-4 border-t border-[#111111]/10 group-hover:border-[#f4f4f4]/20">
                    <span className="flex items-center gap-2 animate-pulse"><Radio className="w-3 h-3" /> 424.000 MHZ</span>
                    <span className="opacity-40">ЗАШИФРОВАНО</span>
                  </div>
                </div>

                <div className="bg-white border border-[#111111]/10 p-8 hover:bg-[#111111] hover:text-[#f4f4f4] transition-all duration-500 group relative">
                  <Database className="w-8 h-8 mb-6 group-hover:text-blue-500 transition-colors" />
                  <h4 className="text-2xl font-bold uppercase mb-2 tracking-tighter">База Цілей</h4>
                  <p className="text-sm opacity-60 leading-snug mb-8">Автоматизована база даних об'єктів та одиниць техніки окупанта з використанням ШІ.</p>
                  <div className="flex justify-between items-center font-mono text-[10px] tracking-widest pt-4 border-t border-[#111111]/10 group-hover:border-[#f4f4f4]/20">
                    <span className="flex items-center gap-2"><Shield className="w-3 h-3" /> 8.4k ЗАПИСІВ</span>
                    <span className="opacity-40">СТАБІЛЬНО</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Visual Dashboard Strip */}
            <div className="mt-8 aspect-[21/4] w-full bg-[#111111] relative overflow-hidden group">
              <img 
                src="ui_dashboard.png" 
                alt="System UI Dashboard" 
                className="w-full h-full object-cover opacity-50 grayscale hover:grayscale-0 transition-all duration-1000 scale-105 group-hover:scale-100"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-[#111111] via-transparent to-[#111111]" />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-[#f4f4f4] font-mono text-[10px] tracking-[0.5em] uppercase opacity-30">
                  ЦІЛІСНІСТЬ_СИСТЕМИ_СТАБІЛЬНА // СИНХРОНІЗАЦІЯ_ХМАРИ_АКТИВНА
                </div>
              </div>
            </div>
          </motion.div>

          {/* Middle Strike Analytics & Missile Program */}
          <motion.div variants={fadeIn} className="mb-32 md:mb-48">
            <div className="border-t border-[#111111] pt-12 md:pt-24">
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end mb-16 gap-8">
                <div className="max-w-3xl">
                  <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#111111]/40 mb-6 block">/ СТРАТЕГІЧНИЙ МОНІТОРИНГ</span>
                  <h2 className="text-5xl md:text-8xl font-bold tracking-tighter uppercase leading-[0.85] mb-4">
                    Аналітика <br />
                    Ударів
                  </h2>
                </div>
                <div className="w-full lg:w-auto text-left lg:text-right bg-[#111111] lg:bg-transparent p-8 lg:p-0 border lg:border-0 border-[#111111]/10">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-white/40 lg:text-[#111111]/40 mb-3">/ Рахуємо разом</p>
                  <div className="text-7xl md:text-9xl font-bold tracking-tighter text-white lg:text-[#111111]">482</div>
                  <div className="font-mono text-[10px] uppercase tracking-widest mt-2 text-white/20 lg:text-[#111111]/20">Всього підтверджених влучань</div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 md:gap-16">
                {/* Visual Side */}
                <div className="lg:col-span-7 bg-[#111111] aspect-square md:aspect-video relative overflow-hidden group">
                  <img 
                    src="missile_reach.png" 
                    alt="Missile Reach Map" 
                    className="w-full h-full object-cover opacity-60 grayscale group-hover:grayscale-0 transition-all duration-1000 scale-105 group-hover:scale-100"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#111111] via-transparent to-transparent opacity-80" />
                  <div className="absolute bottom-8 left-8 right-8 flex justify-between items-center pointer-events-none">
                    <div className="font-mono text-[10px] text-white/50 space-y-1">
                      <p className="flex items-center gap-2 text-green-500 font-bold uppercase"><span className="w-2 h-2 bg-green-500 rounded-full animate-ping" /> СТРАТЕГІЧНИЙ_ЗВ'ЯЗОК_АКТИВНИЙ</p>
                      <p>РАДІУС_МОНІТОРИНГУ: 1500 КМ</p>
                    </div>
                  </div>
                </div>

                {/* Data Side */}
                <div className="lg:col-span-5 flex flex-col justify-between space-y-12">
                  <div className="space-y-10">
                    <div className="bg-white border border-[#111111]/10 p-8 md:p-12 shadow-xl relative overflow-hidden">
                       <div className="absolute top-0 right-0 p-4 opacity-5">
                        <Rocket className="w-32 h-32 -rotate-12" />
                      </div>
                      <span className="font-mono text-[10px] uppercase tracking-widest text-[#111111]/40 mb-8 block">/ Ракетна програма</span>
                      <div className="space-y-8">
                        {[
                          { name: 'Паляниця (Реактивний дрон)', progress: 85, dist: '750км' },
                          { name: 'Нептун (Модернізація R-360)', progress: 95, dist: '400км' },
                          { name: 'Дальні БПЛА (Бобер/Лютий)', progress: 100, dist: '1200км' }
                        ].map(m => (
                          <div key={m.name} className="space-y-3">
                            <div className="flex justify-between font-mono text-[10px] uppercase tracking-tighter">
                              <span className="font-bold">{m.name}</span>
                              <span className="text-[#111111]/50">{m.dist}</span>
                            </div>
                            <div className="h-1.5 w-full bg-[#111111]/5 overflow-hidden">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${m.progress}%` }}
                                transition={{ duration: 1.5, delay: 0.5 }}
                                className="h-full bg-[#111111]" 
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-px bg-[#111111]/10">
                      <div className="bg-white p-8 text-center border border-[#111111]/5">
                        <div className="text-4xl md:text-5xl font-bold mb-2 tracking-tighter">124</div>
                        <div className="font-mono text-[9px] uppercase tracking-[0.2em] opacity-40">НПЗ / Резервуари</div>
                      </div>
                      <div className="bg-white p-8 text-center border border-[#111111]/5">
                        <div className="text-4xl md:text-5xl font-bold mb-2 tracking-tighter">42</div>
                        <div className="font-mono text-[9px] uppercase tracking-[0.2em] opacity-40">Авіабази / Склади</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Submission & Community Section */}
          <motion.div variants={fadeIn} className="mb-32 md:mb-48 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
            <div className="bg-[#111111] text-[#f4f4f4] p-10 md:p-16 flex flex-col justify-between group cursor-pointer hover:bg-zinc-900 transition-colors">
              <div>
                <UploadCloud className="w-12 h-12 mb-10 opacity-30 group-hover:opacity-100 transition-opacity" />
                <h3 className="text-3xl md:text-5xl font-bold uppercase tracking-tighter mb-6 leading-[0.9]">Передача <br /> даних</h3>
                <p className="text-[#f4f4f4]/40 font-mono text-[10px] md:text-xs leading-relaxed max-w-sm">
                  Захищений шлюз для збору координат, фото та відео з окупованих територій. Повна анонімність гарантована.
                </p>
              </div>
              <div className="mt-12 flex justify-between items-center font-mono text-[10px] uppercase tracking-widest opacity-20">
                <span>РІВЕНЬ_БЕЗПЕКИ: ВИСОКИЙ</span>
                <ArrowUpRight className="w-4 h-4" />
              </div>
            </div>

            <div className="bg-white border border-[#111111]/10 p-10 md:p-16 flex flex-col justify-between group cursor-pointer hover:border-[#111111]/40 transition-colors">
              <div>
                <Layers className="w-12 h-12 mb-10 text-[#111111]/20 group-hover:text-[#111111] transition-colors" />
                <h3 className="text-3xl md:text-5xl font-bold uppercase tracking-tighter mb-6 leading-[0.9]">Архів та <br /> Аналіз</h3>
                <p className="text-[#111111]/40 font-mono text-[10px] md:text-xs leading-relaxed max-w-sm">
                  Доступ до детальної бази даних подій. Пошук за датою, типом техніки або сектором.
                </p>
              </div>
              <ul className="mt-12 space-y-2 font-mono text-[9px] md:text-[10px] tracking-widest text-[#111111]/30 uppercase">
                <li className="flex items-center gap-2"><Navigation className="w-3 h-3" /> Геолокація об'єктів</li>
                <li className="flex items-center gap-2"><Activity className="w-3 h-3" /> Статистика втрат</li>
              </ul>
            </div>
          </motion.div>

          {/* Feed Grid */}
          <motion.div variants={fadeIn} className="mb-32">
            <div className="flex justify-between items-end border-b border-[#111111] pb-6 mb-12">
              <h2 className="text-4xl md:text-7xl font-bold tracking-tighter uppercase">Стрічка</h2>
              <a href="https://t.me/oko_gora" target="_blank" rel="noreferrer" className="font-mono text-xs tracking-widest hover:underline uppercase opacity-40 hover:opacity-100 transition-opacity">
                Всі публікації <ArrowUpRight className="w-3 h-3 inline ml-1" />
              </a>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-12 md:gap-24">
              {posts.map((post) => (
                <div key={post.id} className="group cursor-pointer">
                  <div className="aspect-[16/9] w-full overflow-hidden bg-zinc-100 mb-6 relative">
                    <img 
                      src={post.image} 
                      alt={post.title}
                      className="w-full h-full object-cover grayscale contrast-[1.15] group-hover:grayscale-0 group-hover:scale-105 transition-all duration-1000 ease-[0.22,1,0.36,1]"
                    />
                    <div className="absolute inset-0 bg-[#111111]/5 group-hover:bg-transparent transition-colors" />
                  </div>
                  <div className="flex gap-4 mb-4 font-mono text-[9px] tracking-[0.2em] uppercase text-[#111111]/40">
                    <span className="font-bold text-[#111111]/70">{post.id}</span>
                    <span>{post.date}</span>
                  </div>
                  <h3 className="text-2xl md:text-3xl font-bold uppercase tracking-tight mb-4 group-hover:underline transition-all">
                    {post.title}
                  </h3>
                  <p className="text-[#111111]/60 leading-snug mb-6 text-sm md:text-base line-clamp-3">
                    {post.text}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {post.tags.map(tag => (
                      <span key={tag} className="px-3 py-1 border border-[#111111]/10 font-mono text-[9px] tracking-widest uppercase opacity-60 group-hover:opacity-100 transition-opacity">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#111111] px-4 md:px-8 py-20 md:py-40 bg-[#111111] text-[#f4f4f4]">
        <div className="max-w-[1800px] mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-16 mb-32">
            <div className="md:col-span-6">
              <h3 className="text-5xl md:text-8xl font-bold tracking-tighter uppercase mb-8 leading-[0.85]">
                Око Гора
              </h3>
              <p className="text-[#f4f4f4]/40 max-w-md font-mono text-xs md:text-sm leading-relaxed">
                Незалежний ресурс з моніторингу, аеророзвідки та стратегічної аналітики бойового простору. Побудовано для тих, хто бачить далі горизонту.
              </p>
            </div>
            
            <div className="md:col-start-8 md:col-span-2 space-y-4">
              <span className="font-mono text-[10px] uppercase tracking-[0.3em] opacity-30 block mb-8">/ НАВІГАЦІЯ</span>
              <ul className="space-y-4 font-mono text-xs tracking-widest uppercase text-[#f4f4f4]/60">
                <li><a href="#" className="hover:text-white transition-colors">МЕТОДОЛОГІЯ</a></li>
                <li><a href="#" className="hover:text-white transition-colors">АРХІВ УДАРІВ</a></li>
                <li><a href="#" className="hover:text-white transition-colors">КОНТАКТИ</a></li>
              </ul>
            </div>

            <div className="md:col-span-3 space-y-4 text-right">
              <span className="font-mono text-[10px] uppercase tracking-[0.3em] opacity-30 block mb-8">/ ПРИЄДНАТИСЬ</span>
              <ul className="space-y-4 font-mono text-xs tracking-widest uppercase">
                <li>
                  <a href="https://t.me/oko_gora" target="_blank" rel="noreferrer" className="flex items-center justify-end gap-2 hover:opacity-70 transition-opacity">
                    ТЕЛЕГРАМ КАНАЛ <ArrowUpRight className="w-4 h-4" />
                  </a>
                </li>
                <li>
                  <a href="https://x.com/oko_gora_tg" target="_blank" rel="noreferrer" className="flex items-center justify-end gap-2 hover:opacity-70 transition-opacity font-bold">
                    X (TWITTER) РОЗВІДКА <ArrowUpRight className="w-4 h-4" />
                  </a>
                </li>
              </ul>
            </div>
          </div>
          
          <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center font-mono text-[9px] tracking-[0.3em] text-white/20 uppercase">
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
