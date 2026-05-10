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

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i];
    const line = raw.trim();
    if (!line) {
      closeList();
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
