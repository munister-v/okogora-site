import { Post } from '../types';

function normalizeTextKey(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .trim()
    .toLowerCase()
    .slice(0, 220);
}

function normalizeTitleKey(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .trim()
    .toLowerCase()
    .slice(0, 110);
}

export function postTelegramUrl(post: Post, channel = 'oko_gora'): string {
  if (post.telegramUrl) return post.telegramUrl;
  const m = /^TG-(\d+)$/i.exec(post.id || '');
  if (m) return `https://t.me/${channel}/${m[1]}`;
  return `https://t.me/${channel}`;
}

export function normalizePosts(posts: Post[]): Post[] {
  const seenIds = new Set<string>();
  const seenTextKeys = new Set<string>();
  const seenTitleKeys = new Set<string>();
  const seenTelegramUrls = new Set<string>();
  const result: Post[] = [];

  for (const p of posts || []) {
    if (!p?.id || !p?.title) continue;

    const id = String(p.id).trim();
    if (seenIds.has(id)) continue;

    const titleKey = normalizeTitleKey(p.title || '');
    const key = normalizeTextKey(`${p.title}\n${p.text || ''}`);
    const tg = (p.telegramUrl || '').trim();

    if (key && seenTextKeys.has(key)) continue;
    if (titleKey && seenTitleKeys.has(titleKey) && key.length < 80) continue;
    if (tg && seenTelegramUrls.has(tg)) continue;

    seenIds.add(id);
    if (key) seenTextKeys.add(key);
    if (titleKey) seenTitleKeys.add(titleKey);
    if (tg) seenTelegramUrls.add(tg);

    result.push({
      ...p,
      title: String(p.title).trim(),
      text: String(p.text || '')
        .replace(/\r/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim(),
      image: String(p.image || '').trim(),
      telegramUrl: p.telegramUrl || postTelegramUrl(p),
      tags: Array.isArray(p.tags) ? p.tags : [],
    });
  }

  return result;
}

export function resolveImageUrl(img: string): string {
  if (!img) return '';
  if (img.startsWith('http://') || img.startsWith('https://')) return img;
  if (img.startsWith('/')) return img;
  if (img.startsWith('images/')) return `/${img}`;
  return `https://raw.githubusercontent.com/munister-v/okogora/main/images/${img}`;
}

export function formatPreview(text: string, max = 200): string {
  const compact = (text || '').replace(/\s+/g, ' ').trim();
  if (!compact) return '';
  if (compact.length <= max) return compact;
  return `${compact.slice(0, max - 1)}…`;
}

export function splitParagraphs(text: string): string[] {
  return (text || '')
    .replace(/\r/g, '')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}
