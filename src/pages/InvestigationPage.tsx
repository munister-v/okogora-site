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
          <div class="chain-list">
            <div class="chain-row">
              <span class="chain-index">01</span>
              <div class="chain-copy"><strong>Установка ловить пошкодження</strong><p>Дим видно всім, але це лише верхній шар історії.</p></div>
            </div>
            <div class="chain-row">
              <span class="chain-index">02</span>
              <div class="chain-copy"><strong>Аварійний ремонт</strong><p>Кабелі, обвʼязка, насоси й автоматика часто повертаються швидше.</p></div>
            </div>
            <div class="chain-row">
              <span class="chain-index">03</span>
              <div class="chain-copy"><strong>Великий апарат вибито</strong><p>Колону або реактор неможливо повноцінно закрити за два тижні.</p></div>
            </div>
            <div class="chain-row">
              <span class="chain-index">04</span>
              <div class="chain-copy"><strong>Черга на заводі</strong><p>Метал, зварювання, контроль, термообробка, приймання.</p></div>
            </div>
            <div class="chain-row is-hot">
              <span class="chain-index">05</span>
              <div class="chain-copy"><strong>Простій розтягується</strong><p>Проблема переходить із НПЗ у важке машинобудування.</p></div>
            </div>
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
            <div class="radar-rings"></div>
            <div class="radar-sweep"></div>
            <div class="radar-core">НПЗ<br />простій</div>
            <div class="radar-item r1"><span class="radar-tag high">HIGH</span>відвантаження колон</div>
            <div class="radar-item r2"><span class="radar-tag med">MED</span>тендери на внутрішні пристрої</div>
            <div class="radar-item r3"><span class="radar-tag med">MED</span>нестандартні перевезення</div>
            <div class="radar-item r4"><span class="radar-tag high">HIGH</span>спецсталі й поковки</div>
            <div class="radar-item r5"><span class="radar-tag crit">CRIT</span>позапланові ремонти</div>
          </div>
          <div class="radar-notes">
            <div><strong>CRIT:</strong> сигнал, який часто передує довгому простою.</div>
            <div><strong>HIGH:</strong> висока ймовірність вузького місця в ремонті.</div>
            <div><strong>MED:</strong> підтверджує картину лише в комбінації з іншими даними.</div>
          </div>
        </section>
      `;
    }
    if (type === 'risk-matrix') {
      return `
        <section class="visual-block visual-risk" aria-label="Матриця імпортного ризику">
          <div class="visual-kicker">Import Risk Matrix</div>
          <div class="risk-grid">
            <div class="risk-card risk-critical"><span>Критичний</span><strong>DCS/ESD + КВПіА</strong><p>Без стабільної автоматики установка працює "на нервах", а не в проєкті.</p></div>
            <div class="risk-card risk-high"><span>Високий</span><strong>Каталізатор + ліцензія</strong><p>Формальний запуск можливий, але глибина та якість переробки просідає.</p></div>
            <div class="risk-card risk-high"><span>Високий</span><strong>Внутрішні пристрої колон</strong><p>Корпус є, але сепарація фракцій уже не тримає паспортний режим.</p></div>
            <div class="risk-card risk-mid"><span>Середній</span><strong>Корпусні апарати</strong><p>РФ може варити "важкий метал", але не закриває всю систему вузлів навколо.</p></div>
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

    const imageMatch = line.match(/^!\[(.*?)\]\(((?:https?:\/\/|\/)[^\s)]+)\)$/);
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

    // Bold label + text: convert to compact evidence row for entities/dates/plants
    const evidenceMatch = line.match(/^\*\*([^*]+)\*\*\s*(.+)$/);
    if (evidenceMatch) {
      closeList();
      out.push(`<div class="evidence-row"><div class="evidence-key">${inline(evidenceMatch[1])}</div><p class="evidence-value">${inline(evidenceMatch[2])}</p></div>`);
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

function StatusBadge({ status }: { status?: string }) {
  const value = (status || 'published').toLowerCase();
  const isPublished = value === 'published';
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium tracking-wide ${isPublished ? 'border-emerald-400/35 bg-emerald-400/10 text-emerald-200' : 'border-amber-400/35 bg-amber-400/10 text-amber-200'}`}>
      {isPublished ? 'Published' : value}
    </span>
  );
}

function RiskBadge({ tags }: { tags?: string[] }) {
  const joined = (tags || []).join(' ').toLowerCase();
  const level = joined.includes('critical') ? 'Critical' : joined.includes('high') ? 'High' : 'Medium';
  const cls = level === 'Critical'
    ? 'border-red-400/35 bg-red-400/10 text-red-200'
    : level === 'High'
      ? 'border-orange-400/35 bg-orange-400/10 text-orange-200'
      : 'border-sky-400/35 bg-sky-400/10 text-sky-200';
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium tracking-wide ${cls}`}>Risk: {level}</span>;
}

export default function InvestigationPage() {
  const { id } = useParams<{ id: string }>();
  const [item, setItem] = useState<InvestigationArticle | null>(null);
  const [allItems, setAllItems] = useState<InvestigationArticle[]>([]);
  const [markdown, setMarkdown] = useState('');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  useEffect(() => {
    setLoading(true);
    setMarkdown('');
    fetch(`/data/investigations.json?_t=${Date.now()}`)
      .then((r) => r.json())
      .then(async (data: InvestigationArticle[]) => {
        const arr = Array.isArray(data) ? data : [];
        setAllItems(arr);
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
  const related = useMemo(() => allItems.filter((x) => x.id !== item?.id && (x.status || 'published') === 'published').slice(0, 2), [allItems, item?.id]);
  const category = item?.tags?.[0] || 'OSINT';

  if (loading) return <div className="min-h-screen bg-[#252519] text-white flex items-center justify-center">Loading...</div>;
  if (!item) return <div className="min-h-screen bg-[#252519] text-white flex items-center justify-center">Not found</div>;

  return (
    <div className="min-h-screen bg-[#0c0f0b] text-white">
      <div className="relative overflow-hidden border-b border-[#c9a227]/20 bg-[#141812]">
        <div className="mx-auto max-w-[1280px] px-4 py-6 md:px-8 md:py-8">
          <Link to="/#investigations" className="inline-flex min-h-11 items-center gap-2 text-[12px] text-white/68 transition-colors hover:text-[#e4c76d]">
            <ArrowLeft className="h-3.5 w-3.5" /> До розслідувань
          </Link>
        </div>

        <section className="mx-auto grid max-w-[1280px] grid-cols-1 gap-8 px-4 pb-10 md:px-8 md:pb-14 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-8 xl:col-span-9">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-[#c9a227]/45 bg-[#c9a227]/10 px-3 py-1 text-[11px] font-medium tracking-wide text-[#f3d97f]">{item.code}</span>
              <StatusBadge status={item.status} />
              <RiskBadge tags={item.tags} />
            </div>
            <h1 className="max-w-5xl text-balance text-[2rem] font-semibold leading-[1.03] text-white md:text-[3rem] lg:text-[3.5rem]">{item.title}</h1>
            <p className="mt-5 max-w-3xl text-pretty text-base leading-7 text-white/72 md:text-lg">{item.summary}</p>
          </div>

          <aside className="lg:col-span-4 xl:col-span-3">
            <div className="rounded-xl border border-[#c9a227]/20 bg-[#0e120d]/85 p-5 md:p-6">
              <p className="mb-4 text-[11px] uppercase tracking-[0.08em] text-[#c9a227]/80">Article Meta</p>
              <div className="space-y-3 text-sm text-white/72">
                <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-2.5">
                  <span className="inline-flex items-center gap-2"><CalendarDays className="h-4 w-4 text-[#c9a227]" /> Опубліковано</span>
                  <span className="text-right">{formatArticleDate(item.publishedAt)}</span>
                </div>
                <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-2.5">
                  <span className="inline-flex items-center gap-2"><FileText className="h-4 w-4 text-[#c9a227]" /> Категорія</span>
                  <span>{category}</span>
                </div>
                <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-2.5">
                  <span className="inline-flex items-center gap-2"><BookOpen className="h-4 w-4 text-[#c9a227]" /> Читання</span>
                  <span>{readMinutes} хв</span>
                </div>
                <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-2.5">
                  <span className="inline-flex items-center gap-2"><Database className="h-4 w-4 text-[#c9a227]" /> Формат</span>
                  <span>OSINT</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-[#c9a227]" /> Точність</span>
                  <span>відкриті джерела</span>
                </div>
              </div>
              {item.url && (
                <a href={item.url} target="_blank" rel="noreferrer" className="mt-5 inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-[#c9a227]/40 px-4 py-3 text-[12px] text-[#f3d97f] transition-colors hover:bg-[#c9a227]/10">
                  Зовнішнє джерело <ArrowUpRight className="h-3 w-3" />
                </a>
              )}
            </div>
          </aside>
        </section>
      </div>

      <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-8 px-4 py-8 md:px-8 md:py-12 lg:grid-cols-12 lg:gap-10">
        <aside className="lg:col-span-3 xl:col-span-3">
          <div className="lg:sticky lg:top-24 space-y-4">
            <div className="rounded-xl border border-white/12 bg-[#111611] p-5">
              <div className="mb-4 flex items-center gap-2 text-[11px] uppercase tracking-[0.08em] text-[#c9a227]/80">
                <FileText className="h-3.5 w-3.5" /> Навігація
              </div>
              <nav className="space-y-1">
                {headings.slice(0, 10).map((heading) => (
                  <a key={heading.id} href={`#${heading.id}`} className="block border-l border-white/10 px-3 py-2 text-[13px] leading-snug text-white/56 transition-colors hover:border-[#c9a227]/70 hover:text-white/82">
                    {heading.label}
                  </a>
                ))}
              </nav>
            </div>
            {(item.tags || []).length > 0 && (
              <div className="rounded-xl border border-white/12 bg-[#111611] p-5">
                <p className="mb-3 text-[11px] uppercase tracking-[0.08em] text-[#c9a227]/80">Tags</p>
                <div className="flex flex-wrap gap-2">
                  {(item.tags || []).map((tag) => (
                    <span key={tag} className="rounded-full border border-white/15 bg-white/[0.03] px-2.5 py-1 text-[12px] text-white/75">{tag}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </aside>

        <main className="lg:col-span-9 xl:col-span-9">
          <article className="article-shell rounded-xl border border-white/12 bg-[#0f130f] p-5 md:p-8 lg:p-10">
            {markdown ? (
              <div className="article-body" dangerouslySetInnerHTML={{ __html: html }} />
            ) : (
              <p className="text-white/60">Контент ще готується.</p>
            )}
            <div className="share-bar">
              <span className="share-label">Поділитися розслідуванням</span>
              <button onClick={handleCopyLink} className="share-btn">
                {copied ? (
                  <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg> Скопійовано!</>
                ) : (
                  <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Копіювати посилання</>
                )}
              </button>
            </div>
            {related.length > 0 && (
              <section className="mt-8 border-t border-white/12 pt-6">
                <h3 className="mb-3 text-lg font-semibold text-white">Пов’язані матеріали</h3>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {related.map((r) => (
                    <Link key={r.id} to={`/investigation/${r.id}`} className="rounded-lg border border-white/12 bg-white/[0.02] p-4 transition-colors hover:border-[#c9a227]/45 hover:bg-white/[0.04]">
                      <p className="text-[11px] uppercase tracking-[0.08em] text-[#c9a227]/78">{r.id}</p>
                      <p className="mt-1 text-sm font-medium text-white">{r.title}</p>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </article>
        </main>
      </div>
      <style>{`
        html {
          scroll-behavior: smooth;
        }
        .share-bar {
          margin-top: 3rem;
          padding-top: 2rem;
          border-top: 1px solid rgba(255,255,255,0.1);
          display: flex;
          align-items: center;
          gap: 1rem;
          flex-wrap: wrap;
        }
        .share-label {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          font-size: 0.8rem;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: rgba(255,255,255,0.4);
          font-weight: 600;
        }
        .share-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.6rem 1.2rem;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          font-size: 0.82rem;
          font-weight: 600;
          color: #fff;
          background: transparent;
          border: 1px solid rgba(255,255,255,0.25);
          cursor: pointer;
          transition: background 0.15s, border-color 0.15s;
          letter-spacing: 0.02em;
        }
        .share-btn:hover {
          background: rgba(255,255,255,0.07);
          border-color: rgba(255,255,255,0.5);
        }
        .article-body {
          max-width: 740px;
          margin: 0 auto;
          color: rgba(255, 255, 255, 0.82);
          font-family: "Inter", "Segoe UI", "Noto Sans", Arial, sans-serif;
          font-size: 1.03rem;
          line-height: 1.78;
          text-align: left;
          hyphens: none;
          text-wrap: pretty;
        }
        .article-body > *:first-child {
          margin-top: 0;
        }
        .article-body h1,
        .article-body h2,
        .article-body h3 {
          font-family: "Inter", "Segoe UI", "Noto Sans", Arial, sans-serif;
          color: #ffffff;
          font-weight: 700;
          line-height: 1.16;
          letter-spacing: -0.015em;
          text-align: left;
          hyphens: none;
        }
        .article-body h2 {
          margin: 3rem 0 1rem;
          padding-top: 1rem;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          font-size: clamp(1.22rem, 2vw, 1.58rem);
          scroll-margin-top: 7rem;
        }
        .article-body h3 {
          margin: 2rem 0 0.7rem;
          font-size: 1.03rem;
          font-weight: 700;
          text-transform: none;
          text-align: left;
        }
        .article-body p {
          margin: 0 0 1.2rem;
          text-align: left;
          text-indent: 0;
        }
        /* No indent after headings, blockquotes, figures, lists */
        .article-body h2 + p,
        .article-body h3 + p,
        .article-body blockquote + p,
        .article-body figure + p,
        .article-body ul + p,
        .article-body hr + p,
        .article-body .visual-block + p {
          text-indent: 0;
        }
        /* Lead paragraph */
        .article-body p:first-of-type {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          font-size: 1.08rem;
          line-height: 1.6;
          color: rgba(255, 255, 255, 0.92);
          font-weight: 500;
          margin-bottom: 1.2rem;
          text-align: left;
          text-indent: 0;
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
          color: rgba(255, 255, 255, 0.95);
          font-weight: 600;
        }
        .evidence-row {
          margin: 1.35rem 0;
          border: 1px solid rgba(255,255,255,0.08);
          border-left: 2px solid rgba(201,162,39,0.55);
          border-radius: 10px;
          background: rgba(255,255,255,0.018);
          padding: 0.85rem 0.95rem;
        }
        .evidence-key {
          margin: 0 0 0.35rem;
          color: #f3d97f;
          font-size: 0.8rem;
          font-weight: 600;
          letter-spacing: 0.01em;
        }
        .evidence-value {
          margin: 0 !important;
          color: rgba(255,255,255,0.84);
          line-height: 1.58;
          font-size: 0.95rem;
        }
        .article-body code {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
          background: rgba(255, 255, 255, 0.1);
          padding: 0.2rem 0.4rem;
          font-size: 0.85em;
          border-radius: 3px;
        }
        .article-body blockquote {
          margin: 2rem 0;
          padding: 0.4rem 0 0.4rem 1.35rem;
          border-left: 2px solid rgba(201,162,39,0.55);
          color: rgba(255, 255, 255, 0.94);
          font-size: 1.16rem;
          font-style: normal;
          font-weight: 500;
          line-height: 1.48;
          background: transparent;
          border-radius: 0;
          text-align: left;
        }
        .article-body blockquote p {
          margin: 0;
          text-indent: 0;
        }
        .article-lead {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          font-size: 1.08rem;
          font-weight: 400;
          color: rgba(255,255,255,0.65);
          font-style: italic;
          margin: 0 0 2rem;
          line-height: 1.65;
          text-align: left;
        }
        .numbered-item {
          padding-left: 0;
          position: relative;
          margin: 0 0 0.75rem;
          color: rgba(255,255,255,0.88);
          text-align: left;
        }
        .numbered-item strong {
          color: #fff;
        }
        .visual-block {
          margin: 2.5rem 0;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          border: 0;
          border-radius: 0;
          padding: 0.25rem 0;
          background: transparent;
          box-shadow: none;
        }
        .visual-kicker {
          margin-bottom: 0.75rem;
          color: #888;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          font-size: 0.68rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .chain-list {
          position: relative;
          display: grid;
          gap: 0.85rem;
          padding-left: 0.35rem;
        }
        .chain-list::before {
          content: "";
          position: absolute;
          left: 1.05rem;
          top: 0.2rem;
          bottom: 0.2rem;
          width: 1px;
          background: rgba(255,255,255,0.12);
        }
        .chain-row {
          position: relative;
          display: grid;
          grid-template-columns: 2.4rem minmax(0, 1fr);
          gap: 1rem;
          align-items: start;
        }
        .chain-index {
          position: relative;
          z-index: 1;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 2rem;
          height: 2rem;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.18);
          background: #121511;
          color: rgba(255,255,255,0.74);
          font-size: 0.72rem;
          font-weight: 600;
          letter-spacing: 0.04em;
        }
        .chain-copy {
          padding: 0.15rem 0 0.9rem;
          border-bottom: 1px solid rgba(255,255,255,0.08);
        }
        .chain-row:last-child .chain-copy {
          border-bottom: 0;
          padding-bottom: 0;
        }
        .chain-row.is-hot .chain-index {
          border-color: rgba(201,162,39,0.4);
          color: #f3d97f;
        }
        .chain-copy strong {
          display: block;
          color: #fff;
          font-size: 0.98rem;
          line-height: 1.32;
          font-weight: 600;
        }
        .chain-copy p {
          margin: 0.32rem 0 0;
          color: rgba(255,255,255,0.74);
          font-size: 0.94rem;
          line-height: 1.54;
        }
        .clock-grid > div,
        .factory-grid > div {
          min-height: 100%;
          background: linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.015));
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 10px;
          padding: 1.25rem;
        }
        .clock-grid span,
        .factory-grid span {
          display: block;
          margin-bottom: 0.5rem;
          color: #888;
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
        }
        .clock-grid strong,
        .factory-grid strong {
          display: block;
          color: #fff;
          font-size: 0.9rem;
          line-height: 1.3;
          font-weight: 600;
        }
        .clock-grid p,
        .visual-factories p {
          margin: 0.5rem 0 0;
          color: rgba(255, 255, 255, 0.7);
          font-size: 0.8rem;
          line-height: 1.4;
        }
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
          gap: 0.6rem;
          background: transparent;
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
          gap: 0.6rem;
          background: transparent;
        }
        .risk-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.7rem;
        }
        .risk-card {
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.02);
          padding: 1rem;
        }
        .risk-card span {
          display: inline-block;
          margin-bottom: 0.55rem;
          padding: 0.18rem 0.5rem;
          border: 1px solid currentColor;
          font-size: 0.64rem;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          font-weight: 700;
        }
        .risk-card strong {
          display: block;
          color: #fff;
          font-size: 0.95rem;
          line-height: 1.32;
        }
        .risk-card p {
          margin: 0.55rem 0 0;
          color: rgba(255,255,255,0.74);
          font-size: 0.86rem;
          line-height: 1.5;
        }
        .risk-mid { border-color: rgba(245, 158, 11, 0.4); }
        .risk-mid span { color: #f59e0b; }
        .risk-high { border-color: rgba(249, 115, 22, 0.45); }
        .risk-high span { color: #f97316; }
        .risk-critical {
          border-color: rgba(239, 68, 68, 0.5);
          background: linear-gradient(180deg, rgba(84, 22, 22, 0.3), #151515);
        }
        .risk-critical span { color: #ef4444; }
        .radar-layout {
          position: relative;
          min-height: 430px;
          border: 1px solid rgba(255,255,255,0.18);
          border-radius: 14px;
          background: radial-gradient(circle at center, rgba(60, 60, 60, 0.32), #0f0f0f 64%);
          overflow: hidden;
        }
        .radar-rings {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(circle, transparent 16%, rgba(255,255,255,0.1) 16.4% 16.8%, transparent 17%),
            radial-gradient(circle, transparent 33%, rgba(255,255,255,0.08) 33.4% 33.8%, transparent 34%),
            radial-gradient(circle, transparent 50%, rgba(255,255,255,0.07) 50.4% 50.8%, transparent 51%);
        }
        .radar-sweep {
          position: absolute;
          inset: -20% -20%;
          background: conic-gradient(from 0deg, transparent 0deg, rgba(140, 255, 140, 0.16) 34deg, transparent 76deg);
          animation: radarSpin 7.2s linear infinite;
          transform-origin: center;
          pointer-events: none;
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
          border: 1px solid rgba(255,255,255,0.5);
          border-radius: 50%;
          background: #1a1a1a;
          color: #fff;
          font-size: 0.82rem;
          line-height: 1.2;
          z-index: 2;
        }
        .radar-item {
          width: 11rem;
          min-height: 3.5rem;
          border: 1px solid rgba(255,255,255,0.22);
          border-radius: 10px;
          background: rgba(18,18,18,0.92);
          padding: 0.75rem;
          color: rgba(255, 255, 255, 0.8);
          font-size: 0.76rem;
          line-height: 1.34;
          text-align: left;
          justify-content: flex-start;
          z-index: 2;
        }
        .radar-tag {
          display: inline-block;
          margin-bottom: 0.35rem;
          padding: 0.12rem 0.35rem;
          font-size: 0.6rem;
          font-weight: 700;
          letter-spacing: 0.04em;
          border: 1px solid currentColor;
          border-radius: 3px;
        }
        .radar-tag.med { color: #fbbf24; }
        .radar-tag.high { color: #fb923c; }
        .radar-tag.crit { color: #f87171; }
        .radar-notes {
          margin-top: 0.75rem;
          display: grid;
          gap: 0.4rem;
          color: rgba(255,255,255,0.72);
          font-size: 0.8rem;
          line-height: 1.45;
        }
        .radar-notes strong {
          font-weight: 600;
          color: rgba(255,255,255,0.92);
        }
        .r1 { left: 5%; top: 15%; }
        .r2 { right: 5%; top: 18%; }
        .r3 { left: 5%; bottom: 16%; }
        .r4 { right: 5%; bottom: 14%; }
        .r5 { left: 50%; top: 5%; transform: translateX(-50%); }
        .r1::after,
        .r2::after,
        .r3::after,
        .r4::after,
        .r5::after {
          content: "";
          position: absolute;
          width: 36px;
          height: 1px;
          background: rgba(255,255,255,0.26);
          top: 50%;
        }
        .r1::after, .r3::after { right: -30px; }
        .r2::after, .r4::after { left: -30px; }
        .r5::after {
          width: 1px;
          height: 30px;
          left: 50%;
          top: auto;
          bottom: -30px;
        }
        .article-body hr {
          margin: 2.2rem 0;
          border: 0;
          border-top: 1px solid rgba(255,255,255,0.08);
        }
        .article-body ul {
          margin: 0 0 1.5rem 1rem;
          padding: 0;
          list-style: none;
          text-align: left;
        }
        .article-body li {
          position: relative;
          margin: 0 0 0.65rem;
          padding-left: 1.35rem;
          color: rgba(255, 255, 255, 0.88);
          line-height: 1.7;
          text-align: left;
        }
        .article-body li::before {
          content: "—";
          position: absolute;
          left: 0;
          top: 0;
          color: rgba(255,255,255,0.3);
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }
        .article-table-wrap {
          overflow-x: auto;
          margin: 2.2rem 0;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 12px;
          padding: 0 0.85rem;
          background: rgba(255,255,255,0.015);
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
          padding: 0.92rem 0.6rem;
          vertical-align: top;
          text-align: left;
        }
        .article-table-wrap th {
          border-top: 1px solid #666;
          border-bottom: 2px solid #666;
          color: #fff;
          font-weight: 500;
          text-transform: uppercase;
          font-size: 0.72rem;
          letter-spacing: 0.05em;
        }
        .article-table-wrap td {
          color: rgba(255, 255, 255, 0.8);
          line-height: 1.4;
          font-size: 0.86rem;
        }
        figure {
          margin: 2rem 0;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,0.08);
        }
        figure img {
          width: 100%;
          height: 420px;
          object-fit: cover;
          display: block;
          background: #000;
        }
        figcaption {
          padding: 0.85rem 1rem;
          color: rgba(255, 255, 255, 0.4);
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          font-size: 0.78rem;
          line-height: 1.5;
          border-top: 1px solid rgba(255,255,255,0.08);
          text-align: left;
        }
        @media (max-width: 720px) {
          .article-body {
            font-size: 0.96rem;
            line-height: 1.66;
          }
          .article-body p {
            margin-bottom: 1rem;
          }
          .share-bar {
            margin-top: 2.2rem;
            padding-top: 1.5rem;
          }
          .chain-grid,
          .clock-grid,
          .risk-grid,
          .factory-grid,
          .visual-factories {
            grid-template-columns: 1fr;
          }
          .chain-row {
            grid-template-columns: 2.1rem minmax(0, 1fr);
            gap: 0.8rem;
          }
          .radar-layout {
            min-height: auto;
            display: grid;
            gap: 0.45rem;
            background: #111;
            border: 1px solid rgba(255,255,255,0.12);
          }
          .r1::after,
          .r2::after,
          .r3::after,
          .r4::after,
          .r5::after {
            display: none;
          }
          .radar-core,
          .radar-item {
            position: static;
            width: auto;
            min-height: 0;
            transform: none;
            background: rgba(18,18,18,0.95);
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
        @keyframes radarSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
