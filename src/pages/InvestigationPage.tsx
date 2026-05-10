import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
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

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i];
    const line = raw.trim();
    if (!line) {
      closeList();
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
        headers.forEach((_, idx) => out.push(`<td>${inline(row[idx] || '')}</td>`));
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
      out.push(`<h2>${inline(line.replace(/^##\s+/, ''))}</h2>`);
      continue;
    }
    if (/^#\s+/.test(line)) {
      closeList();
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

  if (loading) return <div className="min-h-screen bg-[#252519] text-white flex items-center justify-center">Loading...</div>;
  if (!item) return <div className="min-h-screen bg-[#252519] text-white flex items-center justify-center">Not found</div>;

  return (
    <div className="min-h-screen bg-[#252519] text-white px-4 md:px-8 py-10 md:py-14">
      <div className="max-w-4xl mx-auto">
        <Link to="/" className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-white/55 hover:text-[#c9a227] mb-8">
          <ArrowLeft className="w-3 h-3" /> Назад
        </Link>

        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#c9a227] mb-4">{item.code}</p>
        <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tight leading-[0.95]">{item.title}</h1>
        <p className="mt-5 text-lg font-semibold text-white/70 max-w-3xl">{item.summary}</p>

        {item.url && (
          <a href={item.url} target="_blank" rel="noreferrer" className="inline-flex mt-6 items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest text-white/60 hover:text-[#c9a227]">
            Зовнішнє джерело <ArrowUpRight className="w-3 h-3" />
          </a>
        )}

        <article className="mt-10 border-t border-[#c9a227]/30 pt-8 prose prose-invert max-w-none prose-headings:font-black prose-headings:uppercase prose-p:text-white/85 prose-li:text-white/85 prose-strong:text-white prose-code:text-[#c9a227] prose-a:text-[#c9a227] prose-img:border prose-img:border-[#c9a227]/20 prose-img:bg-black/20">
          {markdown ? (
            <div dangerouslySetInnerHTML={{ __html: html }} />
          ) : (
            <p className="text-white/60">Контент ще готується.</p>
          )}
        </article>
      </div>
      <style>{`
        .article-table-wrap {
          overflow-x: auto;
          margin: 1.75rem 0;
          border: 1px solid rgba(201, 162, 39, 0.22);
          background: rgba(17, 18, 13, 0.72);
        }
        .article-table-wrap table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.9rem;
        }
        .article-table-wrap th,
        .article-table-wrap td {
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          padding: 0.85rem;
          vertical-align: top;
        }
        .article-table-wrap th {
          color: #c9a227;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
          font-size: 0.72rem;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }
        figure {
          margin: 2rem 0;
        }
        figure img {
          width: 100%;
          max-height: 520px;
          object-fit: cover;
        }
        figcaption {
          margin-top: 0.55rem;
          color: rgba(255, 255, 255, 0.46);
          font-size: 0.78rem;
        }
      `}</style>
    </div>
  );
}
