import { unzip, deflateSync, strToU8 } from 'fflate';
import { kml } from '@tmcw/togeojson';

const KMZ_URL = 'https://raw.githubusercontent.com/owlmaps/UAControlMapBackups/latest/latest.kmz';

async function run() {
  try {
    const res = await fetch(KMZ_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = await res.arrayBuffer();

    const files = await new Promise<Record<string, Uint8Array>>((resolve, reject) =>
      unzip(new Uint8Array(buf), (err, data) => (err ? reject(err) : resolve(data)))
    );

    const kmlKey = Object.keys(files).find((k) => k.endsWith('.kml'));
    if (!kmlKey) throw new Error('No KML in archive');

    const kmlText = new TextDecoder().decode(files[kmlKey]);
    const xmlDoc = new DOMParser().parseFromString(kmlText, 'text/xml');
    const geojson = kml(xmlDoc);

    // Compress for caching — transfer buffer to avoid copy
    const compressed = deflateSync(strToU8(JSON.stringify(geojson)));
    self.postMessage({ type: 'success', geojson, compressed }, [compressed.buffer]);
  } catch (e) {
    self.postMessage({ type: 'error', message: String(e) });
  }
}

run();
