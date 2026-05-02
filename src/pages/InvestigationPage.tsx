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

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      if (inList) {
        out.push('</ul>');
        inList = false;
      }
      continue;
    }

    if (/^###\s+/.test(line)) {
      if (inList) { out.push('</ul>'); inList = false; }
      out.push(`<h3>${inline(line.replace(/^###\s+/, ''))}</h3>`);
      continue;
    }
    if (/^##\s+/.test(line)) {
      if (inList) { out.push('</ul>'); inList = false; }
      out.push(`<h2>${inline(line.replace(/^##\s+/, ''))}</h2>`);
      continue;
    }
    if (/^#\s+/.test(line)) {
      if (inList) { out.push('</ul>'); inList = false; }
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

    if (inList) {
      out.push('</ul>');
      inList = false;
    }
    out.push(`<p>${inline(line)}</p>`);
  }
  if (inList) out.push('</ul>');

  return out.join('\n');
}

export default function InvestigationPage() {
  const { id } = useParams<{ id: string }>();
  const [item, setItem] = useState<InvestigationArticle | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/data/investigations.json')
      .then((r) => r.json())
      .then((data: InvestigationArticle[]) => {
        const arr = Array.isArray(data) ? data : [];
        setItem(arr.find((x) => x.id === id) || null);
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

  const html = useMemo(() => renderMarkdown(item?.contentMarkdown || ''), [item?.contentMarkdown]);

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

        <article className="mt-10 border-t border-[#c9a227]/30 pt-8 prose prose-invert max-w-none prose-headings:font-black prose-headings:uppercase prose-p:text-white/85 prose-li:text-white/85 prose-strong:text-white prose-code:text-[#c9a227] prose-a:text-[#c9a227]">
          {item.contentMarkdown ? (
            <div dangerouslySetInnerHTML={{ __html: html }} />
          ) : (
            <p className="text-white/60">Контент ще готується.</p>
          )}
        </article>
      </div>
    </div>
  );
}
