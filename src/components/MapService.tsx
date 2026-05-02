import React, { useState, useMemo, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, LayersControl, useMapEvents, Polyline, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Target, Anchor, Plane, Shield, Filter, Menu, X as CloseIcon, Activity, Clock, Ruler, Crosshair, Radio } from 'lucide-react';

const createTacticalIcon = (color: string, label: string, shape: 'circle' | 'diamond' | 'square' = 'circle') => {
  const shapeHtml = shape === 'diamond'
    ? `<div style="width:13px;height:13px;background-color:${color};border:1.5px solid rgba(255,255,255,0.8);transform:rotate(45deg);box-shadow:0 0 12px ${color}99;position:relative;z-index:10"></div>`
    : shape === 'square'
    ? `<div style="width:13px;height:13px;background-color:${color};border:1.5px solid rgba(255,255,255,0.8);box-shadow:0 0 12px ${color}99;position:relative;z-index:10"></div>`
    : `<div style="width:14px;height:14px;background-color:${color};border:2px solid rgba(255,255,255,0.85);border-radius:50%;box-shadow:0 0 16px ${color}bb;position:relative;z-index:10"></div>`;

  return new L.DivIcon({
    className: 'tactical-marker',
    html: `
      <div style="position:relative;display:flex;align-items:center;justify-content:center">
        <div style="position:absolute;inset:-4px;border-radius:50%;background-color:${color}22;animation:ping 1.4s cubic-bezier(0,0,0.2,1) infinite"></div>
        ${shapeHtml}
        <div style="position:absolute;left:20px;top:50%;transform:translateY(-50%);background:rgba(10,10,8,0.97);color:#c9a227;font-size:7px;font-family:monospace;padding:2px 6px;white-space:nowrap;border:1px solid #c9a22740;letter-spacing:0.1em;pointer-events:none;z-index:50;text-transform:uppercase">
          ${label}
        </div>
      </div>
    `,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
};

function MapEvents({ onMouseMove, onClick }: { onMouseMove: (lat: number, lng: number) => void; onClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    mousemove(e) { onMouseMove(e.latlng.lat, e.latlng.lng); },
    click(e) { onClick(e.latlng.lat, e.latlng.lng); },
  });
  return null;
}

const strikes = [
  { id: 1, pos: [44.1132, 39.0825] as [number, number], name: 'Туапсе НПЗ', date: '27.04.2026', bda: '61% КРИТИЧНО', intel: 'SENTINEL-2 / OSINT', type: 'strike' as const },
  { id: 2, pos: [44.6167, 33.5250] as [number, number], name: 'Севастополь ВДК', date: '26.04.2026', bda: 'ВДК ПОВАЛЕНИЙ', intel: 'SAR / DRONE', type: 'navy' as const },
  { id: 3, pos: [45.3422, 32.5122] as [number, number], name: 'Оленівка С-400', date: '25.04.2026', bda: 'ЗНИЩЕНО', intel: 'THERMAL / RECON', type: 'strike' as const },
  { id: 4, pos: [46.6034, 32.6169] as [number, number], name: 'Чорнобаївка', date: '14.04.2026', bda: 'СКЛАД +ЗНИЩЕНО', intel: 'OSINT_CONFIRMED', type: 'logistics' as const },
  { id: 5, pos: [45.0121, 33.6745] as [number, number], name: 'Джанкой (вузол)', date: '20.04.2026', bda: '40% ПОШКОДЖЕНО', intel: 'SIGINT / HUMINT', type: 'logistics' as const },
  { id: 6, pos: [48.0511, 46.1432] as [number, number], name: 'Аеродром Ахтубінськ', date: '18.04.2026', bda: 'ЗЛІТНА+СМУГА', intel: 'SAT_INTEL', type: 'airbase' as const },
];

const EVENT_LOG = [
  { id: 'e1', label: 'UA_DRONE_VOL-12', status: 'УСПІШНО', color: '#22c55e' },
  { id: 'e2', label: 'STRIKE_SEV_HBR', status: 'BDA_NEEDED', color: '#ef4444' },
  { id: 'e3', label: 'RECON_KERCH_2', status: 'АКТИВНО', color: '#c9a227' },
  { id: 'e4', label: 'SIGINT_CH_4', status: 'ЗАВЕРШЕНО', color: '#6b7280' },
];

export default function MapService() {
  const [activeFilters, setActiveFilters] = useState(['strikes', 'navy', 'airbases', 'logistics']);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [telemetry, setTelemetry] = useState({ lat: 47.0, lng: 36.5 });
  const [measurePoints, setMeasurePoints] = useState<[number, number][]>([]);
  const [distance, setDistance] = useState<number | null>(null);
  const [tick, setTick] = useState(0);
  const [activeTab, setActiveTab] = useState<'filters' | 'events' | 'ruler'>('filters');

  // Animate clock tick for live indicator
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const icons = useMemo(() => ({
    strike:   createTacticalIcon('#ef4444', 'УРАЖЕННЯ', 'circle'),
    navy:     createTacticalIcon('#3b82f6', 'МОРСЬКА_ЦІЛЬ', 'diamond'),
    airbase:  createTacticalIcon('#c9a227', 'АВІАБАЗА_РФ', 'square'),
    logistics:createTacticalIcon('#22c55e', 'ЛОГІСТИКА', 'square'),
  }), []);

  const toggleFilter = (f: string) =>
    setActiveFilters(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]);

  const calcDist = (p1: [number, number], p2: [number, number]) => {
    const toRad = (d: number) => d * Math.PI / 180;
    const R = 6371;
    const dLat = toRad(p2[0] - p1[0]);
    const dLon = toRad(p2[1] - p1[1]);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(p1[0])) * Math.cos(toRad(p2[0])) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const handleClick = (lat: number, lng: number) => {
    if (activeTab !== 'ruler') return;
    if (measurePoints.length >= 2) {
      setMeasurePoints([[lat, lng]]);
      setDistance(null);
    } else if (measurePoints.length === 1) {
      const pts: [number, number][] = [...measurePoints, [lat, lng]];
      setMeasurePoints(pts);
      setDistance(calcDist(pts[0], pts[1]));
    } else {
      setMeasurePoints([[lat, lng]]);
    }
  };

  const now = new Date();
  const timeStr = `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}:${String(now.getUTCSeconds() + (tick % 60)).padStart(2, '0')} UTC`;

  const FILTERS = [
    { id: 'strikes',   label: 'Удари / BDA',   color: '#ef4444', Icon: Target },
    { id: 'navy',      label: 'Морські цілі',  color: '#3b82f6', Icon: Anchor },
    { id: 'airbases',  label: 'Авіабази РФ',   color: '#c9a227', Icon: Plane  },
    { id: 'logistics', label: 'Логістика',     color: '#22c55e', Icon: Shield },
  ];

  return (
    <div className="w-full flex flex-col font-sans">

      {/* ── Header bar ── */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.18em]">
          <div className="relative flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping absolute" />
            <span className="w-2 h-2 rounded-full bg-red-500 relative" />
            <span className="text-red-400 font-bold">LIVE</span>
          </div>
          <span className="text-[#c9a227]/70 border-l border-[#c9a227]/20 pl-3">ТАКТИЧНИЙ_МОНІТОР v3.1</span>
          <span className="hidden md:inline text-white/20">// OKO_GORA_INTEL</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[9px] text-[#c9a227]/40 tracking-widest hidden md:block">{timeStr}</span>
          <button
            onClick={() => setIsSidebarOpen(v => !v)}
            className="flex items-center gap-1.5 border border-[#c9a227]/25 bg-[#1c1c12] text-[#c9a227]/60 hover:text-[#c9a227] hover:border-[#c9a227]/60 px-3 py-1.5 font-mono text-[9px] uppercase tracking-widest transition-all"
          >
            {isSidebarOpen ? <CloseIcon className="w-3 h-3" /> : <Menu className="w-3 h-3" />}
            {isSidebarOpen ? 'СХОВАТИ' : 'HUD'}
          </button>
        </div>
      </div>

      {/* ── Map area ── */}
      <div className="relative w-full h-[520px] md:h-[780px] bg-[#0a0a08] border border-[#c9a227]/15 overflow-hidden shadow-2xl">

        {/* Corner decorators */}
        <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-[#c9a227]/50 z-[450] pointer-events-none" />
        <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-[#c9a227]/50 z-[450] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-[#c9a227]/50 z-[450] pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-[#c9a227]/50 z-[450] pointer-events-none" />

        {/* ── Sidebar HUD ── */}
        <div className={`absolute top-4 left-4 z-[400] w-60 transition-all duration-500 ease-in-out ${isSidebarOpen ? 'translate-x-0 opacity-100' : '-translate-x-[120%] opacity-0 pointer-events-none'}`}>

          {/* Tab bar */}
          <div className="flex border border-[#c9a227]/20 bg-[#0d0d0a]/95 mb-0">
            {([
              { id: 'filters', Icon: Filter, tip: 'Фільтри' },
              { id: 'events',  Icon: Clock,  tip: 'Події'   },
              { id: 'ruler',   Icon: Ruler,  tip: 'Лінійка' },
            ] as const).map(({ id, Icon, tip }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                title={tip}
                className={`flex-1 flex items-center justify-center py-2 transition-all ${activeTab === id ? 'bg-[#c9a227]/15 text-[#c9a227]' : 'text-white/25 hover:text-white/50'}`}
              >
                <Icon className="w-3 h-3" />
              </button>
            ))}
          </div>

          {/* Panel body */}
          <div className="bg-[#0d0d0a]/97 backdrop-blur-xl border border-t-0 border-[#c9a227]/20 p-4 shadow-2xl">

            {activeTab === 'filters' && (
              <div className="space-y-1.5">
                <p className="font-mono text-[8px] uppercase tracking-[0.25em] text-[#c9a227]/40 mb-3">/ ШАРИ_МАПИ</p>
                {FILTERS.map(f => (
                  <button
                    key={f.id}
                    onClick={() => toggleFilter(f.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 font-mono text-[9px] uppercase tracking-wider transition-all border ${
                      activeFilters.includes(f.id)
                        ? 'border-[#c9a227]/30 bg-[#c9a227]/8 text-white'
                        : 'border-transparent text-white/25 hover:text-white/40'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: activeFilters.includes(f.id) ? f.color : '#333' }} />
                    <span className="flex-1 text-left">{f.label}</span>
                    <f.Icon className="w-3 h-3 opacity-50" />
                  </button>
                ))}

                {/* Active count */}
                <div className="mt-3 pt-3 border-t border-[#c9a227]/10 flex justify-between font-mono text-[8px] text-white/20 uppercase tracking-widest">
                  <span>Об'єктів активно</span>
                  <span className="text-[#c9a227]/60">
                    {strikes.filter(s =>
                      (s.type === 'strike' && activeFilters.includes('strikes')) ||
                      (s.type === 'navy' && activeFilters.includes('navy')) ||
                      (s.type === 'airbase' && activeFilters.includes('airbases')) ||
                      (s.type === 'logistics' && activeFilters.includes('logistics'))
                    ).length} / {strikes.length}
                  </span>
                </div>
              </div>
            )}

            {activeTab === 'events' && (
              <div className="space-y-2">
                <p className="font-mono text-[8px] uppercase tracking-[0.25em] text-[#c9a227]/40 mb-3">/ ОСТАННІ_ПОДІЇ</p>
                {EVENT_LOG.map(e => (
                  <div key={e.id} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: e.color }} />
                      <span className="font-mono text-[8px] text-white/50 tracking-wide">{e.label}</span>
                    </div>
                    <span className="font-mono text-[8px] font-bold" style={{ color: e.color }}>{e.status}</span>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'ruler' && (
              <div>
                <p className="font-mono text-[8px] uppercase tracking-[0.25em] text-[#c9a227]/40 mb-3">/ ДИСТАНЦІЙНА_ЛІНІЙКА</p>
                <p className="text-[8px] font-mono text-white/30 leading-relaxed mb-3">
                  Клікніть 2 точки на мапі для вимірювання відстані.
                </p>
                {distance ? (
                  <div className="bg-[#c9a227]/10 border border-[#c9a227]/30 p-3 text-center">
                    <div className="font-mono text-[10px] text-[#c9a227]/50 uppercase tracking-widest mb-1">ВІДСТАНЬ</div>
                    <div className="font-mono text-2xl font-bold text-[#c9a227]">{distance.toFixed(1)}</div>
                    <div className="font-mono text-[9px] text-[#c9a227]/40 uppercase tracking-widest">км</div>
                  </div>
                ) : (
                  <div className="border border-white/5 p-3 text-center font-mono text-[8px] text-white/15 uppercase tracking-widest">
                    {measurePoints.length === 0 ? 'ТОЧКА 1 → КЛІК' : 'ТОЧКА 2 → КЛІК'}
                  </div>
                )}
                <button
                  onClick={() => { setMeasurePoints([]); setDistance(null); }}
                  className="w-full mt-3 font-mono text-[8px] uppercase tracking-widest text-white/20 hover:text-[#c9a227]/60 transition-colors text-center"
                >
                  [ СКИНУТИ ]
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Telemetry / crosshair HUD (bottom-left) ── */}
        <div className="absolute bottom-4 left-4 z-[400] pointer-events-none">
          <div className="bg-[#0d0d0a]/92 border border-[#c9a227]/20 backdrop-blur-md px-4 py-3 shadow-xl">
            <div className="flex items-center gap-2 mb-2 border-b border-[#c9a227]/10 pb-2">
              <Crosshair className="w-3 h-3 text-[#c9a227]/50" />
              <span className="font-mono text-[8px] uppercase tracking-[0.2em] text-[#c9a227]/40">ТЕЛЕМЕТРІЯ</span>
            </div>
            <div className="space-y-1 font-mono text-[9px]">
              <div className="flex gap-6 justify-between">
                <span className="text-white/20">LAT</span>
                <span className="text-[#c9a227]/80 font-bold tracking-tighter">{telemetry.lat.toFixed(5)}°N</span>
              </div>
              <div className="flex gap-6 justify-between">
                <span className="text-white/20">LNG</span>
                <span className="text-[#c9a227]/80 font-bold tracking-tighter">{telemetry.lng.toFixed(5)}°E</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Strike count badge (top-right) ── */}
        <div className="absolute top-4 right-4 z-[400] pointer-events-none">
          <div className="bg-[#0d0d0a]/92 border border-red-500/25 backdrop-blur-md px-3 py-2 shadow-xl">
            <div className="font-mono text-[8px] text-red-400/60 uppercase tracking-widest mb-0.5">ПІДТВЕРДЖЕНО</div>
            <div className="font-mono text-xl font-bold text-red-400 leading-none">{strikes.filter(s => ['strike'].includes(s.type)).length}</div>
            <div className="font-mono text-[7px] text-red-400/30 uppercase tracking-widest mt-0.5">УДАРІВ / СЕСІЯ</div>
          </div>
        </div>

        {/* ── Legend (bottom-right) ── */}
        <div className="absolute bottom-4 right-4 z-[400] pointer-events-none">
          <div className="bg-[#0d0d0a]/92 border border-[#c9a227]/20 backdrop-blur-md px-3 py-2.5 shadow-xl">
            {FILTERS.map(f => (
              <div key={f.id} className="flex items-center gap-2 py-0.5">
                <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: activeFilters.includes(f.id) ? f.color : '#333' }} />
                <span className="font-mono text-[7px] uppercase tracking-widest" style={{ color: activeFilters.includes(f.id) ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.1)' }}>
                  {f.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Measurement ruler hint ── */}
        {activeTab === 'ruler' && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[400] pointer-events-none">
            <div className="font-mono text-[9px] uppercase tracking-widest text-[#c9a227]/30 border border-[#c9a227]/15 px-3 py-1.5 bg-[#0d0d0a]/70 backdrop-blur-sm">
              {measurePoints.length === 0 ? '⊕ КЛІКНІТЬ ПЕРШУ ТОЧКУ' : measurePoints.length === 1 ? '⊕ КЛІКНІТЬ ДРУГУ ТОЧКУ' : ''}
            </div>
          </div>
        )}

        {/* ── Leaflet Map ── */}
        <MapContainer
          center={[47.5, 36.5]}
          zoom={6}
          scrollWheelZoom
          className="w-full h-full z-0 cursor-crosshair"
          zoomControl={false}
        >
          <LayersControl position="topright">
            <LayersControl.BaseLayer name="Супутниковий Intel">
              <TileLayer
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                attribution="&copy; ESRI"
              />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer checked name="Тактична Темна">
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                attribution="&copy; CARTO"
              />
            </LayersControl.BaseLayer>
          </LayersControl>

          <MapEvents onMouseMove={(lat, lng) => setTelemetry({ lat, lng })} onClick={handleClick} />

          {/* Distance line */}
          {measurePoints.length === 2 && (
            <>
              <Polyline positions={measurePoints} pathOptions={{ color: '#c9a227', weight: 1.5, dashArray: '8 8', opacity: 0.7 }}>
                <Tooltip permanent direction="center">
                  <span className="font-mono text-[10px] font-bold" style={{ color: '#c9a227' }}>{distance?.toFixed(1)} км</span>
                </Tooltip>
              </Polyline>
              {measurePoints.map((p, i) => (
                <Circle key={i} center={p} radius={150} pathOptions={{ color: '#c9a227', fillColor: '#c9a227', fillOpacity: 0.4, weight: 1 }} />
              ))}
            </>
          )}

          {/* Strike trajectories */}
          {activeFilters.includes('strikes') && (
            <>
              <Polyline positions={[[48.5, 34.0], [44.1132, 39.0825]]} pathOptions={{ color: '#ef4444', weight: 1, dashArray: '4 8', opacity: 0.2 }} />
              <Polyline positions={[[47.0, 32.0], [44.6167, 33.5250]]} pathOptions={{ color: '#ef4444', weight: 1, dashArray: '4 8', opacity: 0.2 }} />
              <Polyline positions={[[47.5, 31.5], [45.3422, 32.5122]]} pathOptions={{ color: '#ef4444', weight: 1, dashArray: '4 8', opacity: 0.2 }} />
            </>
          )}

          {/* Markers */}
          {strikes.map(s => {
            const filterKey = s.type === 'strike' ? 'strikes' : s.type === 'navy' ? 'navy' : s.type === 'airbase' ? 'airbases' : 'logistics';
            if (!activeFilters.includes(filterKey)) return null;
            return (
              <Marker key={s.id} position={s.pos} icon={icons[s.type === 'strike' ? 'strike' : s.type === 'navy' ? 'navy' : s.type === 'airbase' ? 'airbase' : 'logistics']}>
                <Popup className="tactical-popup">
                  <div className="font-mono p-3 bg-[#0d0d0a] text-white border border-[#c9a227]/20 min-w-[200px]">
                    <div className="flex justify-between items-center mb-2 border-b border-[#c9a227]/15 pb-2">
                      <h5 className="font-bold text-[#c9a227] uppercase text-[10px] tracking-tight">{s.name}</h5>
                      <span className="text-[7px] bg-red-500/15 border border-red-500/30 px-1.5 py-0.5 text-red-400 tracking-widest uppercase">УРАЖЕННЯ</span>
                    </div>
                    <div className="space-y-1.5 text-[9px]">
                      <div className="flex justify-between gap-8">
                        <span className="text-white/30 uppercase">Дата</span>
                        <span className="font-bold text-white/70">{s.date}</span>
                      </div>
                      <div className="flex justify-between gap-8">
                        <span className="text-white/30 uppercase">BDA</span>
                        <span className="text-green-400 font-bold">{s.bda}</span>
                      </div>
                      <div className="pt-2 mt-1 border-t border-white/5 text-[7px] text-white/25 tracking-widest uppercase">
                        SOURCE: {s.intel}
                      </div>
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {/* Navy threat zone */}
          {activeFilters.includes('navy') && (
            <Circle center={[44.5, 33.8]} radius={6000} pathOptions={{ color: '#3b82f6', fillOpacity: 0.06, weight: 1, dashArray: '6 6' }}>
              <Tooltip permanent direction="top" className="tactical-label-navy">АКВАТОРІЯ_ЗАГРОЗИ</Tooltip>
            </Circle>
          )}

          {/* General combat activity heat zone */}
          <Circle center={[47.2, 37.5]} radius={90000} pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.04, weight: 0 }} />
        </MapContainer>

        {/* CRT scanline overlay */}
        <div className="absolute inset-0 pointer-events-none z-[450] opacity-[0.025] bg-[repeating-linear-gradient(0deg,transparent,transparent_1px,rgba(0,0,0,0.5)_1px,rgba(0,0,0,0.5)_2px)]" />
        {/* Vignette */}
        <div className="absolute inset-0 pointer-events-none z-[448] bg-[radial-gradient(ellipse_at_center,transparent_60%,rgba(0,0,0,0.55)_100%)]" />
      </div>

      <style>{`
        .leaflet-container { background: #0a0a08 !important; }
        .tactical-popup .leaflet-popup-content-wrapper {
          background: transparent !important; padding: 0 !important;
          border-radius: 0 !important; box-shadow: none !important;
        }
        .tactical-popup .leaflet-popup-content { margin: 0 !important; }
        .tactical-popup .leaflet-popup-tip { background: #0d0d0a !important; }
        .leaflet-control-layers {
          background: #0d0d0a !important; color: #c9a22799 !important;
          border: 1px solid rgba(201,162,39,0.2) !important;
          font-family: monospace !important; font-size: 8px !important;
          text-transform: uppercase !important; border-radius: 0 !important;
          letter-spacing: 0.08em !important;
        }
        .leaflet-control-layers-toggle { background-color: #0d0d0a !important; }
        .leaflet-control-layers label { color: #c9a22799 !important; }
        .leaflet-control-zoom {
          border: 1px solid rgba(201,162,39,0.2) !important; border-radius: 0 !important;
        }
        .leaflet-control-zoom a {
          background: #0d0d0a !important; color: #c9a22799 !important;
          border-radius: 0 !important; border-bottom: 1px solid rgba(201,162,39,0.15) !important;
        }
        .leaflet-control-zoom a:hover { background: #1c1c12 !important; color: #c9a227 !important; }
        .tactical-label-navy {
          background: transparent !important; border: none !important;
          box-shadow: none !important; color: #3b82f6 !important;
          font-family: monospace !important; font-size: 7px !important;
          font-weight: bold !important; text-transform: uppercase !important;
          letter-spacing: 0.12em !important;
        }
        .leaflet-popup-tip-container { display: none !important; }
        @keyframes ping {
          75%, 100% { transform: scale(2.2); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
