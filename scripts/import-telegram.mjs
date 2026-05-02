#!/usr/bin/env node
/**
 * Fetches last N posts from a public Telegram channel (t.me/s/CHANNEL)
 * and prepends new ones to public/data/posts.json
 * Saves images to images/ folder.
 *
 * Usage: node scripts/import-telegram.mjs [channel] [count]
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const CHANNEL = process.argv[2] || 'oko_gora';
const COUNT = parseInt(process.argv[3] || '10', 10);
const POSTS_FILE = join(ROOT, 'public', 'data', 'posts.json');
const IMAGES_DIR = join(ROOT, 'images');

// ── Translation helper ────────────────────────────────────────────────────────

async function translateToUk(text) {
  if (!text || text.trim().length < 5) return text;
  // Detect if text is likely already Ukrainian (contains ї, є, і, ґ)
  if (/[їєґ]/.test(text)) return text;
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.slice(0, 500))}&langpair=ru|uk`;
    const res = await fetch(url);
    if (!res.ok) return text;
    const data = await res.json();
    const t = data?.responseData?.translatedText;
    return (t && t.length > 5) ? t : text;
  } catch {
    return text;
  }
}

// ── HTML parsing helpers ──────────────────────────────────────────────────────

function extractAttr(html, tag, attr) {
  const re = new RegExp(`<${tag}[^>]+${attr}="([^"]+)"`, 'i');
  const m = html.match(re);
  return m ? m[1] : '';
}

function stripTags(html) {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

function parsePosts(html) {
  const posts = [];
  // Split on message boundaries
  const parts = html.split(/(?=<div class="tgme_widget_message\b)/);

  for (const part of parts) {
    // ID
    const idMatch = part.match(/data-post="[^/]+\/(\d+)"/);
    if (!idMatch) continue;
    const id = idMatch[1];

    // Text
    const textMatch = part.match(/<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/);
    const text = textMatch ? stripTags(textMatch[1]).replace(/\n{3,}/g, '\n\n') : '';

    // Image (background-image url)
    const imgMatch = part.match(/background-image:url\('(https:\/\/[^']+)'\)/);
    const image = imgMatch ? imgMatch[1] : '';

    // Date
    const dateMatch = part.match(/datetime="([^"]+)"/);
    let date = '';
    if (dateMatch) {
      const d = new Date(dateMatch[1]);
      const ukMonths = ['СІЧ','ЛЮТ','БЕР','КВІТ','ТРАВ','ЧЕР','ЛИП','СЕР','ВЕР','ЖОВ','ЛИС','ГРУ'];
      const day = String(d.getDate()).padStart(2,'0');
      const mon = ukMonths[d.getMonth()];
      const year = d.getFullYear();
      const hh = String(d.getHours()).padStart(2,'0');
      const mm = String(d.getMinutes()).padStart(2,'0');
      date = `${day} ${mon} ${year} / ${hh}:${mm}`;
    }

    if (text || image) {
      posts.push({ id, text, image, date });
    }
  }

  return posts;
}

// ── Network helpers ───────────────────────────────────────────────────────────

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

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Fetching last ${COUNT} posts from @${CHANNEL}...`);

  const html = await fetchText(`https://t.me/s/${CHANNEL}`);
  const fetched = parsePosts(html);

  console.log(`Parsed ${fetched.length} posts from page`);

  if (!fetched.length) {
    console.log('No posts found, exiting.');
    process.exit(0);
  }

  // Load existing posts
  let existing = [];
  try {
    existing = JSON.parse(readFileSync(POSTS_FILE, 'utf8'));
  } catch {}

  const existingIds = new Set(existing.map(p => p.id));

  // Take last COUNT posts, newest first
  const candidates = fetched.slice(-COUNT).reverse();

  // Create images dir
  mkdirSync(IMAGES_DIR, { recursive: true });

  const newPosts = [];
  for (const p of candidates) {
    const postId = `TG-${p.id}`;
    if (existingIds.has(postId)) {
      console.log(`  skip ${postId} (already exists)`);
      continue;
    }

    let imageFilename = '';
    if (p.image) {
      try {
        const ext = p.image.split('.').pop().split('?')[0].toLowerCase() || 'jpg';
        const safeExt = ['jpg','jpeg','png','webp','gif'].includes(ext) ? ext : 'jpg';
        imageFilename = `tg_${p.id}.${safeExt}`;
        const imgPath = join(IMAGES_DIR, imageFilename);
        const buf = await fetchBuffer(p.image);
        writeFileSync(imgPath, buf);
        console.log(`  saved image: ${imageFilename} (${buf.length} bytes)`);
      } catch (e) {
        console.warn(`  image failed: ${e.message}`);
        imageFilename = p.image; // fallback to external URL
      }
    }

    // Title = first line of text (max 120 chars)
    const lines = p.text.split('\n').filter(Boolean);
    const rawTitle = (lines[0] || `Пост ${p.id}`).slice(0, 120);
    const rawBody = lines.slice(1).join('\n').trim() || p.text;
    const title = await translateToUk(rawTitle);
    const bodyText = await translateToUk(rawBody);

    newPosts.push({
      id: postId,
      date: p.date,
      title,
      text: bodyText || title,
      image: imageFilename,
      tags: [],
    });

    console.log(`  + ${postId}: ${title.slice(0, 60)}`);
  }

  if (!newPosts.length) {
    console.log('Nothing new to import.');
    process.exit(0);
  }

  const updated = [...newPosts, ...existing];
  writeFileSync(POSTS_FILE, JSON.stringify(updated, null, 2));
  console.log(`\nDone. Added ${newPosts.length} new posts. Total: ${updated.length}`);
}

main().catch(e => { console.error(e); process.exit(1); });
