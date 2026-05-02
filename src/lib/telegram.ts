export interface TelegramPost {
  id: string;
  text: string;
  image: string;
  date: string;
  rawDate: string;
}

const CHANNEL = 'oko_gora';
const CORS = 'https://api.allorigins.win/get?url=';

function channelUrl(before?: string) {
  const base = `https://t.me/s/${CHANNEL}`;
  return before ? `${base}?before=${before}` : base;
}

function extractPosts(html: string): TelegramPost[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const msgs = Array.from(doc.querySelectorAll('.tgme_widget_message'));

  return msgs.reverse().map(el => {
    // ID
    const dataPost = el.getAttribute('data-post') || '';
    const id = dataPost.split('/').pop() || String(Date.now());

    // Text — get all text nodes, skip links that are just t.me
    const textEl = el.querySelector('.tgme_widget_message_text');
    let text = '';
    if (textEl) {
      // Replace <br> with newline, then get text
      textEl.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
      text = (textEl.textContent || '').trim();
    }

    // Image — background-image from photo wrap or video thumb
    let image = '';
    const photoWrap = el.querySelector(
      '.tgme_widget_message_photo_wrap, .tgme_widget_message_video_thumb'
    ) as HTMLElement | null;
    if (photoWrap) {
      const style = photoWrap.getAttribute('style') || '';
      const match = style.match(/url\(['"]?(https?:[^'")\s]+)['"]?\)/);
      if (match) image = match[1];
    }

    // Date
    const timeEl = el.querySelector('time');
    const rawDate = timeEl?.getAttribute('datetime') || '';
    let date = '';
    if (rawDate) {
      const d = new Date(rawDate);
      const months = ['ЛИП','ЛЮТ','БЕР','КВІ','ТРА','ЧЕР','ЛИП','СЕР','ВЕР','ЖОВ','ЛИС','ГРУ'];
      // map proper ukrainian months
      const ukMonths = ['СІЧ','ЛЮТ','БЕР','КВІТня','ТРАВ','ЧЕР','ЛИП','СЕР','ВЕР','ЖОВ','ЛИС','ГРУ'];
      const shortUk = ['СІЧ','ЛЮТ','БЕР','КВІТ','ТРАВ','ЧЕР','ЛИП','СЕР','ВЕР','ЖОВ','ЛИС','ГРУ'];
      const day = String(d.getDate()).padStart(2, '0');
      const mon = shortUk[d.getMonth()];
      const year = d.getFullYear();
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      date = `${day} ${mon} ${year} / ${hh}:${mm}`;
    }

    return { id, text, image, date, rawDate };
  }).filter(p => p.text || p.image);
}

export async function fetchChannelPosts(count = 10): Promise<TelegramPost[]> {
  const results: TelegramPost[] = [];
  let beforeId: string | undefined;

  // Fetch pages until we have enough posts
  while (results.length < count) {
    const url = channelUrl(beforeId);
    const proxyUrl = CORS + encodeURIComponent(url);

    const res = await fetch(proxyUrl);
    if (!res.ok) throw new Error('Не вдалося завантажити канал');
    const data = await res.json();
    const html: string = data.contents;

    const posts = extractPosts(html);
    if (!posts.length) break;

    results.unshift(...posts);

    // Get oldest id to paginate back
    const oldest = posts[0];
    if (!oldest?.id || oldest.id === beforeId) break;
    beforeId = oldest.id;

    if (results.length >= count) break;
  }

  // Deduplicate and return last N
  const seen = new Set<string>();
  const deduped = results.filter(p => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });

  return deduped.slice(-count);
}
