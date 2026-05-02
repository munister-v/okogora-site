import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, LayersControl, useMapEvents, Polyline, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Crosshair, Map as MapIcon, Maximize, Shield, Target, Anchor, Plane, Layers, Info, Filter, Menu, X as CloseIcon, Navigation, Ruler, Activity, Clock, Database } from 'lucide-react';

// Custom OSINT-style markers
const createTacticalIcon = (color: string, label: string) => new L.DivIcon({
  className: 'tactical-marker',
  html: `
    <div class="relative group">
      <div class="animate-ping absolute inset-0 rounded-full bg-${color}/20" style="background-color: ${color}33"></div>
      <div style="width: 14px; height: 14px; background-color: ${color}; border: 2px solid #fff; border-radius: 50%; box-shadow: 0 0 15px ${color}; position: relative; z-index: 10;"></div>
      <div class="absolute left-6 top-1/2 -translate-y-1/2 bg-[#111111]/95 text-white text-[8px] font-mono px-2 py-0.5 whitespace-nowrap border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity z-50">
        ${label}
      </div>
    </div>
  `,
  iconSize: [14, 14],
  iconAnchor: [7, 7]
});

const strikeIcon = createTacticalIcon('#ff3333', 'ПІДТВЕРДЖЕНЕ_УРАЖЕННЯ');
const navyIcon = createTacticalIcon('#3399ff', 'МОРСЬКА_ЦІЛЬ');
const airbaseIcon = createTacticalIcon('#ffcc00', 'АВІАБАЗА_ОККУПАНТА');
const logisticsIcon = createTacticalIcon('#00ff66', 'ЛОГІСТИЧНИЙ_ВУЗОЛ');

function MapEvents({ onMouseMove, onClick }: { onMouseMove: (lat: number, lng: number) => void, onClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    mousemove(e) {
      onMouseMove(e.latlng.lat, e.latlng.lng);
    },
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng);
    }
  });
  return null;
}

export default function MapService() {
  const [activeFilters, setActiveFilters] = useState(['strikes', 'navy', 'airbases', 'logistics']);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [telemetry, setTelemetry] = useState({ lat: 45.0, lng: 35.0 });
  const [measurePoints, setMeasurePoints] = useState<[number, number][]>([]);
  const [distance, setDistance] = useState<number | null>(null);

  const toggleFilter = (filter: string) => {
    setActiveFilters(prev => 
      prev.includes(filter) ? prev.filter(f => f !== filter) : [...prev, filter]
    );
  };

  const calculateDistance = (p1: [number, number], p2: [number, number]) => {
    const lat1 = p1[0], lon1 = p1[1], lat2 = p2[0], lon2 = p2[1];
    const R = 6371; // km
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

  const mapCenter: [number, number] = [45.5, 36.5];

  // Strike database
  const strikes = [
    { id: 1, pos: [44.1132, 39.0825] as [number, number], name: 'Туапсе (НПЗ)', date: '27.04.2026', bda: '61% КРИТИЧНО', intel: 'SENTINEL-2 / OSINT_CONFIRMED' },
    { id: 2, pos: [44.6167, 33.5250] as [number, number], name: 'Севастополь (Бухта)', date: '26.04.2026', bda: 'ВДК ПОВАЛЕНИЙ', intel: 'SAR_INTEL / LOCAL_DRONES' },
    { id: 3, pos: [45.3422, 32.5122] as [number, number], name: 'Оленівка (ППО)', date: '25.04.2026', bda: 'С-400 ЗНИЩЕНО', intel: 'FIRM_THERMAL / RECON' },
  ];

  return (
    <div className="w-full flex flex-col font-sans">
      <div className="flex justify-between items-center mb-4 md:mb-6 font-mono text-[10px] md:text-xs uppercase tracking-[0.2em] border-b border-[#111111] pb-3">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-ping" />
          <MapIcon className="w-4 h-4" />
          <span className="font-bold">ТАКТИЧНИЙ МОНІТОР v3.0 // OKO_GORA_INTEL</span>
        </div>
        <div className="flex items-center gap-4 md:gap-6 text-[#111111]/50">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="flex items-center gap-2 bg-[#111111] text-white px-3 py-1 text-[9px] hover:bg-zinc-800 transition-colors"
          >
            {isSidebarOpen ? <CloseIcon className="w-3 h-3" /> : <Menu className="w-3 h-3" />}
            {isSidebarOpen ? 'ПРИХОВАТИ_UI' : 'ПОКАЗАТИ_UI'}
          </button>
          <div className="flex items-center gap-2 text-red-500 font-bold border-l border-[#111111]/10 pl-4 animate-pulse">
            <Activity className="w-3 h-3" />
            <span>LIVE</span>
          </div>
        </div>
      </div>
      
      <div className="relative w-full h-[500px] md:h-[800px] bg-[#0a0a0a] border border-[#111111]/20 overflow-hidden group shadow-2xl">
        {/* Sidebar Controls */}
        <div className={`absolute top-4 md:top-6 left-4 md:left-6 z-[400] w-64 md:w-72 space-y-4 transition-all duration-700 ease-in-out ${isSidebarOpen ? 'translate-x-0 opacity-100' : '-translate-x-[120%] opacity-0 pointer-events-none'}`}>
          <div className="bg-[#111111]/95 backdrop-blur-xl border border-[#f4f4f4]/10 p-5 shadow-2xl">
            <div className="flex items-center gap-2 mb-5 border-b border-[#f4f4f4]/10 pb-3">
              <Filter className="w-3 h-3 text-blue-400" />
              <span className="font-mono text-[10px] uppercase tracking-widest text-white/80">Тактичні Фільтри</span>
            </div>
            <div className="space-y-2.5">
              {[
                { id: 'strikes', label: 'Удари / BDA', color: 'bg-[#ff3333]', icon: Target },
                { id: 'navy', label: 'Морські цілі', color: 'bg-[#3399ff]', icon: Anchor },
                { id: 'airbases', label: 'Авіабази РФ', color: 'bg-[#ffcc00]', icon: Plane },
                { id: 'logistics', label: 'Логістика', color: 'bg-[#00ff66]', icon: Shield },
              ].map(f => (
                <button 
                  key={f.id}
                  onClick={() => toggleFilter(f.id)}
                  className={`w-full flex items-center justify-between p-2.5 font-mono text-[9px] uppercase tracking-widest transition-all border ${activeFilters.includes(f.id) ? 'border-[#f4f4f4]/30 bg-[#f4f4f4]/10 text-white shadow-[0_0_10px_rgba(255,255,255,0.05)]' : 'border-transparent text-white/30 hover:text-white/50'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-1.5 h-1.5 rounded-full ${activeFilters.includes(f.id) ? f.color : 'bg-zinc-700 opacity-50'}`} />
                    <span className={activeFilters.includes(f.id) ? 'font-bold' : ''}>{f.label}</span>
                  </div>
                  <f.icon className={`w-3.5 h-3.5 transition-opacity ${activeFilters.includes(f.id) ? 'opacity-80' : 'opacity-20'}`} />
                </button>
              ))}
            </div>
          </div>

          <div className="bg-[#111111]/95 backdrop-blur-xl border border-[#f4f4f4]/10 p-5 shadow-2xl">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-3 h-3 text-green-400" />
              <span className="font-mono text-[10px] uppercase tracking-widest text-white/80">Останні Події</span>
            </div>
            <div className="space-y-2 text-[9px] font-mono text-[#f4f4f4]/50">
              <div className="flex justify-between items-center border-b border-white/5 pb-1">
                <span>UA_DRONE_VOL_4</span>
                <span className="text-green-500">УСПІШНО</span>
              </div>
              <div className="flex justify-between items-center border-b border-white/5 pb-1">
                <span>STRIKE_SEV_HBR</span>
                <span className="text-red-500">BDA_NEEDED</span>
              </div>
            </div>
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

        {/* Telemetry Panel */}
        <div className="absolute bottom-6 left-6 z-[400] bg-[#111111]/90 text-[#f4f4f4] p-5 font-mono border border-[#f4f4f4]/10 backdrop-blur-md pointer-events-none shadow-2xl">
          <div className="flex items-center gap-3 mb-4 border-b border-[#f4f4f4]/10 pb-3">
            <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
            <span className="tracking-widest uppercase text-[10px] font-bold opacity-90">ТЕЛЕМЕТРІЯ_ЦІЛЕВКАЗАННЯ</span>
          </div>
          <div className="space-y-2.5 text-[10px]">
            <div className="flex justify-between gap-12 border-b border-white/5 pb-1">
              <span className="opacity-30">ШИРОТА</span>
              <span className="font-bold text-white/80 tracking-tighter">{telemetry.lat.toFixed(6)}° N</span>
            </div>
            <div className="flex justify-between gap-12 border-b border-white/5 pb-1">
              <span className="opacity-30">ДОВГОТА</span>
              <span className="font-bold text-white/80 tracking-tighter">{telemetry.lng.toFixed(6)}° E</span>
            </div>
            <div className="flex justify-between gap-12 text-[9px] pt-1">
              <span className="opacity-30 text-blue-400 font-bold">GRID</span>
              <span className="text-blue-400/80">36T XQ 4421 8841</span>
            </div>
          </div>
        </div>

        <MapContainer 
          center={mapCenter} 
          zoom={6} 
          scrollWheelZoom={true} 
          className="w-full h-full z-0 cursor-crosshair"
          zoomControl={false}
        >
          <LayersControl position="bottomright">
            <LayersControl.BaseLayer name="Тактична Темна">
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                attribution='&copy; CARTO'
              />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer checked name="Супутниковий Intel">
              <TileLayer
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                attribution='&copy; ESRI'
              />
            </LayersControl.BaseLayer>
          </LayersControl>
          
          <MapEvents 
            onMouseMove={(lat, lng) => setTelemetry({ lat, lng })}
            onClick={(lat, lng) => handleMapClick(lat, lng)}
          />

          {/* Distance Line */}
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
            <Circle key={i} center={p} radius={100} pathOptions={{ color: '#f97316', fillColor: '#f97316', fillOpacity: 0.5 }} />
          ))}

          {/* Striking Trajectories (Visual) */}
          {activeFilters.includes('strikes') && (
            <>
              <Polyline 
                positions={[[48.0, 35.0], [44.1132, 39.0825]]} 
                pathOptions={{ color: '#ff3333', weight: 1, dashArray: '5, 10', opacity: 0.3 }} 
              />
              <Polyline 
                positions={[[46.5, 32.5], [44.6167, 33.5250]]} 
                pathOptions={{ color: '#ff3333', weight: 1, dashArray: '5, 10', opacity: 0.3 }} 
              />
            </>
          )}

          {/* Strikes Data Markers */}
          {activeFilters.includes('strikes') && strikes.map(s => (
            <Marker key={s.id} position={s.pos} icon={strikeIcon}>
              <Popup className="tactical-popup">
                <div className="font-mono p-3 bg-[#111111] text-white border border-white/10 min-w-[200px]">
                  <div className="flex justify-between items-start mb-2 border-b border-red-500/30 pb-2">
                    <h5 className="font-bold text-red-500 uppercase text-xs tracking-tight">{s.name}</h5>
                    <span className="text-[8px] bg-red-500/20 px-1 text-red-400">УРАЖЕННЯ</span>
                  </div>
                  <div className="space-y-2 text-[9px]">
                    <div className="flex justify-between">
                      <span className="opacity-40 uppercase">Дата:</span>
                      <span className="font-bold">{s.date}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="opacity-40 uppercase">Статус BDA:</span>
                      <span className="text-green-400 font-bold">{s.bda}</span>
                    </div>
                    <div className="pt-2 mt-2 border-t border-white/5 opacity-60 italic text-[8px] leading-relaxed">
                      SOURCE: {s.intel}
                    </div>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Naval Assets Simulation */}
          {activeFilters.includes('navy') && (
            <Circle center={[44.5, 33.8]} radius={5000} pathOptions={{ color: '#3399ff', fillOpacity: 0.1, weight: 1 }}>
              <Tooltip permanent direction="top" className="tactical-label">АКВАТОРІЯ_ЗАГРОЗИ</Tooltip>
            </Circle>
          )}

          {/* Heatmap Area Simulation (Combat Activity) */}
          <Circle 
            center={[46.5, 36.5]} 
            radius={80000} 
            pathOptions={{ color: '#ff3333', fillColor: '#ff3333', fillOpacity: 0.05, weight: 0 }} 
          />
          
        </MapContainer>
        
        {/* Scanline Overlay */}
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
        .tactical-label {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          color: #3399ff !important;
          font-family: monospace !important;
          font-size: 8px !important;
          font-weight: bold !important;
          text-transform: uppercase !important;
          letter-spacing: 0.1em !important;
        }
      `}</style>
    </div>
  );
}
