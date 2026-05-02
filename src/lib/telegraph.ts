import { Post } from '../types';

interface TelegraphNode {
  tag?: string;
  attrs?: Record<string, string>;
  children?: (string | TelegraphNode)[];
}

// Extract plain text from Telegraph content nodes
function nodesToText(nodes: (string | TelegraphNode)[]): string {
  return nodes
    .map(n => {
      if (typeof n === 'string') return n;
      if (!n.children) return '';
      // Skip figure/img nodes for text
      if (n.tag === 'figure' || n.tag === 'img' || n.tag === 'figcaption') return '';
      return nodesToText(n.children);
    })
    .join('')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Extract first image src from Telegraph content nodes
function extractFirstImage(nodes: (string | TelegraphNode)[]): string {
  for (const n of nodes) {
    if (typeof n === 'string') continue;
    if (n.tag === 'img' && n.attrs?.src) {
      const src = n.attrs.src;
      // Telegraph images are like /file/abc.jpg → full URL
      return src.startsWith('/') ? `https://telegra.ph${src}` : src;
    }
    if (n.children) {
      const found = extractFirstImage(n.children);
      if (found) return found;
    }
  }
  return '';
}

// Parse telegra.ph URL to get the page path
function parseTelegraphPath(url: string): string {
  try {
    const u = new URL(url.trim());
    // path is like /Article-Title-01-01
    return u.pathname.replace(/^\//, '');
  } catch {
    // Maybe user passed path directly without protocol
    return url.trim().replace(/^\//, '');
  }
}

export async function importFromTelegraph(url: string): Promise<Partial<Post>> {
  const path = parseTelegraphPath(url);
  if (!path) throw new Error('Невірне посилання на Telegraph');

  const apiUrl = `https://api.telegra.ph/getPage/${path}?return_content=true`;
  const res = await fetch(apiUrl);

  if (!res.ok) throw new Error(`Telegraph API: ${res.status}`);

  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'Telegraph повернув помилку');

  const page = data.result;
  const content: (string | TelegraphNode)[] = page.content || [];

  const title: string = page.title || '';
  const text = nodesToText(content);
  const image = extractFirstImage(content);

  // Format date like our site expects
  const now = new Date();
  const date = now.toLocaleDateString('uk-UA', {
    day: '2-digit', month: 'short', year: 'numeric'
  }).toUpperCase() + ' / ' + now.toTimeString().slice(0, 5);

  return {
    id: `TG-${Date.now()}`,
    date,
    title,
    text,
    image,
    tags: [],
  };
}
