import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { PathOptions } from 'leaflet';
import type { GeoJsonObject, Feature } from 'geojson';

const KMZ_URL = 'https://raw.githubusercontent.com/owlmaps/UAControlMapBackups/latest/latest.kmz';

function featureStyle(feature?: Feature): PathOptions {
  const props = feature?.properties ?? {};
  return {
    color: (props['stroke'] as string) ?? '#c9a227',
    fillColor: (props['fill'] as string) ?? 'transparent',
    opacity: (props['stroke-opacity'] as number) ?? 1,
    fillOpacity: (props['fill-opacity'] as number) ?? 0.35,
    weight: props['stroke-width'] != null ? (props['stroke-width'] as number) * 1.05 : 1.5,
  };
}

async function loadKmz(): Promise<GeoJsonObject> {
  const res = await fetch(KMZ_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = await res.arrayBuffer();

  const { unzip } = await import('fflate');
  const { kml } = await import('@tmcw/togeojson');

  const files = await new Promise<Record<string, Uint8Array>>((resolve, reject) =>
    unzip(new Uint8Array(buf), (err, data) => err ? reject(err) : resolve(data))
  );

  const kmlKey = Object.keys(files).find(k => k.endsWith('.kml'));
  if (!kmlKey) throw new Error('No KML in archive');

  const kmlText = new TextDecoder().decode(files[kmlKey]);
  const xmlDoc = new DOMParser().parseFromString(kmlText, 'text/xml');
  return kml(xmlDoc) as GeoJsonObject;
}

function AutoZoom({ geojson }: { geojson: GeoJsonObject }) {
  const map = useMap();
  const fitted = useRef(false);
  useEffect(() => {
    if (fitted.current) return;
    import('leaflet').then(({ geoJSON }) => {
      try {
        const bounds = geoJSON(geojson).getBounds();
        if (bounds.isValid()) { map.fitBounds(bounds, { padding: [20, 20] }); fitted.current = true; }
      } catch { /* skip */ }
    });
  }, [geojson, map]);
  return null;
}

export default function OwlControlMap() {
  const [geojson, setGeojson] = useState<GeoJsonObject | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    loadKmz()
      .then(data => { setGeojson(data); setStatus('ready'); })
      .catch(e => { setErrorMsg(String(e)); setStatus('error'); });
  }, []);

  return (
    <div className="w-full flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-[#c9a227]">
            КАРТА_КОНТРОЛЮ_TERRITORY
          </span>
          {status === 'loading' && (
            <span className="font-mono text-[9px] text-[#c9a227]/50 animate-pulse">● ЗАВАНТАЖЕННЯ</span>
          )}
          {status === 'ready' && (
            <span className="font-mono text-[9px] text-green-500/70">● ОНЛАЙН</span>
          )}
          {status === 'error' && (
            <span className="font-mono text-[9px] text-red-500/70" title={errorMsg}>● ПОМИЛКА</span>
          )}
        </div>
        <a
          href="https://uacontrolmap.com"
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-[8px] uppercase tracking-widest text-[#c9a227]/40 hover:text-[#c9a227] transition-colors"
        >
          SOURCE: UACONTROLMAP.COM ↗
        </a>
      </div>

      <div className="relative w-full h-[500px] md:h-[700px] border border-[#c9a227]/20 overflow-hidden">
        {status === 'loading' && (
          <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-[#1c1c12]/80 pointer-events-none">
            <div className="text-center">
              <span className="font-mono text-[10px] uppercase tracking-widest text-[#c9a227]/60 animate-pulse block">
                ЗАВАНТАЖЕННЯ_КМZ...
              </span>
              <span className="font-mono text-[8px] text-white/20 block mt-1">
                ~3MB · owlmaps/UAControlMapBackups
              </span>
            </div>
          </div>
        )}
        {status === 'error' && (
          <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-[#1c1c12]/90 pointer-events-none">
            <span className="font-mono text-[10px] uppercase tracking-widest text-red-400/70">
              ПОМИЛКА_ЗАВАНТАЖЕННЯ
            </span>
          </div>
        )}

        <MapContainer
          center={[48.5, 33.0]}
          zoom={6}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={true}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://carto.com">CARTO</a> &copy; <a href="https://openstreetmap.org">OSM</a>'
            subdomains="abcd"
            maxZoom={19}
          />
          {geojson && (
            <>
              <GeoJSON
                key="kmz-layer"
                data={geojson}
                style={featureStyle}
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
              <AutoZoom geojson={geojson} />
            </>
          )}
        </MapContainer>
      </div>

      <div className="flex flex-wrap gap-4 font-mono text-[8px] uppercase tracking-widest text-white/30">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-1.5 bg-[#a52714] opacity-70 rounded-sm" />
          Зайнята РФ
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-1.5 bg-[#01579b] opacity-70 rounded-sm" />
          Контроль України
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-1.5 bg-[#f9a825] opacity-70 rounded-sm" />
          Лінія фронту
        </span>
        <span className="ml-auto text-[#c9a227]/20">
          Дані: Project Owl · uacontrolmap.com · оновлення щодня
        </span>
      </div>
    </div>
  );
}
