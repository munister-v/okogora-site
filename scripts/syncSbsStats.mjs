import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const DB_URL = 'https://raw.githubusercontent.com/foosint/sbs-stats/main/data/sbs.db';
const SOURCE_URL = 'https://foosint.github.io/sbs-stats/';
const OUTPUT_PATH = path.resolve('public/data/sbs_stats_snapshot.json');

const CATEGORIES = [
  [1, 'Танки'],
  [2, 'ББМ / БМП / БТР'],
  [3, 'Гармати / гаубиці'],
  [4, 'Самохідна артилерія'],
  [5, 'РСЗВ'],
  [7, 'Легка / важка техніка'],
  [18, 'Мотоцикли / багі'],
  [21, 'Укриття'],
  [22, 'Бліндажі'],
  [25, 'Крила противника'],
  [30, 'Shahed'],
  [31, 'Gerbera'],
  [32, 'ЗРК / ППО'],
];

function num(row, key) {
  return Number(row?.[key] || 0);
}

async function sqliteJson(dbPath, sql) {
  const { stdout } = await execFileAsync('sqlite3', ['-json', dbPath, sql], {
    maxBuffer: 30 * 1024 * 1024,
  });
  return stdout.trim() ? JSON.parse(stdout) : [];
}

function normalizeRows(rows) {
  const byDate = new Map();
  for (const row of rows) {
    const prev = byDate.get(row.date);
    if (!prev || Number(row.hour || 0) > Number(prev.hour || 0)) {
      byDate.set(row.date, row);
    }
  }
  return Array.from(byDate.values()).sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

async function main() {
  const response = await fetch(DB_URL, {
    headers: { 'User-Agent': 'okogora-sbs-sync/1.0' },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`SBS DB request failed: ${response.status}`);
  }

  const dbPath = path.join(os.tmpdir(), `okogora-sbs-${Date.now()}.db`);
  await fs.writeFile(dbPath, new Uint8Array(await response.arrayBuffer()));

  const rawDaily = await sqliteJson(dbPath, 'SELECT * FROM daily_stats ORDER BY date DESC, hour DESC LIMIT 220;');
  const dailyRows = normalizeRows(rawDaily).slice(0, 21);
  const monthlyRows = await sqliteJson(dbPath, 'SELECT * FROM monthly_stats ORDER BY date DESC LIMIT 6;');
  const latest = dailyRows[0] || {};

  const categories = CATEGORIES.map(([id, label]) => ({
    id,
    label,
    hit: num(latest, `hit_${id}`),
    destroyed: num(latest, `destroyed_${id}`),
  }))
    .filter((item) => item.hit > 0 || item.destroyed > 0)
    .sort((a, b) => (b.hit + b.destroyed) - (a.hit + a.destroyed));

  const payload = {
    generatedAt: new Date().toISOString(),
    sourceUrl: SOURCE_URL,
    dbUrl: DB_URL,
    latestDate: latest.date || '',
    latestHour: Number(latest.hour || 0),
    collectedAt: latest.data_collected_at || '',
    summary: {
      personnelKilled: num(latest, 'personnel_killed'),
      personnelWounded: num(latest, 'personnel_wounded'),
      personnelCasualties: num(latest, 'total_personnel_casualties'),
      targetsHit: num(latest, 'total_targets_hit'),
      targetsDestroyed: num(latest, 'total_targets_destroyed'),
    },
    categories,
    daily: dailyRows.map((row) => ({
      date: row.date,
      hour: Number(row.hour || 0),
      targetsHit: num(row, 'total_targets_hit'),
      targetsDestroyed: num(row, 'total_targets_destroyed'),
      personnelCasualties: num(row, 'total_personnel_casualties'),
    })),
    monthly: monthlyRows.map((row) => ({
      date: row.date,
      targetsHit: num(row, 'total_targets_hit'),
      targetsDestroyed: num(row, 'total_targets_destroyed'),
      personnelCasualties: num(row, 'total_personnel_casualties'),
    })),
    methodology: [
      'Дані беруться з публічної SQLite-бази foosint/sbs-stats.',
      'Для поточної доби використовується остання доступна година у daily_stats.',
      'Категорії показані тільки там, де зафіксовано hit або destroyed.',
    ],
  };

  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.writeFile(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`Wrote ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
