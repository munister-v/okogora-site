import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Circle, GeoJSON, LayersControl, Polyline, Tooltip, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import type { PathOptions } from 'leaflet';
import type { Feature, GeoJsonObject } from 'geojson';
import { Map as MapIcon, Menu, X as CloseIcon, Ruler, Activity } from 'lucide-react';

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

export default function MapService() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [telemetry, setTelemetry] = useState({ lat: 45.0, lng: 35.0 });
  const [measurePoints, setMeasurePoints] = useState<[number, number][]>([]);
  const [distance, setDistance] = useState<number | null>(null);
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
          <span className="font-bold">КАРТА // БЕЗ ТОЧОК ТА ЗОВНІШНІХ ГЕОШАРІВ</span>
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
              ТОЧКОВІ ПОДІЇ ПРИБРАНО. БЛОК `ЗОВНІШНІ ГЕОШАРИ` ТА ЙОГО ДАНІ БІЛЬШЕ НЕ ВІДОБРАЖАЮТЬСЯ.
            </p>
            <div className="mt-4 border border-white/10 bg-white/[0.03] p-3 font-mono text-[9px] text-white/65 leading-relaxed">
              На карті залишено лише базову підкладку, шар контролю території та інструмент вимірювання.
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
              <span className="opacity-30 text-orange-300 font-bold">ВИМІР</span>
              <span className="text-orange-300/90">{measurePoints.length}/2 ТОЧКИ</span>
            </div>
          </div>
        </div>

        <MapContainer
          center={[47.2, 34.6]}
          zoom={6}
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
