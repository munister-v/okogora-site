import fs from 'node:fs/promises';

const POSTS_PATH = 'public/data/posts.json';

function decodeHtmlEntities(input) {
  return input
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function stripHtml(input) {
  return decodeHtmlEntities(
    input
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  );
}

function formatDate(isoDate) {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 16).replace('T', ' ');

  const months = ['СІЧ', 'ЛЮТ', 'БЕР', 'КВІТ', 'ТРАВ', 'ЧЕР', 'ЛИП', 'СЕР', 'ВЕР', 'ЖОВ', 'ЛИС', 'ГРУ'];
  const dd = String(d.getDate()).padStart(2, '0');
  const mon = months[d.getMonth()] || 'СІЧ';
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${dd} ${mon} ${yyyy} / ${hh}:${mm}`;
}

function extractTags(text) {
  const found = text.match(/#[\p{L}\p{N}_]+/gu) || [];
  const tags = [];

  for (const tag of found) {
    const cleaned = tag
      .replace('#', '')
      .trim()
      .toUpperCase();

    if (cleaned && !tags.includes(cleaned)) {
      tags.push(cleaned);
    }

    if (tags.length >= 4) break;
  }

  return tags;
}

function makeTitle(text) {
  const firstLine = text
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean) || 'Оновлення каналу';

  return firstLine.length > 92 ? `${firstLine.slice(0, 89)}...` : firstLine;
}

function parseTelegramHtml(html) {
  const blocks = html.split('<div class="tgme_widget_message_wrap').slice(1);
  const parsed = [];

  for (const block of blocks) {
    const dataPostMatch = block.match(/data-post="([^"]+)"/);
    if (!dataPostMatch) continue;

    const dataPost = dataPostMatch[1];
    const channelName = dataPost.split('/')[0];
    const postIdRaw = dataPost.split('/')[1];
    const postNum = Number(postIdRaw);
    if (!Number.isFinite(postNum)) continue;

    const textMatch = block.match(/<div class="tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>/);
    const rawText = textMatch ? stripHtml(textMatch[1]) : '';
    if (!rawText) continue;

    const dtMatch = block.match(/<time[^>]*datetime="([^"]+)"/);
    const date = formatDate(dtMatch ? dtMatch[1] : new Date().toISOString());

    const photoMatch = block.match(/background-image:url\('([^']+)'\)/);
    const image = photoMatch ? photoMatch[1] : '';

    parsed.push({
      id: `TG-${postNum}`,
      date,
      title: makeTitle(rawText),
      text: rawText,
      image,
      tags: extractTags(rawText),
      telegramUrl: `https://t.me/${channelName}/${postNum}`,
      _num: postNum,
    });
  }

  parsed.sort((a, b) => b._num - a._num);
  const seenIds = new Set();
  const seenText = new Set();

  return parsed.filter((post) => {
    if (seenIds.has(post.id)) return false;
    seenIds.add(post.id);

    const textKey = `${post.title}\n${post.text}`.replace(/\s+/g, ' ').trim().toLowerCase().slice(0, 220);
    if (seenText.has(textKey)) return false;
    seenText.add(textKey);
    return true;
  });
}

async function main() {
  const channelUrl = process.env.TG_CHANNEL_URL || 'https://t.me/s/oko_gora';
  const maxPosts = Number(process.env.TG_MAX_POSTS || 40);
  const keep = Number.isFinite(maxPosts) && maxPosts > 0 ? maxPosts : 40;

  console.log(`Sync source: ${channelUrl}`);
  console.log(`Keep latest: ${keep}`);

  const res = await fetch(channelUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; okogora-sync/1.0)',
      Accept: 'text/html',
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch channel: ${res.status} ${res.statusText}`);
  }

  const html = await res.text();
  const parsed = parseTelegramHtml(html).slice(0, keep);

  if (!parsed.length) {
    throw new Error('No posts were parsed from Telegram page');
  }

  let existing = [];
  try {
    const raw = await fs.readFile(POSTS_PATH, 'utf8');
    existing = JSON.parse(raw);
  } catch {
    existing = [];
  }

  const existingById = new Map(existing.map((p) => [p.id, p]));
  const merged = parsed.map((post) => {
    const old = existingById.get(post.id);

    return {
      id: post.id,
      date: post.date,
      title: post.title,
      text: post.text,
      image: post.image || old?.image || '',
      tags: post.tags.length ? post.tags : old?.tags || [],
      telegramUrl: post.telegramUrl || old?.telegramUrl || '',
    };
  });

  await fs.writeFile(POSTS_PATH, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');
  console.log(`Updated ${POSTS_PATH} with ${merged.length} posts`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
