import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, LayersControl, useMapEvents, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Crosshair, Map as MapIcon, Maximize, Shield, Target, Anchor, Plane, Layers, Info, Filter, Menu, X as CloseIcon, Navigation } from 'lucide-react';

// Custom OSINT-style markers
const createTacticalIcon = (color: string, label: string) => new L.DivIcon({
  className: 'tactical-marker',
  html: `
    <div class="relative group">
      <div style="width: 14px; height: 14px; background-color: ${color}; border: 2px solid #fff; border-radius: 50%; box-shadow: 0 0 15px ${color};"></div>
      <div class="absolute left-6 top-1/2 -translate-y-1/2 bg-[#111111]/90 text-white text-[8px] font-mono px-2 py-0.5 whitespace-nowrap border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
        ${label}
      </div>
    </div>
  `,
  iconSize: [14, 14],
  iconAnchor: [7, 7]
});

const strikeIcon = createTacticalIcon('#ff3333', 'CONFIRMED_STRIKE');
const navyIcon = createTacticalIcon('#3399ff', 'NAVAL_ASSET');
const airbaseIcon = createTacticalIcon('#ffcc00', 'AIR_INTELLIGENCE');
const logisticsIcon = createTacticalIcon('#00ff66', 'LOGISTICS_HUB');

function MapOverlay() {
  const [coords, setCoords] = useState({ lat: 46.5, lng: 36.5 });
  
  useMapEvents({
    mousemove(e) {
      setCoords({ lat: e.latlng.lat, lng: e.latlng.lng });
    }
  });

  return (
    <div className="absolute bottom-4 md:bottom-6 left-4 md:left-6 z-[400] bg-[#111111]/90 text-[#f4f4f4] p-3 md:p-4 font-mono text-[9px] md:text-[10px] border border-[#f4f4f4]/20 backdrop-blur-md pointer-events-none shadow-2xl">
      <div className="flex items-center gap-2 mb-2 md:mb-3 border-b border-[#f4f4f4]/10 pb-2">
        <Crosshair className="w-3 h-3 text-red-500 animate-pulse" />
        <span className="tracking-widest uppercase opacity-70">Live Telemetry</span>
      </div>
      <div className="space-y-1.5 md:space-y-2">
        <div className="flex justify-between gap-6 md:gap-8">
          <span className="opacity-40">LAT</span>
          <span className="font-bold">{coords.lat.toFixed(6)}° N</span>
        </div>
        <div className="flex justify-between gap-6 md:gap-8">
          <span className="opacity-40">LNG</span>
          <span className="font-bold">{coords.lng.toFixed(6)}° E</span>
        </div>
      </div>
    </div>
  );
}

export default function MapService() {
  const [activeFilters, setActiveFilters] = useState(['strikes', 'navy', 'airbases', 'logistics']);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const toggleFilter = (filter: string) => {
    setActiveFilters(prev => 
      prev.includes(filter) ? prev.filter(f => f !== filter) : [...prev, filter]
    );
  };

  const mapCenter: [number, number] = [45.5, 36.5];

  // Missile trajectories coordinates
  const trajectories = [
    { from: [48.0, 35.0] as [number, number], to: [44.1132, 39.0825] as [number, number], color: '#ff3333' }, // To Tuapse
    { from: [46.5, 32.5] as [number, number], to: [44.6167, 33.5250] as [number, number], color: '#ff3333' }, // To Sevastopol
  ];

  return (
    <div className="w-full flex flex-col">
      <div className="flex justify-between items-center mb-4 md:mb-6 font-mono text-[10px] md:text-xs uppercase tracking-[0.2em] border-b border-[#111111] pb-3">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-ping" />
          <MapIcon className="w-4 h-4" />
          <span className="font-bold hidden sm:inline">Інтерактивна Топографія v2.5</span>
          <span className="font-bold sm:hidden">MAP_V2.5</span>
        </div>
        <div className="flex items-center gap-4 md:gap-6 text-[#111111]/50">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="flex items-center gap-2 bg-[#111111] text-white px-3 py-1 text-[9px] hover:opacity-80 transition-opacity"
          >
            {isSidebarOpen ? <CloseIcon className="w-3 h-3" /> : <Menu className="w-3 h-3" />}
            {isSidebarOpen ? 'HIDE_UI' : 'SHOW_UI'}
          </button>
          <Maximize className="w-3 h-3 cursor-pointer hover:text-[#111111] transition-colors hidden xs:block" />
        </div>
      </div>
      
      <div className="relative w-full h-[500px] md:h-[750px] bg-[#0a0a0a] border border-[#111111]/20 overflow-hidden group shadow-inner">
        {/* Sidebar Controls */}
        <div className={`absolute top-4 md:top-6 left-4 md:left-6 z-[400] w-56 md:w-64 space-y-4 transition-all duration-500 ${isSidebarOpen ? 'translate-x-0 opacity-100' : '-translate-x-[120%] opacity-0'}`}>
          <div className="bg-[#111111]/90 backdrop-blur-md border border-[#f4f4f4]/20 p-4 md:p-5 shadow-2xl">
            <div className="flex items-center gap-2 mb-4 border-b border-[#f4f4f4]/10 pb-2">
              <Filter className="w-3 h-3 opacity-50" />
              <span className="font-mono text-[9px] md:text-[10px] uppercase tracking-widest opacity-70">Tactical Filters</span>
            </div>
            <div className="space-y-2 md:space-y-3">
              {[
                { id: 'strikes', label: 'Strikes / BDA', color: 'bg-[#ff3333]', icon: Target },
                { id: 'navy', label: 'Naval Assets', color: 'bg-[#3399ff]', icon: Anchor },
                { id: 'airbases', label: 'Air Intelligence', color: 'bg-[#ffcc00]', icon: Plane },
                { id: 'logistics', label: 'Logistics Hubs', color: 'bg-[#00ff66]', icon: Shield },
              ].map(f => (
                <button 
                  key={f.id}
                  onClick={() => toggleFilter(f.id)}
                  className={`w-full flex items-center justify-between p-2 font-mono text-[8px] md:text-[9px] uppercase tracking-widest transition-all border ${activeFilters.includes(f.id) ? 'border-[#f4f4f4]/30 bg-[#f4f4f4]/10 text-white' : 'border-transparent text-white/30 hover:text-white/60'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-1 h-1 md:w-1.5 md:h-1.5 rounded-full ${activeFilters.includes(f.id) ? f.color : 'bg-zinc-700'}`} />
                    <span>{f.label}</span>
                  </div>
                  <f.icon className="w-3 h-3 opacity-40" />
                </button>
              ))}
            </div>
          </div>

          <div className="bg-[#111111]/90 backdrop-blur-md border border-[#f4f4f4]/20 p-4 md:p-5 shadow-2xl hidden sm:block">
            <div className="flex items-center gap-2 mb-3">
              <Navigation className="w-3 h-3 opacity-50" />
              <span className="font-mono text-[10px] uppercase tracking-widest opacity-70">Active Trajectories</span>
            </div>
            <div className="space-y-1 text-[8px] md:text-[9px] font-mono text-[#f4f4f4]/60">
              <p>UA_STRIKE_PATH_01: ACTIVE</p>
              <p>UA_STRIKE_PATH_02: ACTIVE</p>
            </div>
          </div>
        </div>

        <MapContainer 
          center={mapCenter} 
          zoom={6} 
          scrollWheelZoom={false} 
          className="w-full h-full z-0 cursor-crosshair"
          zoomControl={false}
        >
          <LayersControl position="bottomright">
            <LayersControl.BaseLayer name="Tactical Dark">
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                attribution='&copy; CARTO'
              />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer checked name="Satellite Intel">
              <TileLayer
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                attribution='&copy; ESRI'
              />
            </LayersControl.BaseLayer>
          </LayersControl>
          
          <MapOverlay />

          {/* Missile Trajectories */}
          {activeFilters.includes('strikes') && trajectories.map((path, idx) => (
            <Polyline 
              key={idx}
              positions={[path.from, path.to]}
              pathOptions={{ color: path.color, weight: 1, dashArray: '5, 10', opacity: 0.5 }}
            />
          ))}

          {/* Strikes Data */}
          {activeFilters.includes('strikes') && (
            <>
              <Marker position={[44.1132, 39.0825]} icon={strikeIcon}>
                <Popup className="tactical-popup">
                  <div className="font-mono p-1">
                    <h5 className="font-bold text-red-500 uppercase mb-1 text-xs">Target: Tuapse</h5>
                    <p className="text-[9px] leading-tight">Impact verified via satellite.</p>
                  </div>
                </Popup>
              </Marker>
              <Marker position={[44.6167, 33.5250]} icon={strikeIcon}>
                <Popup className="tactical-popup">
                  <div className="font-mono p-1">
                    <h5 className="font-bold text-red-500 uppercase mb-1 text-xs">Target: Sevastopol</h5>
                    <p className="text-[9px] leading-tight">Naval assets compromised.</p>
                  </div>
                </Popup>
              </Marker>
            </>
          )}

          {/* Naval Assets */}
          {activeFilters.includes('navy') && (
            <Marker position={[44.5, 33.8]} icon={navyIcon}>
              <Popup className="tactical-popup">
                <div className="font-mono p-1 text-[9px]">Project 22160 Class Vessel</div>
              </Popup>
            </Marker>
          )}

          {/* Air Intelligence */}
          {activeFilters.includes('airbases') && (
            <Marker position={[44.6853, 33.5858]} icon={airbaseIcon}>
              <Popup className="tactical-popup">
                <div className="font-mono p-1 text-[9px]">Belbek Airbase: MiG-31K Units</div>
              </Popup>
            </Marker>
          )}
          
        </MapContainer>
        
        {/* Animated Trajectory Overlay Effect (Visual only) */}
        <div className="absolute inset-0 pointer-events-none z-[450] opacity-20 overflow-hidden">
           <div className="absolute top-1/2 left-1/4 w-[600px] h-[1px] bg-red-500 rotate-[-15deg] animate-[missile_3s_linear_infinite]" />
        </div>
      </div>

      <style>{`
        @keyframes missile {
          0% { transform: translateX(-100%) rotate(-15deg); opacity: 0; }
          50% { opacity: 1; }
          100% { transform: translateX(200%) rotate(-15deg); opacity: 0; }
        }
        .leaflet-container {
          background: #0a0a0a !important;
        }
        .tactical-popup .leaflet-popup-content-wrapper {
          background: #111 !important;
          color: #f4f4f4 !important;
          border-radius: 0 !important;
          border: 1px solid rgba(244,244,244,0.2) !important;
        }
        .leaflet-popup-tip {
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
      `}</style>
    </div>
  );
}
