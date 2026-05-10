import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, BookOpen, CalendarDays, Database, FileText, ShieldCheck } from 'lucide-react';
import { InvestigationArticle } from '../types';
import { setSeo } from '../lib/seo';

function escapeHtml(input: string) {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderMarkdown(md: string) {
  const safe = escapeHtml(md || '');
  const lines = safe.split('\n');
  const out: string[] = [];
  let inList = false;
  let h2Index = 0;
  let skippedFirstH1 = false;

  const inline = (text: string) =>
    text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\[(.+?)\]\((https?:\/\/[^\s]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');

  const closeList = () => {
    if (inList) {
      out.push('</ul>');
      inList = false;
    }
  };

  const isTableSeparator = (line: string) => /^\|?[\s:-]+\|[\s|:-]+$/.test(line);
  const splitTableRow = (line: string) => line
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
  const attr = (text: string) => text.replace(/"/g, '&quot;');
  const renderScheme = (type: string) => {
    if (type === 'delay-chain') {
      return `
        <section class="visual-block visual-chain" aria-label="Схема затримки ремонту НПЗ">
          <div class="visual-kicker">Схема простою</div>
          <div class="chain-grid">
            <div class="chain-node"><span>01</span><strong>Установка ловить пошкодження</strong><p>Дим видно всім, але це тільки верхній шар історії.</p></div>
            <div class="chain-node"><span>02</span><strong>Аварійний ремонт</strong><p>Кабелі, обвʼязка, насоси й автоматика часто повертаються швидше.</p></div>
            <div class="chain-node"><span>03</span><strong>Великий апарат вибито</strong><p>Колону або реактор не звариш на коліні за два тижні.</p></div>
            <div class="chain-node"><span>04</span><strong>Черга на заводі</strong><p>Метал, зварювання, контроль, термообробка, приймання.</p></div>
            <div class="chain-node hot"><span>05</span><strong>Простій розтягується</strong><p>Проблема переїжджає з НПЗ у важке машинобудування.</p></div>
          </div>
        </section>
      `;
    }

    if (type === 'factory-cluster') {
      return `
        <section class="visual-block visual-factories" aria-label="Контур виробників обладнання">
          <div>
            <div class="visual-kicker">Промисловий контур</div>
            <h3>Чотири вузли, на яких тримається ремонтна арифметика</h3>
            <p>Це не список для фізичних дій. Це карта залежностей: хто в РФ публічно заявляє компетенції у великих апаратах, без яких НПЗ складно повернути на нормальний режим.</p>
          </div>
          <div class="factory-grid">
            <div><span>Волгоград</span><strong>Волгограднефтемаш</strong><em>колони, реактори, коксові камери</em></div>
            <div><span>Єкатеринбург</span><strong>Уралхиммаш</strong><em>вакуумні колони, реакторне обладнання</em></div>
            <div><span>Колпіно</span><strong>Іжорські заводи</strong><em>посудини високого тиску, спецсталі</em></div>
            <div><span>Башкортостан</span><strong>Салаватнефтемаш</strong><em>теплообмінники, змійовики, ємності</em></div>
          </div>
        </section>
      `;
    }

    if (type === 'repair-clock') {
      return `
        <section class="visual-block visual-clock" aria-label="Горизонти ремонту">
          <div class="visual-kicker">Ремонтний годинник</div>
          <div class="clock-grid">
            <div><span>Дні</span><strong>обвʼязка / кабелі</strong><p>Швидкий аварійний контур.</p></div>
            <div><span>Тижні</span><strong>насоси / теплообмінники</strong><p>Можливі резерви й канібалізація.</p></div>
            <div><span>Місяці</span><strong>внутрішні пристрої</strong><p>Колона стоїть, режим кульгає.</p></div>
            <div class="hot"><span>Квартали+</span><strong>корпус колони / реактор</strong><p>Ось тут починається справжня промислова мʼясорубка.</p></div>
          </div>
        </section>
      `;
    }

    if (type === 'osint-radar') {
      return `
        <section class="visual-block visual-radar" aria-label="OSINT радар">
          <div class="visual-kicker">OSINT-радар</div>
          <div class="radar-layout">
            <div class="radar-core">НПЗ<br />простій</div>
            <div class="radar-item r1">відвантаження колон</div>
            <div class="radar-item r2">тендери на внутрішні пристрої</div>
            <div class="radar-item r3">нестандартні перевезення</div>
            <div class="radar-item r4">спецсталі й поковки</div>
            <div class="radar-item r5">позапланові ремонти</div>
          </div>
        </section>
      `;
    }

    return '';
  };

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i];
    const line = raw.trim();
    if (!line) {
      closeList();
      continue;
    }

    if (/^::scheme\s+/.test(line)) {
      closeList();
      out.push(renderScheme(line.replace(/^::scheme\s+/, '').trim()));
      continue;
    }

    if (/^(&gt;|>)\s+/.test(line)) {
      closeList();
      out.push(`<blockquote>${inline(line.replace(/^(&gt;|>)\s+/, ''))}</blockquote>`);
      continue;
    }

    if (/^---+$/.test(line)) {
      closeList();
      out.push('<hr />');
      continue;
    }

    const imageMatch = line.match(/^!\[(.*?)\]\((https?:\/\/[^\s)]+)\)$/);
    if (imageMatch) {
      closeList();
      // peek at next non-empty line to see if it's an italic caption
      let captionHtml = '';
      let skipNext = 0;
      for (let j = i + 1; j < lines.length; j++) {
        const peek = lines[j].trim();
        if (!peek) { skipNext = j - i; continue; }
        // italic-only line used as caption: *text* or _text_
        if (/^\*[^*].+[^*]\*$/.test(peek) || /^_[^_].+[^_]_$/.test(peek)) {
          captionHtml = inline(peek.replace(/^[*_]/, '').replace(/[*_]$/, ''));
          skipNext = j - i;
        }
        break;
      }
      if (skipNext) i += skipNext;
      out.push(`<figure><img src="${imageMatch[2]}" alt="${imageMatch[1]}" loading="lazy" />${captionHtml ? `<figcaption>${captionHtml}</figcaption>` : ''}</figure>`);
      continue;
    }

    if (line.includes('|') && lines[i + 1] && isTableSeparator(lines[i + 1].trim())) {
      closeList();
      const headers = splitTableRow(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].trim().includes('|')) {
        rows.push(splitTableRow(lines[i].trim()));
        i += 1;
      }
      i -= 1;
      out.push('<div class="article-table-wrap"><table><thead><tr>');
      headers.forEach((header) => out.push(`<th>${inline(header)}</th>`));
      out.push('</tr></thead><tbody>');
      rows.forEach((row) => {
        out.push('<tr>');
        headers.forEach((header, idx) => out.push(`<td data-label="${attr(header)}">${inline(row[idx] || '')}</td>`));
        out.push('</tr>');
      });
      out.push('</tbody></table></div>');
      continue;
    }

    if (/^###\s+/.test(line)) {
      closeList();
      out.push(`<h3>${inline(line.replace(/^###\s+/, ''))}</h3>`);
      continue;
    }
    if (/^##\s+/.test(line)) {
      closeList();
      h2Index += 1;
      out.push(`<h2 id="section-${h2Index}">${inline(line.replace(/^##\s+/, ''))}</h2>`);
      continue;
    }
    if (/^#\s+/.test(line)) {
      closeList();
      if (!skippedFirstH1) {
        skippedFirstH1 = true;
        continue;
      }
      out.push(`<h1>${inline(line.replace(/^#\s+/, ''))}</h1>`);
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      if (!inList) {
        out.push('<ul>');
        inList = true;
      }
      out.push(`<li>${inline(line.replace(/^[-*]\s+/, ''))}</li>`);
      continue;
    }

    // Numbered list: 1. item
    if (/^\d+\.\s+/.test(line)) {
      closeList();
      out.push(`<p class="numbered-item">${inline(line)}</p>`);
      continue;
    }

    // Bold-only line = lead/kicker paragraph
    if (/^\*\*[^*]+\*\*$/.test(line)) {
      closeList();
      out.push(`<p class="article-lead">${inline(line)}</p>`);
      continue;
    }

    closeList();
    out.push(`<p>${inline(line)}</p>`);
  }
  closeList();

  return out.join('\n');
}

function extractHeadings(md: string) {
  let index = 0;
  return md
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^##\s+/.test(line))
    .map((line) => {
      index += 1;
      return {
        id: `section-${index}`,
        label: line.replace(/^##\s+/, ''),
      };
    });
}

function formatArticleDate(value: string) {
  try {
    return new Date(value).toLocaleDateString('uk-UA', { day: '2-digit', month: 'long', year: 'numeric' });
  } catch {
    return value;
  }
}

export default function InvestigationPage() {
  const { id } = useParams<{ id: string }>();
  const [item, setItem] = useState<InvestigationArticle | null>(null);
  const [markdown, setMarkdown] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setMarkdown('');
    fetch(`/data/investigations.json?_t=${Date.now()}`)
      .then((r) => r.json())
      .then(async (data: InvestigationArticle[]) => {
        const arr = Array.isArray(data) ? data : [];
        const found = arr.find((x) => x.id === id) || null;
        setItem(found);
        if (found?.contentPath) {
          const res = await fetch(`${found.contentPath}?_t=${Date.now()}`);
          if (res.ok) {
            setMarkdown(await res.text());
            return;
          }
        }
        setMarkdown(found?.contentMarkdown || '');
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!item) return;
    setSeo({
      title: item.title,
      description: item.summary,
      path: `/investigation/${item.id}`,
      type: 'article',
    });
  }, [item]);

  const html = useMemo(() => renderMarkdown(markdown), [markdown]);
  const headings = useMemo(() => extractHeadings(markdown), [markdown]);
  const wordCount = useMemo(() => markdown.split(/\s+/).filter(Boolean).length, [markdown]);
  const readMinutes = Math.max(3, Math.round(wordCount / 180));

  if (loading) return <div className="min-h-screen bg-[#252519] text-white flex items-center justify-center">Loading...</div>;
  if (!item) return <div className="min-h-screen bg-[#252519] text-white flex items-center justify-center">Not found</div>;

  return (
    <div className="min-h-screen bg-[#171914] text-white">
      <div className="relative overflow-hidden border-b border-[#c9a227]/25 bg-[#202116]">
        <div className="absolute inset-x-0 top-0 h-px bg-[#c9a227]/55" />
        <div className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8">
          <Link to="/#investigations" className="inline-flex min-h-11 items-center gap-2 font-mono text-[11px] uppercase text-white/58 transition-colors hover:text-[#c9a227]">
            <ArrowLeft className="h-3.5 w-3.5" /> До розслідувань
          </Link>
        </div>

        <section className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 pb-10 md:px-8 md:pb-16 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-8">
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <span className="border border-[#c9a227]/45 bg-[#c9a227]/10 px-3 py-1.5 font-mono text-[10px] uppercase text-[#f3d97f]">{item.code}</span>
              {(item.tags || []).map((tag) => (
                <span key={tag} className="border border-white/10 bg-white/[0.04] px-3 py-1.5 font-mono text-[10px] uppercase text-white/55">{tag}</span>
              ))}
            </div>
            <h1 className="max-w-5xl text-4xl font-black uppercase leading-[0.95] text-white md:text-6xl lg:text-7xl">{item.title}</h1>
            <p className="mt-6 max-w-3xl text-lg font-semibold leading-8 text-white/70 md:text-xl">{item.summary}</p>
          </div>

          <aside className="lg:col-span-4">
            <div className="border border-[#c9a227]/25 bg-[#11120d]/75 p-5 md:p-6">
              <p className="mb-4 font-mono text-[10px] uppercase text-[#c9a227]/75">Паспорт матеріалу</p>
              <div className="space-y-3 text-sm text-white/70">
                <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-2">
                  <span className="inline-flex items-center gap-2"><CalendarDays className="h-4 w-4 text-[#c9a227]" /> Опубліковано</span>
                  <span className="text-right">{formatArticleDate(item.publishedAt)}</span>
                </div>
                <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-2">
                  <span className="inline-flex items-center gap-2"><BookOpen className="h-4 w-4 text-[#c9a227]" /> Читання</span>
                  <span>{readMinutes} хв</span>
                </div>
                <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-2">
                  <span className="inline-flex items-center gap-2"><Database className="h-4 w-4 text-[#c9a227]" /> Формат</span>
                  <span>OSINT</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-[#c9a227]" /> Точність</span>
                  <span>відкриті джерела</span>
                </div>
              </div>
              {item.url && (
                <a href={item.url} target="_blank" rel="noreferrer" className="mt-5 inline-flex min-h-11 items-center gap-1.5 border border-[#c9a227]/40 px-4 py-3 font-mono text-[11px] uppercase text-[#f3d97f] transition-colors hover:bg-[#c9a227]/10">
                  Зовнішнє джерело <ArrowUpRight className="h-3 w-3" />
                </a>
              )}
            </div>
          </aside>
        </section>
      </div>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 py-8 md:px-8 md:py-12 lg:grid-cols-12 lg:gap-10">
        <aside className="lg:col-span-3">
          <div className="lg:sticky lg:top-24">
            <div className="border border-white/10 bg-[#202116] p-5">
              <div className="mb-4 flex items-center gap-2 font-mono text-[10px] uppercase text-[#c9a227]/80">
                <FileText className="h-3.5 w-3.5" /> Навігація
              </div>
              <nav className="space-y-1">
                {headings.slice(0, 10).map((heading) => (
                  <a key={heading.id} href={`#${heading.id}`} className="block border-l border-white/10 px-3 py-2 text-sm leading-snug text-white/54 transition-colors hover:border-[#c9a227] hover:text-white">
                    {heading.label}
                  </a>
                ))}
              </nav>
            </div>
          </div>
        </aside>

        <main className="lg:col-span-9">
          <article className="article-shell">
            {markdown ? (
              <div className="article-body" dangerouslySetInnerHTML={{ __html: html }} />
            ) : (
              <p className="text-white/60">Контент ще готується.</p>
            )}
          </article>
        </main>
      </div>
      <style>{`
        html {
          scroll-behavior: smooth;
        }
        .article-shell {
          border-top: 1px solid rgba(255, 255, 255, 0.15);
          background: #111111;
          padding: clamp(2rem, 5vw, 4rem) clamp(1rem, 3vw, 2rem);
        }
        .article-body {
          max-width: 740px;
          margin: 0 auto;
          color: rgba(255, 255, 255, 0.9);
          font-family: Georgia, Cambria, "Times New Roman", Times, serif;
          font-size: 1.15rem;
          line-height: 1.7;
        }
        .article-body > *:first-child {
          margin-top: 0;
        }
        .article-body h1,
        .article-body h2,
        .article-body h3 {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          color: #ffffff;
          font-weight: 700;
          line-height: 1.2;
          letter-spacing: -0.02em;
        }
        .article-body h2 {
          margin: 3.5rem 0 1.5rem;
          padding-top: 2rem;
          border-top: 1px solid rgba(255, 255, 255, 0.15);
          font-size: clamp(1.5rem, 3vw, 2.25rem);
          scroll-margin-top: 7rem;
        }
        .article-body h3 {
          margin: 2.5rem 0 1rem;
          font-size: 1.25rem;
          text-transform: none;
        }
        .article-body p {
          margin: 1.2rem 0;
        }
        /* Intro paragraph NYT style */
        .article-body p:first-of-type {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          font-size: 1.25rem;
          line-height: 1.6;
          color: rgba(255, 255, 255, 0.95);
          font-weight: 300;
          margin-bottom: 2.5rem;
        }
        .article-body a {
          color: #fff;
          text-decoration: underline;
          text-decoration-color: rgba(255, 255, 255, 0.4);
          text-underline-offset: 0.25em;
          transition: text-decoration-color 0.2s;
        }
        .article-body a:hover {
          text-decoration-color: #fff;
        }
        .article-body strong {
          color: #ffffff;
          font-weight: 700;
        }
        .article-body code {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
          background: rgba(255, 255, 255, 0.1);
          padding: 0.2rem 0.4rem;
          font-size: 0.85em;
          border-radius: 3px;
        }
        .article-body blockquote {
          margin: 2.5rem 0;
          padding: 1.25rem 0 1.25rem 1.5rem;
          border-left: 3px solid rgba(255,255,255,0.6);
          color: rgba(255, 255, 255, 0.88);
          font-size: 1.2rem;
          font-style: italic;
          line-height: 1.55;
          background: rgba(255,255,255,0.03);
        }
        .article-lead {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          font-size: 1.1rem;
          font-weight: 400;
          color: rgba(255,255,255,0.7);
          font-style: italic;
          margin: 0.5rem 0 2.5rem;
          line-height: 1.6;
        }
        .numbered-item {
          padding-left: 0;
          position: relative;
          margin: 0.8rem 0;
          color: rgba(255,255,255,0.88);
        }
        .numbered-item strong {
          color: #fff;
        }
        .visual-block {
          margin: 3rem 0;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          border-top: 2px solid #333;
          border-bottom: 1px solid #333;
          padding: 2rem 0;
          background: #111;
        }
        .visual-kicker {
          margin-bottom: 1.5rem;
          color: #888;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .chain-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 1px;
          background: #333;
        }
        .chain-node,
        .clock-grid > div,
        .factory-grid > div {
          min-height: 100%;
          background: #111;
          padding: 1.25rem;
        }
        .chain-node span,
        .clock-grid span,
        .factory-grid span {
          display: block;
          margin-bottom: 0.5rem;
          color: #888;
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
        }
        .chain-node strong,
        .clock-grid strong,
        .factory-grid strong {
          display: block;
          color: #fff;
          font-size: 1rem;
          line-height: 1.3;
          font-weight: 600;
        }
        .chain-node p,
        .clock-grid p,
        .visual-factories p {
          margin: 0.75rem 0 0;
          color: rgba(255, 255, 255, 0.7);
          font-size: 0.9rem;
          line-height: 1.5;
        }
        .chain-node.hot,
        .clock-grid .hot {
          background: rgba(255, 255, 255, 0.05);
        }
        .visual-factories {
          display: grid;
          grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
          gap: 2rem;
          align-items: stretch;
        }
        .visual-factories h3 {
          margin: 0;
          color: #fff;
          font-size: 1.5rem;
          line-height: 1.2;
          font-weight: 600;
        }
        .factory-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 1px;
          background: #333;
        }
        .factory-grid em {
          display: block;
          margin-top: 0.75rem;
          color: rgba(255, 255, 255, 0.6);
          font-size: 0.85rem;
          font-style: normal;
          line-height: 1.4;
        }
        .clock-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 1px;
          background: #333;
        }
        .radar-layout {
          position: relative;
          min-height: 400px;
          border: 1px solid #333;
          background: #111;
          overflow: hidden;
        }
        .radar-core,
        .radar-item {
          position: absolute;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          font-weight: 500;
        }
        .radar-core {
          left: 50%;
          top: 50%;
          width: 7rem;
          height: 7rem;
          transform: translate(-50%, -50%);
          border: 1px solid #666;
          border-radius: 50%;
          background: #1a1a1a;
          color: #fff;
          font-size: 0.9rem;
          line-height: 1.2;
        }
        .radar-item {
          width: 10rem;
          min-height: 3.5rem;
          border: 1px solid #333;
          background: #111;
          padding: 0.75rem;
          color: rgba(255, 255, 255, 0.8);
          font-size: 0.8rem;
          line-height: 1.4;
        }
        .r1 { left: 5%; top: 15%; }
        .r2 { right: 5%; top: 18%; }
        .r3 { left: 5%; bottom: 16%; }
        .r4 { right: 5%; bottom: 14%; }
        .r5 { left: 50%; top: 5%; transform: translateX(-50%); }
        .article-body hr {
          margin: 3rem 0;
          border: 0;
          border-top: 1px solid #333;
        }
        .article-body ul {
          margin: 1.5rem 0;
          padding: 0;
          list-style: none;
        }
        .article-body li {
          position: relative;
          margin: 0.75rem 0;
          padding-left: 1.5rem;
          color: rgba(255, 255, 255, 0.9);
        }
        .article-body li::before {
          content: "—";
          position: absolute;
          left: 0;
          top: 0;
          color: #666;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }
        .article-table-wrap {
          overflow-x: auto;
          margin: 2.5rem 0;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }
        .article-table-wrap table {
          width: 100%;
          border-collapse: collapse;
          min-width: 760px;
          font-size: 0.9rem;
        }
        .article-table-wrap th,
        .article-table-wrap td {
          border-bottom: 1px solid #333;
          padding: 1rem 0.5rem;
          vertical-align: top;
          text-align: left;
        }
        .article-table-wrap th {
          border-top: 1px solid #666;
          border-bottom: 2px solid #666;
          color: #fff;
          font-weight: 600;
          text-transform: uppercase;
          font-size: 0.75rem;
          letter-spacing: 0.05em;
        }
        .article-table-wrap td {
          color: rgba(255, 255, 255, 0.8);
          line-height: 1.5;
        }
        figure {
          margin: 3rem -2rem;
          overflow: hidden;
        }
        figure img {
          width: 100%;
          height: 480px;
          object-fit: cover;
          display: block;
          background: #000;
        }
        figcaption {
          margin-top: 0;
          padding: 0.85rem 2rem;
          color: rgba(255, 255, 255, 0.45);
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          font-size: 0.8rem;
          line-height: 1.5;
          border-left: 2px solid rgba(255,255,255,0.12);
          margin-left: 2rem;
          margin-right: 2rem;
        }
        @media (max-width: 720px) {
          .article-shell {
            padding: 2rem 0;
          }
          .article-body {
            font-size: 1.05rem;
            line-height: 1.6;
          }
          .chain-grid,
          .clock-grid,
          .factory-grid,
          .visual-factories {
            grid-template-columns: 1fr;
          }
          .radar-layout {
            min-height: auto;
            display: grid;
            gap: 1px;
            background: #333;
            border: 0;
          }
          .radar-core,
          .radar-item {
            position: static;
            width: auto;
            min-height: 0;
            transform: none;
            border: 0;
            background: #111;
          }
          .radar-core {
            border-radius: 0;
            padding: 1.5rem;
            height: auto;
          }
          .article-table-wrap {
            border-top: 1px solid #333;
          }
          .article-table-wrap table,
          .article-table-wrap thead,
          .article-table-wrap tbody,
          .article-table-wrap tr,
          .article-table-wrap th,
          .article-table-wrap td {
            display: block;
            min-width: 0;
            width: 100%;
          }
          .article-table-wrap thead {
            display: none;
          }
          .article-table-wrap tr {
            margin-bottom: 1rem;
            background: #111;
          }
          .article-table-wrap td {
            border-bottom: 1px solid #222;
            padding: 1rem;
          }
          .article-table-wrap td::before {
            content: attr(data-label);
            display: block;
            margin-bottom: 0.5rem;
            color: #888;
            font-size: 0.7rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }
        }
      `}</style>
    </div>
  );
}
