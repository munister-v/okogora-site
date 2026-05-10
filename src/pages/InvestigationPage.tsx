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

  const inline = (text: string) => text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
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

    if (/^>\s+/.test(line)) {
      closeList();
      out.push(`<blockquote>${inline(line.replace(/^>\s+/, ''))}</blockquote>`);
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
      out.push(`<figure><img src="${imageMatch[2]}" alt="${imageMatch[1]}" loading="lazy" /><figcaption>${imageMatch[1]}</figcaption></figure>`);
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
    fetch('/data/investigations.json')
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
          border: 1px solid rgba(201, 162, 39, 0.22);
          background:
            linear-gradient(180deg, rgba(46, 45, 30, 0.98), rgba(24, 25, 18, 0.98));
          padding: clamp(1.25rem, 3vw, 3rem);
        }
        .article-body {
          max-width: 880px;
          color: rgba(255, 255, 255, 0.84);
          font-size: 1rem;
          line-height: 1.8;
        }
        .article-body > *:first-child {
          margin-top: 0;
        }
        .article-body h1,
        .article-body h2,
        .article-body h3 {
          color: #ffffff;
          font-weight: 900;
          line-height: 1.05;
          text-transform: uppercase;
        }
        .article-body h2 {
          margin: 3rem 0 1rem;
          padding-top: 1.5rem;
          border-top: 1px solid rgba(201, 162, 39, 0.28);
          font-size: clamp(1.75rem, 4vw, 2.7rem);
          scroll-margin-top: 7rem;
        }
        .article-body h3 {
          margin: 2rem 0 0.8rem;
          font-size: 1.35rem;
        }
        .article-body p {
          margin: 1.1rem 0;
        }
        .article-body p:first-of-type {
          font-size: 1.08rem;
          line-height: 1.85;
          color: rgba(255, 255, 255, 0.9);
        }
        .article-body a {
          color: #f3d97f;
          text-decoration: underline;
          text-decoration-color: rgba(243, 217, 127, 0.35);
          text-underline-offset: 0.25em;
        }
        .article-body strong {
          color: #ffffff;
        }
        .article-body code {
          border: 1px solid rgba(201, 162, 39, 0.25);
          background: rgba(201, 162, 39, 0.08);
          color: #f3d97f;
          padding: 0.1rem 0.32rem;
          font-size: 0.9em;
        }
        .article-body blockquote {
          margin: 1.5rem 0;
          border-left: 3px solid #c9a227;
          background: rgba(201, 162, 39, 0.09);
          padding: 1rem 1.15rem;
          color: rgba(255, 255, 255, 0.82);
          font-weight: 600;
        }
        .visual-block {
          margin: 2.2rem 0;
          border: 1px solid rgba(201, 162, 39, 0.28);
          background:
            linear-gradient(135deg, rgba(201, 162, 39, 0.1), rgba(255, 255, 255, 0.035)),
            rgba(12, 13, 10, 0.72);
          padding: clamp(1rem, 2.6vw, 1.6rem);
        }
        .visual-kicker {
          margin-bottom: 0.9rem;
          color: #f3d97f;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
          font-size: 0.7rem;
          text-transform: uppercase;
        }
        .chain-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 0.65rem;
        }
        .chain-node,
        .clock-grid > div,
        .factory-grid > div {
          min-height: 100%;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.045);
          padding: 1rem;
        }
        .chain-node span,
        .clock-grid span,
        .factory-grid span {
          display: block;
          margin-bottom: 0.7rem;
          color: #c9a227;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
          font-size: 0.72rem;
          text-transform: uppercase;
        }
        .chain-node strong,
        .clock-grid strong,
        .factory-grid strong {
          display: block;
          color: #fff;
          font-size: 0.98rem;
          line-height: 1.25;
        }
        .chain-node p,
        .clock-grid p,
        .visual-factories p {
          margin: 0.65rem 0 0;
          color: rgba(255, 255, 255, 0.58);
          font-size: 0.88rem;
          line-height: 1.55;
        }
        .chain-node.hot,
        .clock-grid .hot {
          border-color: rgba(239, 68, 68, 0.48);
          background: rgba(239, 68, 68, 0.11);
        }
        .visual-factories {
          display: grid;
          grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
          gap: 1rem;
          align-items: stretch;
        }
        .visual-factories h3 {
          margin: 0;
          color: #fff;
          font-size: clamp(1.4rem, 3vw, 2rem);
          line-height: 1.05;
          text-transform: uppercase;
        }
        .factory-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.65rem;
        }
        .factory-grid em {
          display: block;
          margin-top: 0.6rem;
          color: rgba(255, 255, 255, 0.55);
          font-size: 0.82rem;
          font-style: normal;
          line-height: 1.45;
        }
        .clock-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0.65rem;
        }
        .radar-layout {
          position: relative;
          min-height: 360px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background:
            radial-gradient(circle at center, rgba(201, 162, 39, 0.18), transparent 16%),
            radial-gradient(circle at center, transparent 0 31%, rgba(201, 162, 39, 0.14) 31% 31.5%, transparent 31.5%),
            radial-gradient(circle at center, transparent 0 49%, rgba(201, 162, 39, 0.1) 49% 49.5%, transparent 49.5%),
            rgba(0, 0, 0, 0.22);
          overflow: hidden;
        }
        .radar-core,
        .radar-item {
          position: absolute;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
          text-transform: uppercase;
        }
        .radar-core {
          left: 50%;
          top: 50%;
          width: 8rem;
          height: 8rem;
          transform: translate(-50%, -50%);
          border: 1px solid rgba(201, 162, 39, 0.65);
          background: rgba(201, 162, 39, 0.16);
          color: #f3d97f;
          font-size: 0.82rem;
          line-height: 1.35;
        }
        .radar-item {
          width: 10rem;
          min-height: 3.4rem;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(17, 18, 13, 0.9);
          padding: 0.65rem;
          color: rgba(255, 255, 255, 0.72);
          font-size: 0.7rem;
          line-height: 1.3;
        }
        .r1 { left: 8%; top: 15%; }
        .r2 { right: 8%; top: 18%; }
        .r3 { left: 7%; bottom: 16%; }
        .r4 { right: 8%; bottom: 14%; }
        .r5 { left: 50%; top: 5%; transform: translateX(-50%); }
        .article-body hr {
          margin: 2.2rem 0;
          border: 0;
          border-top: 1px solid rgba(255, 255, 255, 0.12);
        }
        .article-body ul {
          margin: 1.2rem 0;
          padding: 0;
          list-style: none;
        }
        .article-body li {
          position: relative;
          margin: 0.7rem 0;
          padding-left: 1.35rem;
          color: rgba(255, 255, 255, 0.78);
        }
        .article-body li::before {
          content: "";
          position: absolute;
          left: 0;
          top: 0.82em;
          width: 0.45rem;
          height: 0.45rem;
          transform: translateY(-50%);
          background: #c9a227;
        }
        .article-table-wrap {
          overflow-x: auto;
          margin: 1.8rem 0 2.4rem;
          border: 1px solid rgba(201, 162, 39, 0.3);
          background: rgba(17, 18, 13, 0.85);
        }
        .article-table-wrap table {
          width: 100%;
          border-collapse: collapse;
          min-width: 760px;
          font-size: 0.92rem;
        }
        .article-table-wrap th,
        .article-table-wrap td {
          border-right: 1px solid rgba(255, 255, 255, 0.07);
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          padding: 1rem;
          vertical-align: top;
        }
        .article-table-wrap tr:last-child td {
          border-bottom: 0;
        }
        .article-table-wrap th:last-child,
        .article-table-wrap td:last-child {
          border-right: 0;
        }
        .article-table-wrap th {
          background: rgba(201, 162, 39, 0.12);
          color: #c9a227;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
          font-size: 0.72rem;
          text-transform: uppercase;
        }
        .article-table-wrap td {
          color: rgba(255, 255, 255, 0.76);
        }
        figure {
          margin: 2rem 0 2.6rem;
          border: 1px solid rgba(201, 162, 39, 0.24);
          background: rgba(0, 0, 0, 0.22);
        }
        figure img {
          width: 100%;
          aspect-ratio: 16 / 9;
          max-height: 560px;
          object-fit: cover;
          display: block;
        }
        figcaption {
          padding: 0.8rem 1rem 1rem;
          color: rgba(255, 255, 255, 0.46);
          font-size: 0.78rem;
          line-height: 1.55;
        }
        @media (max-width: 720px) {
          .article-shell {
            border-left: 0;
            border-right: 0;
            margin-left: -1rem;
            margin-right: -1rem;
          }
          .article-body {
            font-size: 0.98rem;
            line-height: 1.75;
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
            gap: 0.65rem;
            padding: 1rem;
            background: rgba(0, 0, 0, 0.22);
          }
          .radar-core,
          .radar-item {
            position: static;
            width: auto;
            min-height: 0;
            transform: none;
          }
          .radar-core {
            height: auto;
            padding: 1rem;
          }
          .article-table-wrap {
            border: 0;
            background: transparent;
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
            margin-bottom: 0.85rem;
            border: 1px solid rgba(201, 162, 39, 0.22);
            background: rgba(17, 18, 13, 0.82);
          }
          .article-table-wrap td {
            border-right: 0;
            padding: 0.85rem 1rem;
          }
          .article-table-wrap td::before {
            content: attr(data-label);
            display: block;
            margin-bottom: 0.35rem;
            color: #c9a227;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
            font-size: 0.68rem;
            text-transform: uppercase;
          }
          figure img {
            aspect-ratio: 4 / 3;
          }
        }
      `}</style>
    </div>
  );
}
