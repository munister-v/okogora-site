import { useState, useEffect } from 'react';
import { Post } from '../types';
import { verifyToken, savePosts, triggerTelegramSync } from '../lib/github';
import ImageUploader from '../components/ImageUploader';
import { importFromTelegraph } from '../lib/telegraph';
import { Shield, LogOut, Plus, Edit2, Trash2, Save, X, ChevronUp, ChevronDown, Eye, EyeOff, AlertTriangle, CheckCircle, Loader, Download, RefreshCw } from 'lucide-react';

const TOKEN_KEY = 'oko_admin_token';
const USER_KEY = 'oko_admin_user';

const emptyPost = (): Post => ({
  id: `TG-${Date.now()}`,
  date: new Date().toLocaleDateString('uk-UA', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase() + ' / ' + new Date().toTimeString().slice(0, 5),
  title: '',
  text: '',
  image: '',
  tags: [],
});

export default function AdminPage() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || '');
  const [username, setUsername] = useState(() => localStorage.getItem(USER_KEY) || '');
  const [tokenInput, setTokenInput] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  const [posts, setPosts] = useState<Post[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [editing, setEditing] = useState<Post | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const [saveMsg, setSaveMsg] = useState('');
  const [tgUrl, setTgUrl] = useState('');
  const [tgLoading, setTgLoading] = useState(false);
  const [tgError, setTgError] = useState('');
  const [showTgInput, setShowTgInput] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);

  const isAuthed = !!token && !!username;

  useEffect(() => {
    if (isAuthed) fetchPosts();
  }, [isAuthed]);

  async function fetchPosts() {
    setLoadingPosts(true);
    try {
      const res = await fetch(`/data/posts.json?t=${Date.now()}`);
      const data = await res.json();
      setPosts(data);
    } catch {
      setPosts([]);
    } finally {
      setLoadingPosts(false);
    }
  }

  async function handleLogin() {
    setAuthLoading(true);
    setAuthError('');
    const user = await verifyToken(tokenInput.trim());
    if (user) {
      localStorage.setItem(TOKEN_KEY, tokenInput.trim());
      localStorage.setItem(USER_KEY, user);
      setToken(tokenInput.trim());
      setUsername(user);
    } else {
      setAuthError('Невірний токен або немає доступу до репозиторію.');
    }
    setAuthLoading(false);
  }

  function handleLogout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken('');
    setUsername('');
    setTokenInput('');
    setPosts([]);
    setEditing(null);
  }

  async function handleSave() {
    if (!editing) return;
    setSaving(true);
    setSaveStatus('idle');

    const updated = isNew
      ? [editing, ...posts]
      : posts.map(p => p.id === editing.id ? editing : p);

    try {
      await savePosts(token, updated);
      setPosts(updated);
      setEditing(null);
      setIsNew(false);
      setSaveStatus('ok');
      setSaveMsg('Збережено та деплой запущено');
    } catch (e: any) {
      setSaveStatus('error');
      setSaveMsg(e.message || 'Помилка збереження');
    } finally {
      setSaving(false);
      setTimeout(() => setSaveStatus('idle'), 4000);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Видалити статтю?')) return;
    const updated = posts.filter(p => p.id !== id);
    setSaving(true);
    try {
      await savePosts(token, updated);
      setPosts(updated);
      setSaveStatus('ok');
      setSaveMsg('Видалено');
    } catch (e: any) {
      setSaveStatus('error');
      setSaveMsg(e.message || 'Помилка');
    } finally {
      setSaving(false);
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  }

  async function handleTelegraphImport() {
    if (!tgUrl.trim()) return;
    setTgLoading(true);
    setTgError('');
    try {
      const imported = await importFromTelegraph(tgUrl.trim());
      setEditing({ ...emptyPost(), ...imported } as Post);
      setIsNew(true);
      setShowTgInput(false);
      setTgUrl('');
    } catch (e: any) {
      setTgError(e.message || 'Помилка імпорту');
    } finally {
      setTgLoading(false);
    }
  }

  async function handleTelegramSync() {
    setSyncLoading(true);
    setSaveStatus('idle');

    try {
      await triggerTelegramSync(token);
      setSaveStatus('ok');
      setSaveMsg('Синхронізацію Telegram запущено у GitHub Actions');
    } catch (e: any) {
      setSaveStatus('error');
      setSaveMsg(e.message || 'Не вдалося запустити sync workflow');
    } finally {
      setSyncLoading(false);
      setTimeout(() => setSaveStatus('idle'), 5000);
    }
  }

  function movePost(idx: number, dir: -1 | 1) {
    const arr = [...posts];
    const swap = idx + dir;
    if (swap < 0 || swap >= arr.length) return;
    [arr[idx], arr[swap]] = [arr[swap], arr[idx]];
    setPosts(arr);
  }

  function addTag() {
    const t = tagInput.trim().toUpperCase().replace(/\s+/g, '_');
    if (t && editing && !editing.tags.includes(t)) {
      setEditing({ ...editing, tags: [...editing.tags, t] });
    }
    setTagInput('');
  }

  function removeTag(tag: string) {
    if (editing) setEditing({ ...editing, tags: editing.tags.filter(t => t !== tag) });
  }

  // ── Login screen ──────────────────────────────────────────────────────────
  if (!isAuthed) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="border border-[#f4f4f4]/10 bg-[#111111] p-10">
            <div className="flex items-center gap-3 mb-10 pb-6 border-b border-[#f4f4f4]/10">
              <Shield className="w-5 h-5 text-[#f4f4f4]/40" />
              <span className="font-mono text-xs uppercase tracking-[0.3em] text-[#f4f4f4]/80">ОКО ГОРА // АДМІН</span>
            </div>

            <h1 className="text-3xl font-bold text-white tracking-tighter uppercase mb-2">Вхід</h1>
            <p className="text-[#f4f4f4]/30 font-mono text-[10px] uppercase tracking-widest mb-10">
              GitHub Personal Access Token (repo scope)
            </p>

            <div className="space-y-4">
              <div className="relative">
                <input
                  type={showToken ? 'text' : 'password'}
                  value={tokenInput}
                  onChange={e => setTokenInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  placeholder="ghp_..."
                  className="w-full bg-[#1a1a1a] border border-[#f4f4f4]/10 text-white font-mono text-sm px-4 py-3 pr-12 outline-none focus:border-[#f4f4f4]/40 placeholder:text-[#f4f4f4]/20 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(v => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#f4f4f4]/30 hover:text-[#f4f4f4]/70"
                >
                  {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {authError && (
                <div className="flex items-center gap-2 text-red-400 font-mono text-[10px] bg-red-500/10 border border-red-500/20 px-4 py-3">
                  <AlertTriangle className="w-3 h-3 shrink-0" />
                  {authError}
                </div>
              )}

              <button
                onClick={handleLogin}
                disabled={!tokenInput || authLoading}
                className="w-full bg-white text-[#111111] font-mono font-bold text-xs uppercase tracking-widest py-3 hover:bg-[#f4f4f4] disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {authLoading ? <Loader className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                {authLoading ? 'ПЕРЕВІРКА...' : 'УВІЙТИ'}
              </button>
            </div>

            <p className="mt-8 text-[#f4f4f4]/20 font-mono text-[9px] leading-relaxed">
              Токен зберігається тільки локально у браузері.<br />
              Потрібні права: <span className="text-[#f4f4f4]/50">repo</span> (для запису в репозиторій).
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Editor overlay ────────────────────────────────────────────────────────
  if (editing) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-[#f4f4f4] p-4 md:p-8">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8 pb-6 border-b border-[#f4f4f4]/10">
            <div className="flex items-center gap-3">
              <Edit2 className="w-4 h-4 text-[#f4f4f4]/40" />
              <span className="font-mono text-xs uppercase tracking-widest text-[#f4f4f4]/60">
                {isNew ? 'НОВА СТАТТЯ' : `РЕДАГУВАННЯ // ${editing.id}`}
              </span>
            </div>
            <button onClick={() => { setEditing(null); setIsNew(false); }} className="text-[#f4f4f4]/30 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-mono text-[9px] uppercase tracking-widest text-[#f4f4f4]/30 mb-2">ID</label>
                <input
                  value={editing.id}
                  onChange={e => setEditing({ ...editing, id: e.target.value })}
                  className="w-full bg-[#1a1a1a] border border-[#f4f4f4]/10 text-white font-mono text-sm px-4 py-2.5 outline-none focus:border-[#f4f4f4]/40 transition-colors"
                />
              </div>
              <div>
                <label className="block font-mono text-[9px] uppercase tracking-widest text-[#f4f4f4]/30 mb-2">ДАТА</label>
                <input
                  value={editing.date}
                  onChange={e => setEditing({ ...editing, date: e.target.value })}
                  className="w-full bg-[#1a1a1a] border border-[#f4f4f4]/10 text-white font-mono text-sm px-4 py-2.5 outline-none focus:border-[#f4f4f4]/40 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block font-mono text-[9px] uppercase tracking-widest text-[#f4f4f4]/30 mb-2">ЗАГОЛОВОК</label>
              <input
                value={editing.title}
                onChange={e => setEditing({ ...editing, title: e.target.value })}
                placeholder="Заголовок статті..."
                className="w-full bg-[#1a1a1a] border border-[#f4f4f4]/10 text-white text-lg px-4 py-3 outline-none focus:border-[#f4f4f4]/40 transition-colors placeholder:text-[#f4f4f4]/20"
              />
            </div>

            <div>
              <label className="block font-mono text-[9px] uppercase tracking-widest text-[#f4f4f4]/30 mb-2">ТЕКСТ</label>
              <textarea
                rows={8}
                value={editing.text}
                onChange={e => setEditing({ ...editing, text: e.target.value })}
                placeholder="Текст статті..."
                className="w-full bg-[#1a1a1a] border border-[#f4f4f4]/10 text-white text-sm px-4 py-3 outline-none focus:border-[#f4f4f4]/40 transition-colors resize-none leading-relaxed placeholder:text-[#f4f4f4]/20"
              />
            </div>

            <ImageUploader
              token={token}
              value={editing.image}
              onChange={img => setEditing({ ...editing, image: img })}
            />

            <div>
              <label className="block font-mono text-[9px] uppercase tracking-widest text-[#f4f4f4]/30 mb-2">ТЕГИ</label>
              <div className="flex flex-wrap gap-2 mb-3">
                {editing.tags.map(tag => (
                  <span key={tag} className="flex items-center gap-1.5 px-3 py-1 border border-[#f4f4f4]/20 font-mono text-[9px] tracking-widest text-[#f4f4f4]/70">
                    #{tag}
                    <button onClick={() => removeTag(tag)} className="text-[#f4f4f4]/30 hover:text-red-400 transition-colors">
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                  placeholder="НОВИЙ_ТЕГ"
                  className="flex-1 bg-[#1a1a1a] border border-[#f4f4f4]/10 text-white font-mono text-xs px-4 py-2.5 outline-none focus:border-[#f4f4f4]/40 transition-colors uppercase placeholder:text-[#f4f4f4]/20"
                />
                <button onClick={addTag} className="px-4 py-2.5 border border-[#f4f4f4]/20 font-mono text-xs text-[#f4f4f4]/60 hover:text-white hover:border-[#f4f4f4]/60 transition-colors">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-10 flex items-center justify-between pt-6 border-t border-[#f4f4f4]/10">
            <button
              onClick={() => { setEditing(null); setIsNew(false); }}
              className="font-mono text-xs uppercase tracking-widest text-[#f4f4f4]/30 hover:text-white transition-colors"
            >
              СКАСУВАТИ
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !editing.title}
              className="flex items-center gap-2 bg-white text-[#111111] font-mono font-bold text-xs uppercase tracking-widest px-8 py-3 hover:bg-[#f4f4f4] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'ЗБЕРЕЖЕННЯ...' : 'ЗБЕРЕГТИ І ДЕПЛОЇТИ'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main admin dashboard ──────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#f4f4f4]">
      {/* Top bar */}
      <div className="border-b border-[#f4f4f4]/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="font-mono text-xs uppercase tracking-widest text-[#f4f4f4]/80">ОКО ГОРА // АДМІН</span>
          <span className="font-mono text-[9px] text-[#f4f4f4]/20 ml-4">@{username}</span>
        </div>
        <div className="flex items-center gap-4">
          <a href="/" className="font-mono text-[9px] uppercase tracking-widest text-[#f4f4f4]/30 hover:text-white transition-colors flex items-center gap-1.5">
            <Eye className="w-3 h-3" /> САЙТ
          </a>
          <button onClick={handleLogout} className="font-mono text-[9px] uppercase tracking-widest text-[#f4f4f4]/30 hover:text-red-400 transition-colors flex items-center gap-1.5">
            <LogOut className="w-3 h-3" /> ВИЙТИ
          </button>
        </div>
      </div>

      {/* Status toast */}
      {saveStatus !== 'idle' && (
        <div className={`flex items-center gap-2 px-6 py-3 font-mono text-xs border-b ${saveStatus === 'ok' ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
          {saveStatus === 'ok' ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {saveMsg}
          {saveStatus === 'ok' && <span className="text-[#f4f4f4]/30 ml-2">— GitHub Actions деплой запущено автоматично</span>}
        </div>
      )}

      <div className="max-w-5xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex items-end justify-between mb-10">
          <div>
            <h1 className="text-4xl font-bold uppercase tracking-tighter mb-1">Статті</h1>
            <p className="font-mono text-[10px] text-[#f4f4f4]/30 uppercase tracking-widest">{posts.length} публікацій</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Telegraph import */}
            {showTgInput ? (
              <div className="flex items-center gap-2">
                <div className="flex flex-col gap-1">
                  <div className="flex gap-2">
                    <input
                      autoFocus
                      value={tgUrl}
                      onChange={e => { setTgUrl(e.target.value); setTgError(''); }}
                      onKeyDown={e => e.key === 'Enter' && handleTelegraphImport()}
                      placeholder="https://telegra.ph/..."
                      className="w-72 bg-[#1a1a1a] border border-[#f4f4f4]/20 text-white font-mono text-xs px-3 py-2.5 outline-none focus:border-[#f4f4f4]/50 placeholder:text-[#f4f4f4]/20 transition-colors"
                    />
                    <button
                      onClick={handleTelegraphImport}
                      disabled={!tgUrl || tgLoading}
                      className="flex items-center gap-2 border border-[#f4f4f4]/20 text-[#f4f4f4]/70 font-mono text-xs uppercase tracking-widest px-4 py-2.5 hover:text-white hover:border-[#f4f4f4]/60 disabled:opacity-30 transition-colors"
                    >
                      {tgLoading ? <Loader className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                      {tgLoading ? 'ІМПОРТ...' : 'OK'}
                    </button>
                    <button
                      onClick={() => { setShowTgInput(false); setTgUrl(''); setTgError(''); }}
                      className="px-3 py-2.5 border border-[#f4f4f4]/10 text-[#f4f4f4]/30 hover:text-white transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  {tgError && (
                    <div className="flex items-center gap-1.5 text-red-400 font-mono text-[9px]">
                      <AlertTriangle className="w-3 h-3" /> {tgError}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowTgInput(true)}
                className="flex items-center gap-2 border border-[#f4f4f4]/15 text-[#f4f4f4]/50 font-mono text-xs uppercase tracking-widest px-5 py-3 hover:text-white hover:border-[#f4f4f4]/50 transition-colors"
              >
                <Download className="w-4 h-4" /> TELEGRAPH
              </button>
            )}

            <button
              onClick={handleTelegramSync}
              disabled={syncLoading}
              className="flex items-center gap-2 border border-[#f4f4f4]/15 text-[#f4f4f4]/50 font-mono text-xs uppercase tracking-widest px-5 py-3 hover:text-white hover:border-[#f4f4f4]/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title="Запустити GitHub Action sync-telegram-posts.yml"
            >
              {syncLoading ? <Loader className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {syncLoading ? 'SYNC...' : 'SYNC TG'}
            </button>

            <button
              onClick={() => { setEditing(emptyPost()); setIsNew(true); }}
              className="flex items-center gap-2 bg-white text-[#111111] font-mono font-bold text-xs uppercase tracking-widest px-6 py-3 hover:bg-[#f4f4f4] transition-colors"
            >
              <Plus className="w-4 h-4" /> НОВА СТАТТЯ
            </button>
          </div>
        </div>

        {/* Posts list */}
        {loadingPosts ? (
          <div className="flex items-center justify-center py-24 text-[#f4f4f4]/20">
            <Loader className="w-6 h-6 animate-spin mr-3" />
            <span className="font-mono text-xs uppercase tracking-widest">Завантаження...</span>
          </div>
        ) : (
          <div className="space-y-2">
            {posts.map((post, idx) => (
              <div
                key={post.id}
                className="flex items-center gap-4 bg-[#111111] border border-[#f4f4f4]/5 px-5 py-4 hover:border-[#f4f4f4]/20 transition-colors group"
              >
                {/* Order controls */}
                <div className="flex flex-col gap-0.5 shrink-0">
                  <button onClick={() => movePost(idx, -1)} disabled={idx === 0} className="text-[#f4f4f4]/20 hover:text-white disabled:opacity-10 transition-colors">
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => movePost(idx, 1)} disabled={idx === posts.length - 1} className="text-[#f4f4f4]/20 hover:text-white disabled:opacity-10 transition-colors">
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Post info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-mono text-[9px] text-[#f4f4f4]/30 shrink-0">{post.id}</span>
                    <span className="font-mono text-[9px] text-[#f4f4f4]/20 shrink-0">{post.date}</span>
                    <div className="flex gap-1 flex-wrap">
                      {post.tags.map(t => (
                        <span key={t} className="font-mono text-[8px] px-1.5 py-0.5 border border-[#f4f4f4]/10 text-[#f4f4f4]/30 tracking-wide">#{t}</span>
                      ))}
                    </div>
                  </div>
                  <p className="text-sm font-medium text-[#f4f4f4]/90 truncate">{post.title}</p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => { setEditing(post); setIsNew(false); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-[#f4f4f4]/20 font-mono text-[9px] uppercase tracking-widest text-[#f4f4f4]/60 hover:text-white hover:border-[#f4f4f4]/60 transition-colors"
                  >
                    <Edit2 className="w-3 h-3" /> РЕДАГУВАТИ
                  </button>
                  <button
                    onClick={() => handleDelete(post.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-red-500/20 font-mono text-[9px] uppercase tracking-widest text-red-500/60 hover:text-red-400 hover:border-red-500/60 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Save order button */}
        {posts.length > 0 && (
          <div className="mt-6 flex justify-end">
            <button
              onClick={async () => {
                setSaving(true);
                try {
                  await savePosts(token, posts);
                  setSaveStatus('ok');
                  setSaveMsg('Порядок збережено');
                } catch (e: any) {
                  setSaveStatus('error');
                  setSaveMsg(e.message);
                } finally {
                  setSaving(false);
                  setTimeout(() => setSaveStatus('idle'), 3000);
                }
              }}
              disabled={saving}
              className="flex items-center gap-2 border border-[#f4f4f4]/20 font-mono text-[9px] uppercase tracking-widest text-[#f4f4f4]/40 hover:text-white hover:border-[#f4f4f4]/60 px-5 py-2.5 transition-colors disabled:opacity-30"
            >
              {saving ? <Loader className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              ЗБЕРЕГТИ ПОРЯДОК
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
