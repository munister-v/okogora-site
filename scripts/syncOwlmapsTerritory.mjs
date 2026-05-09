import { writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { unzip } from 'fflate';

const require = createRequire(import.meta.url);
const { DOMParser } = require('@xmldom/xmldom');
const { kml } = require('@tmcw/togeojson');

const KMZ_URL = 'https://raw.githubusercontent.com/owlmaps/UAControlMapBackups/latest/latest.kmz';
const OUTPUT_PATH = 'public/data/territory_geojson.json';

// Round all coordinates to 4 decimal places (~11m precision — enough for map display)
function roundCoord(n) {
  return Math.round(n * 1000) / 1000;
}

function simplifyCoords(coords) {
  if (typeof coords[0] === 'number') return coords.map(roundCoord);
  return coords.map(simplifyCoords);
}

function simplifyFeature(f) {
  const g = f.geometry;
  if (!g || !g.coordinates) return f;
  return { ...f, geometry: { ...g, coordinates: simplifyCoords(g.coordinates) } };
}

// Keep only territory-relevant geometry types — skip 26k+ individual settlement points
const KEEP_TYPES = new Set(['Polygon', 'MultiPolygon', 'LineString', 'MultiLineString', 'GeometryCollection']);

// Strip all properties except those needed for styling
const KEEP_PROPS = ['name', 'description', 'stroke', 'fill', 'stroke-opacity', 'fill-opacity', 'stroke-width'];

function filterProps(props) {
  const out = {};
  for (const key of KEEP_PROPS) {
    if (props[key] != null) out[key] = props[key];
  }
  return out;
}

console.log('Downloading KMZ...');
const res = await fetch(KMZ_URL);
if (!res.ok) throw new Error(`HTTP ${res.status}`);
const buf = await res.arrayBuffer();
console.log(`Downloaded ${(buf.byteLength / 1024 / 1024).toFixed(1)} MB`);

const files = await new Promise((resolve, reject) =>
  unzip(new Uint8Array(buf), (err, data) => (err ? reject(err) : resolve(data)))
);

const kmlKey = Object.keys(files).find((k) => k.endsWith('.kml'));
if (!kmlKey) throw new Error('No KML file in archive');

console.log(`Parsing ${kmlKey}...`);
const kmlText = new TextDecoder().decode(files[kmlKey]);
const doc = new DOMParser().parseFromString(kmlText, 'text/xml');
const geojson = kml(doc);

const before = geojson.features?.length ?? 0;

const filtered = (geojson.features || [])
  .filter((f) => f.geometry && KEEP_TYPES.has(f.geometry.type))
  .map((f) => simplifyFeature({ ...f, properties: filterProps(f.properties || {}) }));

const output = { type: 'FeatureCollection', features: filtered };
const json = JSON.stringify(output);

await writeFile(OUTPUT_PATH, json, 'utf-8');
const sizeKb = Math.round(json.length / 1024);
console.log(`Input: ${before} features → Output: ${filtered.length} features (${sizeKb} KB)`);
