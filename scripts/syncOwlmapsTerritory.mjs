import { writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { unzip } from 'fflate';

const require = createRequire(import.meta.url);
const { DOMParser } = require('@xmldom/xmldom');
const { kml } = require('@tmcw/togeojson');

const KMZ_URL = 'https://raw.githubusercontent.com/owlmaps/UAControlMapBackups/latest/latest.kmz';
const OUTPUT_PATH = 'public/data/territory_geojson.json';

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

const featureCount = geojson.features?.length ?? 0;
console.log(`Converted: ${featureCount} features`);

await writeFile(OUTPUT_PATH, JSON.stringify(geojson), 'utf-8');
const sizeKb = Math.round(JSON.stringify(geojson).length / 1024);
console.log(`Written ${OUTPUT_PATH} (${sizeKb} KB, ${featureCount} features)`);
