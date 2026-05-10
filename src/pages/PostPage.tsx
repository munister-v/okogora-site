import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, ArrowUpRight, Calendar, Tag } from 'lucide-react';
import { Post } from '../types';
import { normalizePosts, postTelegramUrl, resolveImageUrl, splitParagraphs } from '../lib/posts';
import { setSeo } from '../lib/seo';

function renderInlineLinks(text: string) {
  const regex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(regex);

  return parts.map((part, idx) => {
    if (/^https?:\/\//.test(part)) {
      return (
        <a key={`l-${idx}`} href={part} target="_blank" rel="noreferrer" className="underline decoration-[#FF4E00]/30 hover:decoration-[#FF4E00] break-all">
          {part}
        </a>
      );
    }
    return <span key={`t-${idx}`}>{part}</span>;
  });
}

export default function PostPage() {
  const { id } = useParams<{ id: string }>();
  const [post, setPost] = useState<Post | null>(null);
  const [allPosts, setAllPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/data/posts.json')
      .then(r => r.json())
      .then((data: Post[]) => {
        const normalized = normalizePosts(data);
        setAllPosts(normalized);
        setPost(normalized.find(p => p.id === id) || null);
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!post) return;
    setSeo({
      title: post.title,
      description: post.text.slice(0, 160),
      path: `/post/${post.id}`,
      image: resolveImageUrl(post.image) || 'https://okogora.com.ua/oko_logo.png',
      type: 'article',
    });
  }, [post]);

  const related = allPosts.filter(p => p.id !== id).slice(0, 2);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050517] flex items-center justify-center">
        <div className="font-mono text-[10px] uppercase tracking-widest text-white/30 animate-pulse">
          Завантаження...
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-[#050517] flex flex-col items-center justify-center gap-6">
        <p className="font-mono text-[10px] uppercase tracking-widest text-white/40">
          Статтю не знайдено
        </p>
        <Link to="/" className="font-mono text-xs uppercase tracking-widest underline hover:opacity-60 transition-opacity">
          На головну
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050517] text-white selection:bg-[#FF4E00] selection:text-[#050517]">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-[1000] border-b border-[#FF4E00]/20 bg-[#050517]/95 backdrop-blur-md">
        <div className="grid grid-cols-2 md:grid-cols-4 px-4 md:px-8 py-3 md:py-4 text-[10px] md:text-xs font-mono uppercase tracking-widest items-center">
          <div className="col-span-1 flex items-center gap-2">
            <div className="w-4 h-4 bg-[#FF4E00] rounded-sm flex items-center justify-center">
              <div className="w-1.5 h-1.5 bg-[#050517] rounded-sm animate-pulse" />
            </div>
            <Link to="/" className="font-bold tracking-tighter hover:text-[#FF4E00] transition-colors">ОКО ГОРА</Link>
          </div>
          <div className="hidden md:block col-span-2 text-center text-white/30">
            СТРАТЕГІЧНИЙ_OSINT_МОНІТОР_V3.0_UA
          </div>
          <div className="col-span-1 flex justify-end">
            <a href="https://t.me/oko_gora" target="_blank" rel="noreferrer"
              className="hover:text-[#FF4E00] transition-colors flex items-center gap-1 font-bold">
              ТЕЛЕГРАМ <ArrowUpRight className="w-3 h-3" />
            </a>
          </div>
        </div>
      </nav>

      <main className="pt-24 md:pt-32 pb-24">
        {/* Back */}
        <div className="px-4 md:px-8 mb-8 md:mb-12 max-w-[1000px] mx-auto">
          <Link
            to="/"
            className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-white/40 hover:text-[#FF4E00] transition-colors"
          >
            <ArrowLeft className="w-3 h-3" /> Назад
          </Link>
        </div>

        <motion.article
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-[1000px] mx-auto px-4 md:px-8"
        >
          {/* Meta */}
          <div className="flex flex-wrap items-center gap-4 mb-6 font-mono text-[9px] uppercase tracking-[0.2em] text-white/40">
            <span className="font-bold text-white/70">{post.id}</span>
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3 h-3" /> {post.date}
            </span>
          </div>

          {/* Title */}
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tighter uppercase leading-[0.9] mb-10 md:mb-16">
            {post.title}
          </h1>

          {/* Hero image */}
          {post.image && (
            <div className="w-full aspect-video overflow-hidden bg-[#0a0a2e] mb-10 md:mb-16 relative">
              <img
                src={resolveImageUrl(post.image)}
                alt={post.title}
                onError={e => { (e.target as HTMLImageElement).parentElement!.style.display = 'none'; }}
                className="w-full h-full object-cover contrast-[1.04] saturate-110"
              />
              <div className="absolute inset-0 bg-black/0" />
              {post.imageMeta?.qualityFlag && (
                <div className="absolute top-3 right-3 px-2 py-1 bg-black/55 text-white font-mono text-[8px] tracking-widest uppercase">
                  {post.imageMeta.qualityFlag}
                </div>
              )}
            </div>
          )}

          {/* Body */}
          <div className="max-w-2xl">
            <div className="space-y-5 text-lg md:text-xl leading-relaxed text-white/75 mb-10">
              {splitParagraphs(post.text).map((paragraph, idx) => (
                /^[\-\u2022]\s/m.test(paragraph) ? (
                  <ul key={`${post.id}-p-${idx}`} className="space-y-2 pl-5 list-disc marker:text-[#FF4E00]/60">
                    {paragraph
                      .split('\n')
                      .map(line => line.trim())
                      .filter(Boolean)
                      .map((line, liIdx) => (
                        <li key={`${post.id}-p-${idx}-li-${liIdx}`}>{renderInlineLinks(line.replace(/^[\-\u2022]\s*/, ''))}</li>
                      ))}
                  </ul>
                ) : (
                  <p key={`${post.id}-p-${idx}`}>{renderInlineLinks(paragraph)}</p>
                )
              ))}
            </div>

            <div className="mb-10">
              <a
                href={postTelegramUrl(post)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-white/40 hover:text-[#FF4E00] transition-colors"
              >
                Джерело в Telegram <ArrowUpRight className="w-3.5 h-3.5" />
              </a>
            </div>

            {/* Tags */}
            {post.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-8 border-t border-white/10">
                <Tag className="w-3 h-3 text-white/30 mt-0.5" />
                {post.tags.map(tag => (
                  <span
                    key={tag}
                    className="px-3 py-1 border border-white/10 font-mono text-[9px] tracking-widest uppercase text-white/50"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </motion.article>

        {/* Related posts */}
        {related.length > 0 && (
          <div className="max-w-[1000px] mx-auto px-4 md:px-8 mt-24 md:mt-32">
            <div className="border-t border-[#111111] pt-10 mb-10">
              <h2 className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/40">
                / ТАКОЖ ЧИТАЙТЕ
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16">
              {related.map(p => (
                <Link key={p.id} to={`/post/${p.id}`} className="group">
                  {p.image && (
                    <div className="aspect-video w-full overflow-hidden bg-[#0a0a2e] mb-5">
                      <img
                        src={resolveImageUrl(p.image)}
                        alt={p.title}
                        onError={e => { (e.target as HTMLImageElement).parentElement!.style.display = 'none'; }}
                        className="w-full h-full object-cover contrast-[1.04] saturate-110 group-hover:scale-105 transition-all duration-700"
                      />
                    </div>
                  )}
                  <div className="font-mono text-[9px] text-white/40 uppercase tracking-[0.2em] mb-2">
                    {p.id} · {p.date}
                  </div>
                  <h3 className="text-xl md:text-2xl font-bold uppercase tracking-tight group-hover:underline transition-all">
                    {p.title}
                  </h3>
                </Link>
              ))}
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-[#FF4E00]/30 px-4 md:px-8 py-16 bg-[#050517] text-white">
        <div className="max-w-[1000px] mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <Link to="/" className="text-3xl font-bold tracking-tighter uppercase hover:opacity-60 transition-opacity">
            Око Гора
          </Link>
          <div className="font-mono text-[9px] text-white/20 uppercase tracking-widest">
            © {new Date().getFullYear()} OKO GORA GROUP
          </div>
        </div>
      </footer>
    </div>
  );
}
