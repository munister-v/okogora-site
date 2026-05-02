#!/usr/bin/env node
/**
 * Fetches posts from an RSS feed and adds new ones to public/data/posts.json
 * Translates text to Ukrainian using MyMemory API if source language differs.
 *
 * Usage: node scripts/import-rss.mjs <rss_url> [count]
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const RSS_URL = process.argv[2];
const COUNT = parseInt(process.argv[3] || '10', 10);
const POSTS_FILE = join(ROOT, 'public', 'data', 'posts.json');
const IMAGES_DIR = join(ROOT, 'images');

if (!RSS_URL) {
  console.error('Usage: node scripts/import-rss.mjs <rss_url> [count]');
  process.exit(1);
}

const UK_MONTHS = ['СІЧ','ЛЮТ','БЕР','КВІТ','ТРАВ','ЧЕР','ЛИП','СЕР','ВЕР','ЖОВ','ЛИС','ГРУ'];

function formatDate(dateStr) {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const day = String(d.getDate()).padStart(2, '0');
    const mon = UK_MONTHS[d.getMonth()];
    const year = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${day} ${mon} ${year} / ${hh}:${mm}`;
  } catch {
    return '';
  }
}

function stripHtml(html) {
  return (html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function extractImageFromDescription(desc) {
  const m = (desc || '').match(/<img[^>]+src=["']([^"']+)["']/i);
  return m ? m[1] : '';
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; okogora-bot/1.0)' }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

async function fetchBuffer(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; okogora-bot/1.0)' }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

// Translate text to Ukrainian via MyMemory free API
async function translateToUk(text, fromLang = 'ru') {
  if (!text || fromLang === 'uk') return text;
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.slice(0, 500))}&langpair=${fromLang}|uk`;
    const res = await fetch(url);
    if (!res.ok) return text;
    const data = await res.json();
    return data?.responseData?.translatedText || text;
  } catch {
    return text;
  }
}

function parseRss(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const item = match[1];
    const get = (tag) => {
      const m = item.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`, 'i'))
        || item.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'i'));
      return m ? m[1].trim() : '';
    };
    const title = get('title');
    const link = get('link');
    const description = get('description');
    const pubDate = get('pubDate') || get('dc:date') || get('published');
    const enclosureM = item.match(/<enclosure[^>]+url=["']([^"']+)["'][^>]*type=["']image[^"']*["']/i)
      || item.match(/<enclosure[^>]+type=["']image[^"']*["'][^>]+url=["']([^"']+)["']/i);
    const enclosureUrl = enclosureM ? enclosureM[1] : '';
    const mediaM = item.match(/<media:content[^>]+url=["']([^"']+)["']/i)
      || item.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i);
    const mediaUrl = mediaM ? mediaM[1] : '';
    const imageInDesc = extractImageFromDescription(description);
    const image = enclosureUrl || mediaUrl || imageInDesc;

    // Build a stable ID from link or title
    const rawId = link || title;
    const id = 'RSS-' + Buffer.from(rawId).toString('base64').slice(0, 16).replace(/[^a-zA-Z0-9]/g, '');

    items.push({ id, title: stripHtml(title), description: stripHtml(description), link, pubDate, image });
  }
  return items;
}

async function main() {
  console.log(`Fetching RSS: ${RSS_URL}`);
  const xml = await fetchText(RSS_URL);
  const items = parseRss(xml);
  console.log(`Parsed ${items.length} items`);

  if (!items.length) { console.log('No items found.'); process.exit(0); }

  let existing = [];
  try { existing = JSON.parse(readFileSync(POSTS_FILE, 'utf8')); } catch {}
  const existingIds = new Set(existing.map(p => p.id));

  mkdirSync(IMAGES_DIR, { recursive: true });

  const newPosts = [];
  for (const item of items.slice(0, COUNT)) {
    if (existingIds.has(item.id)) {
      console.log(`  skip ${item.id}`);
      continue;
    }

    // Translate title and description to Ukrainian
    const title = await translateToUk(item.title);
    const text = await translateToUk(item.description);
    const date = formatDate(item.pubDate);

    let imageFilename = '';
    if (item.image) {
      try {
        const ext = item.image.split('.').pop().split('?')[0].toLowerCase() || 'jpg';
        const safeExt = ['jpg','jpeg','png','webp','gif'].includes(ext) ? ext : 'jpg';
        imageFilename = `rss_${item.id.replace('RSS-', '')}.${safeExt}`;
        const buf = await fetchBuffer(item.image);
        writeFileSync(join(IMAGES_DIR, imageFilename), buf);
        console.log(`  saved image: ${imageFilename}`);
      } catch (e) {
        console.warn(`  image failed: ${e.message}`);
        imageFilename = item.image;
      }
    }

    newPosts.push({
      id: item.id,
      date,
      title: title || `Пост ${item.id}`,
      text: text || title,
      image: imageFilename,
      tags: ['rss'],
      sourceUrl: item.link,
    });
    console.log(`  + ${item.id}: ${title.slice(0, 60)}`);
  }

  if (!newPosts.length) { console.log('Nothing new.'); process.exit(0); }

  const updated = [...newPosts, ...existing];
  writeFileSync(POSTS_FILE, JSON.stringify(updated, null, 2));
  console.log(`\nDone. Added ${newPosts.length} posts. Total: ${updated.length}`);
}

main().catch(e => { console.error(e); process.exit(1); });
