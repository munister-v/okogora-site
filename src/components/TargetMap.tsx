import { useEffect, useMemo, useRef } from 'react';
import type { Target } from '../pages/TargetsPage';

const STATUS_COLORS: Record<string, string> = {
  active: '#ef4444',
  damaged: '#eab308',
  destroyed: '#22c55e',
};

const TYPE_ICONS: Record<string, string> = {
  npz: '⛽',
  airbase: '✈',
  navy: '⚓',
  ammo: '💥',
  radar: '📡',
  military: '🎯',
  logistics: '🚂',
  energy: '⚡',
  industry: '🏭',
};

interface Props {
  targets: Target[];
  selected: Target | null;
  onSelect: (t: Target | null) => void;
}

export default function TargetMap({ targets, selected, onSelect }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    import('leaflet').then(L => {
      const map = L.map(mapRef.current!, {
        center: [55, 50],
        zoom: 4,
        zoomControl: true,
        attributionControl: false,
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 18,
      }).addTo(map);

      mapInstanceRef.current = { map, L };
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.map.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!mapInstanceRef.current) {
      const interval = setInterval(() => {
        if (mapInstanceRef.current) {
          clearInterval(interval);
          renderMarkers();
        }
      }, 200);
      return () => clearInterval(interval);
    }
    renderMarkers();
  }, [targets, selected]);

  function renderMarkers() {
    if (!mapInstanceRef.current) return;
    const { map, L } = mapInstanceRef.current;

    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    targets.forEach(t => {
      const color = STATUS_COLORS[t.status] || '#888';
      const emoji = TYPE_ICONS[t.type] || '●';
      const isSelected = selected?.id === t.id;
      const size = isSelected ? 36 : 28;

      const icon = L.divIcon({
        className: '',
        html: `<div style="
          width:${size}px;height:${size}px;
          background:${color}22;
          border:${isSelected ? '2px' : '1px'} solid ${color};
          border-radius:4px;
          display:flex;align-items:center;justify-content:center;
          font-size:${isSelected ? '16px' : '13px'};
          cursor:pointer;
          box-shadow: 0 0 ${isSelected ? '12px' : '4px'} ${color}66;
          transition: all 0.2s;
        ">${emoji}</div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });

      const marker = L.marker([t.lat, t.lng], { icon })
        .addTo(map)
        .on('click', () => onSelect(t));

      marker.bindTooltip(
        `<div style="font-family:monospace;font-size:11px;background:#111;color:#f4f4f4;border:1px solid ${color};padding:6px 10px;border-radius:2px">
          <div style="color:${color};text-transform:uppercase;font-size:9px;letter-spacing:0.15em;margin-bottom:4px">${t.status.toUpperCase()}</div>
          <strong>${t.name}</strong><br/>
          <span style="color:#888;font-size:10px">${t.region}</span>
        </div>`,
        { className: 'target-tooltip', direction: 'top', offset: [0, -size / 2 - 4] }
      );

      markersRef.current.push(marker);
    });
  }

  useEffect(() => {
    if (selected && mapInstanceRef.current) {
      mapInstanceRef.current.map.setView([selected.lat, selected.lng], 8, { animate: true });
    }
  }, [selected]);

  return (
    <div className="relative w-full h-[600px] border border-white/10">
      <div ref={mapRef} className="w-full h-full" />
      <style>{`
        .target-tooltip { background: transparent !important; border: none !important; box-shadow: none !important; }
        .target-tooltip .leaflet-tooltip-content { padding: 0; }
        .leaflet-tooltip-top:before { display: none; }
      `}</style>
      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-[400] bg-[#050517]/90 border border-white/10 p-3 backdrop-blur-sm">
        <div className="font-mono text-[9px] uppercase tracking-widest text-white/40 mb-2">Статус</div>
        {Object.entries(STATUS_COLORS).map(([s, c]) => (
          <div key={s} className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-sm" style={{ background: c }} />
            <span className="font-mono text-[9px] uppercase tracking-widest" style={{ color: c }}>
              {s === 'active' ? 'Активний' : s === 'damaged' ? 'Пошкоджено' : 'Знищено'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
