import { useState, useEffect } from 'react';
import { Post, InvestigationArticle } from '../types';
import { verifyToken, savePosts, saveInvestigations, saveRssConfig, triggerTelegramSync, triggerXRssSync, triggerFacebookRssSync, fetchWorkflowDashboard, WorkflowRunStatus, RssSyncConfig } from '../lib/github';
import ImageUploader from '../components/ImageUploader';
import { importFromTelegraph } from '../lib/telegraph';
import { Shield, LogOut, Plus, Edit2, Trash2, Save, X, ChevronUp, ChevronDown, Eye, EyeOff, AlertTriangle, CheckCircle, Loader, Download, RefreshCw, Sparkles, CircleHelp } from 'lucide-react';
import { setSeo } from '../lib/seo';

const TOKEN_KEY = 'oko_admin_token';
const USER_KEY = 'oko_admin_user';

const emptyPost = (): Post => ({
  id: `TG-${Date.now()}`,
  date: new Date().toLocaleDateString('uk-UA', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase() + ' / ' + new Date().toTimeString().slice(0, 5),
  title: '',
  text: '',
  image: '',
  tags: [],
  telegramUrl: '',
});

const defaultRssConfig: RssSyncConfig = {
  windowDays: 3,
  maxItems: 80,
  authors: [
    { handle: 'OSINTtechnical', name: 'OSINTtechnical' },
    { handle: 'GeoConfirmed', name: 'GeoConfirmed' },
    { handle: 'DefMon3', name: 'Def Mon' },
    { handle: 'NOELreports', name: 'NOELREPORTS' },
    { handle: 'War_Mapper', name: 'War Mapper' },
    { handle: 'ChrisO_wiki', name: 'ChrisO_wiki' },
    { handle: 'Tendar', name: 'Tendar' },
    { handle: 'RALee85', name: 'Rob Lee' },
  ],
  keywords: ['ukraine', 'osint', 'humint'],
  excludeKeywords: ['giveaway', 'promo'],
};

export default function AdminPage() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || '');
  const [username, setUsername] = useState(() => localStorage.getItem(USER_KEY) || '');
  const [tokenInput, setTokenInput] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  const [posts, setPosts] = useState<Post[]>([]);
  const [investigations, setInvestigations] = useState<InvestigationArticle[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [loadingInvestigations, setLoadingInvestigations] = useState(false);
  const [editing, setEditing] = useState<Post | null>(null);
  const [editingInvestigation, setEditingInvestigation] = useState<InvestigationArticle | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [isNewInvestigation, setIsNewInvestigation] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [invTagInput, setInvTagInput] = useState('');
  const [postSearch, setPostSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const [saveMsg, setSaveMsg] = useState('');
  const [tgUrl, setTgUrl] = useState('');
  const [tgLoading, setTgLoading] = useState(false);
  const [tgError, setTgError] = useState('');
  const [showTgInput, setShowTgInput] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [workflowLoading, setWorkflowLoading] = useState(false);
  const [workflowError, setWorkflowError] = useState('');
  const [syncRun, setSyncRun] = useState<WorkflowRunStatus | null>(null);
  const [xRssRun, setXRssRun] = useState<WorkflowRunStatus | null>(null);
  const [fbRssRun, setFbRssRun] = useState<WorkflowRunStatus | null>(null);
  const [deployRun, setDeployRun] = useState<WorkflowRunStatus | null>(null);
  const [xRssLoading, setXRssLoading] = useState(false);
  const [fbRssLoading, setFbRssLoading] = useState(false);

  const [rssConfig, setRssConfig] = useState<RssSyncConfig>(defaultRssConfig);
  const [rssConfigLoading, setRssConfigLoading] = useState(false);
  const [rssConfigSaving, setRssConfigSaving] = useState(false);
  const [authorsInput, setAuthorsInput] = useState('');
  const [keywordsInput, setKeywordsInput] = useState('');
  const [excludeInput, setExcludeInput] = useState('');

  const isAuthed = !!token && !!username;

  useEffect(() => {
    setSeo({
      title: 'Адмін-панель',
      description: 'Внутрішня панель керування контентом Око Гора.',
      path: '/admin',
      noindex: true,
    });
  }, []);

  useEffect(() => {
    if (isAuthed) {
      fetchPosts();
      fetchInvestigations();
      fetchRssConfigFromSite();
      refreshWorkflowStatus();
    }
  }, [isAuthed]);

  useEffect(() => {
    if (!isAuthed) return;
    const shouldPoll =
      syncRun?.status === 'queued' ||
      syncRun?.status === 'in_progress' ||
      xRssRun?.status === 'queued' ||
      xRssRun?.status === 'in_progress' ||
      fbRssRun?.status === 'queued' ||
      fbRssRun?.status === 'in_progress' ||
      deployRun?.status === 'queued' ||
      deployRun?.status === 'in_progress';
    if (!shouldPoll) return;

    const timer = setInterval(() => {
      refreshWorkflowStatus();
    }, 7000);

    return () => clearInterval(timer);
  }, [isAuthed, syncRun?.status, xRssRun?.status, fbRssRun?.status, deployRun?.status]);

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

  async function fetchInvestigations() {
    setLoadingInvestigations(true);
    try {
      const res = await fetch(`/data/investigations.json?t=${Date.now()}`);
      const data = await res.json();
      setInvestigations(Array.isArray(data) ? data : []);
    } catch {
      setInvestigations([]);
    } finally {
      setLoadingInvestigations(false);
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
      setSaveMsg('SYNC запущено. Статус нижче в Pipeline Monitor');
      await refreshWorkflowStatus();
    } catch (e: any) {
      setSaveStatus('error');
      setSaveMsg(e.message || 'Не вдалося запустити sync workflow');
    } finally {
      setSyncLoading(false);
      setTimeout(() => setSaveStatus('idle'), 5000);
    }
  }

  async function handleXRssSync() {
    setXRssLoading(true);
    setSaveStatus('idle');
    try {
      await triggerXRssSync(token);
      setSaveStatus('ok');
      setSaveMsg('X RSS sync запущено. Статус нижче в Pipeline Monitor');
      await refreshWorkflowStatus();
    } catch (e: any) {
      setSaveStatus('error');
      setSaveMsg(e.message || 'Не вдалося запустити X RSS sync');
    } finally {
      setXRssLoading(false);
      setTimeout(() => setSaveStatus('idle'), 5000);
    }
  }

  async function handleFacebookRssSync() {
    setFbRssLoading(true);
    setSaveStatus('idle');
    try {
      await triggerFacebookRssSync(token);
      setSaveStatus('ok');
      setSaveMsg('Facebook RSS sync запущено. Статус нижче в Pipeline Monitor');
      await refreshWorkflowStatus();
    } catch (e: any) {
      setSaveStatus('error');
      setSaveMsg(e.message || 'Не вдалося запустити Facebook RSS sync');
    } finally {
      setFbRssLoading(false);
      setTimeout(() => setSaveStatus('idle'), 5000);
    }
  }

  async function fetchRssConfigFromSite() {
    setRssConfigLoading(true);
    try {
      const res = await fetch(`/data/rss_twitter_config.json?t=${Date.now()}`);
      const raw = await res.json();
      const cfg: RssSyncConfig = {
        windowDays: Number(raw?.windowDays) > 0 ? Number(raw.windowDays) : defaultRssConfig.windowDays,
        maxItems: Number(raw?.maxItems) > 0 ? Number(raw.maxItems) : defaultRssConfig.maxItems,
        authors: Array.isArray(raw?.authors) ? raw.authors : defaultRssConfig.authors,
        keywords: Array.isArray(raw?.keywords) ? raw.keywords : defaultRssConfig.keywords,
        excludeKeywords: Array.isArray(raw?.excludeKeywords) ? raw.excludeKeywords : defaultRssConfig.excludeKeywords,
      };
      setRssConfig(cfg);
      setAuthorsInput(cfg.authors.map((a) => `${a.handle} | ${a.name}`).join('\n'));
      setKeywordsInput(cfg.keywords.join('\n'));
      setExcludeInput(cfg.excludeKeywords.join('\n'));
    } catch {
      setRssConfig(defaultRssConfig);
      setAuthorsInput(defaultRssConfig.authors.map((a) => `${a.handle} | ${a.name}`).join('\n'));
      setKeywordsInput(defaultRssConfig.keywords.join('\n'));
      setExcludeInput(defaultRssConfig.excludeKeywords.join('\n'));
    } finally {
      setRssConfigLoading(false);
    }
  }

  async function handleSaveRssConfig() {
    const parsedAuthors = authorsInput
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line) => {
        const [handle, ...nameParts] = line.split('|').map((p) => p.trim());
        return {
          handle: (handle || '').replace(/^@/, ''),
          name: nameParts.join(' | ') || (handle || '').replace(/^@/, ''),
        };
      })
      .filter((a) => a.handle);

    const parsedKeywords = keywordsInput.split('\n').map((l) => l.trim()).filter(Boolean);
    const parsedExclude = excludeInput.split('\n').map((l) => l.trim()).filter(Boolean);

    const nextConfig: RssSyncConfig = {
      windowDays: Math.max(1, Math.min(14, Number(rssConfig.windowDays) || 3)),
      maxItems: Math.max(10, Math.min(200, Number(rssConfig.maxItems) || 80)),
      authors: parsedAuthors.length ? parsedAuthors : defaultRssConfig.authors,
      keywords: parsedKeywords.length ? parsedKeywords : defaultRssConfig.keywords,
      excludeKeywords: parsedExclude,
    };

    setRssConfigSaving(true);
    setSaveStatus('idle');
    try {
      await saveRssConfig(token, nextConfig);
      setRssConfig(nextConfig);
      setSaveStatus('ok');
      setSaveMsg('RSS-конфіг збережено. Запусти X RSS sync для оновлення стрічки.');
    } catch (e: any) {
      setSaveStatus('error');
      setSaveMsg(e.message || 'Не вдалося зберегти RSS-конфіг');
    } finally {
      setRssConfigSaving(false);
      setTimeout(() => setSaveStatus('idle'), 5000);
    }
  }

  async function refreshWorkflowStatus() {
    if (!token) return;
    setWorkflowLoading(true);
    setWorkflowError('');
    try {
      const data = await fetchWorkflowDashboard(token);
      setSyncRun(data.sync);
      setXRssRun(data.xRssSync);
      setFbRssRun(data.fbRssSync);
      setDeployRun(data.deploy);
    } catch (e: any) {
      setWorkflowError(e.message || 'Не вдалося отримати статус workflow');
    } finally {
      setWorkflowLoading(false);
    }
  }

  function statusLabel(run: WorkflowRunStatus | null): string {
    if (!run) return 'Немає запусків';
    if (run.status === 'queued') return 'В черзі';
    if (run.status === 'in_progress') return 'Виконується';
    if (run.conclusion === 'success') return 'Успішно';
    if (run.conclusion === 'failure') return 'Помилка';
    if (run.conclusion === 'cancelled') return 'Скасовано';
    return run.status || 'Невідомо';
  }

  function statusClass(run: WorkflowRunStatus | null): string {
    if (!run) return 'text-[#f4f4f4]/40 border-[#f4f4f4]/20';
    if (run.status === 'queued' || run.status === 'in_progress') return 'text-amber-300 border-amber-400/40';
    if (run.conclusion === 'success') return 'text-green-400 border-green-500/40';
    return 'text-red-400 border-red-500/40';
  }

  function timeLabel(iso?: string): string {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleString('uk-UA', { dateStyle: 'short', timeStyle: 'short' });
    } catch {
      return iso;
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

  function addInvTag() {
    const t = invTagInput.trim().toUpperCase().replace(/\s+/g, '_');
    if (t && editingInvestigation && !editingInvestigation.tags.includes(t)) {
      setEditingInvestigation({ ...editingInvestigation, tags: [...editingInvestigation.tags, t] });
    }
    setInvTagInput('');
  }

  function removeInvTag(tag: string) {
    if (editingInvestigation) {
      setEditingInvestigation({ ...editingInvestigation, tags: editingInvestigation.tags.filter((t) => t !== tag) });
    }
  }

  const isAnySyncRunning =
    syncRun?.status === 'queued' ||
    syncRun?.status === 'in_progress' ||
    xRssRun?.status === 'queued' ||
    xRssRun?.status === 'in_progress' ||
    fbRssRun?.status === 'queued' ||
    fbRssRun?.status === 'in_progress' ||
    deployRun?.status === 'queued' ||
    deployRun?.status === 'in_progress';

  const filteredPosts = posts.filter((p) => {
    const q = postSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      p.title.toLowerCase().includes(q) ||
      p.id.toLowerCase().includes(q) ||
      (p.text || '').toLowerCase().includes(q)
    );
  });

  // ── Login screen ──────────────────────────────────────────────────────────
  if (!isAuthed) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,#1a1a1a_0%,#0a0a0a_45%,#070707_100%)] flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md">
          <div className="border border-[#f4f4f4]/10 bg-[#111111]/95 backdrop-blur-sm p-6 sm:p-10 shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_30px_70px_rgba(0,0,0,0.45)]">
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
                className="w-full bg-white text-[#111111] font-mono font-extrabold text-xs uppercase tracking-widest py-3 hover:bg-[#f4f4f4] disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {authLoading ? <Loader className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                {authLoading ? 'ПЕРЕВІРКА...' : 'УВІЙТИ'}
              </button>
            </div>

            <p className="mt-8 text-[#f4f4f4]/25 font-mono text-[10px] leading-relaxed font-medium">
              Токен зберігається тільки локально у браузері.<br />
              Потрібні права: <span className="text-[#f4f4f4]/50">repo</span> (для запису в репозиторій).
            </p>
            <div className="mt-5 p-3 border border-[#f4f4f4]/10 bg-[#f4f4f4]/[0.03]">
              <p className="font-mono text-[10px] uppercase tracking-widest text-[#f4f4f4]/55 mb-1">Підказка</p>
              <p className="text-[#f4f4f4]/45 text-xs font-medium leading-relaxed">
                Після входу ти зможеш запускати SYNC, редагувати стрічку та дивитись живий статус деплою прямо тут.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Investigation editor overlay ─────────────────────────────────────────
  if (editingInvestigation) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,#151515_0%,#0a0a0a_50%,#060606_100%)] text-[#f4f4f4] p-3 md:p-8">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-8 pb-6 border-b border-[#f4f4f4]/10">
            <div className="flex items-center gap-3">
              <Sparkles className="w-4 h-4 text-[#f4f4f4]/40" />
              <span className="font-mono text-xs uppercase tracking-widest text-[#f4f4f4]/60">
                {isNewInvestigation ? 'НОВЕ РОЗСЛІДУВАННЯ' : `РЕДАГУВАННЯ // ${editingInvestigation.id}`}
              </span>
            </div>
            <button onClick={() => { setEditingInvestigation(null); setIsNewInvestigation(false); }} className="text-[#f4f4f4]/30 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-6 border border-[#f4f4f4]/10 bg-[#101010]/90 p-4 md:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-mono text-[10px] uppercase tracking-widest text-[#f4f4f4]/35 mb-2">ID</label>
                <input value={editingInvestigation.id} onChange={e => setEditingInvestigation({ ...editingInvestigation, id: e.target.value })} className="w-full bg-[#1a1a1a] border border-[#f4f4f4]/10 text-white text-sm font-semibold px-4 py-3 outline-none focus:border-[#f4f4f4]/40" />
              </div>
              <div>
                <label className="block font-mono text-[10px] uppercase tracking-widest text-[#f4f4f4]/35 mb-2">STATUS</label>
                <select value={editingInvestigation.status || 'published'} onChange={e => setEditingInvestigation({ ...editingInvestigation, status: e.target.value as 'draft' | 'published' })} className="w-full bg-[#1a1a1a] border border-[#f4f4f4]/10 text-white text-sm font-semibold px-4 py-3 outline-none focus:border-[#f4f4f4]/40">
                  <option value="published">published</option>
                  <option value="draft">draft</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block font-mono text-[10px] uppercase tracking-widest text-[#f4f4f4]/35 mb-2">ЗАГОЛОВОК</label>
              <input value={editingInvestigation.title} onChange={e => setEditingInvestigation({ ...editingInvestigation, title: e.target.value })} className="w-full bg-[#1a1a1a] border border-[#f4f4f4]/10 text-white text-lg font-bold px-4 py-3 outline-none focus:border-[#f4f4f4]/40" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-mono text-[10px] uppercase tracking-widest text-[#f4f4f4]/35 mb-2">CODE</label>
                <input value={editingInvestigation.code} onChange={e => setEditingInvestigation({ ...editingInvestigation, code: e.target.value })} className="w-full bg-[#1a1a1a] border border-[#f4f4f4]/10 text-white text-sm font-semibold px-4 py-3 outline-none focus:border-[#f4f4f4]/40" />
              </div>
              <div>
                <label className="block font-mono text-[10px] uppercase tracking-widest text-[#f4f4f4]/35 mb-2">LINK URL</label>
                <input value={editingInvestigation.url || ''} onChange={e => setEditingInvestigation({ ...editingInvestigation, url: e.target.value })} placeholder="https://..." className="w-full bg-[#1a1a1a] border border-[#f4f4f4]/10 text-white text-sm font-semibold px-4 py-3 outline-none focus:border-[#f4f4f4]/40" />
              </div>
            </div>
            <div>
              <label className="block font-mono text-[10px] uppercase tracking-widest text-[#f4f4f4]/35 mb-2">ОПИС</label>
              <textarea rows={5} value={editingInvestigation.summary} onChange={e => setEditingInvestigation({ ...editingInvestigation, summary: e.target.value })} className="w-full bg-[#1a1a1a] border border-[#f4f4f4]/10 text-white text-base font-medium px-4 py-3 outline-none focus:border-[#f4f4f4]/40 resize-none leading-relaxed" />
            </div>
            <div>
              <label className="block font-mono text-[10px] uppercase tracking-widest text-[#f4f4f4]/35 mb-2">MARKDOWN КОНТЕНТ</label>
              <textarea
                rows={10}
                value={editingInvestigation.contentMarkdown || ''}
                onChange={e => setEditingInvestigation({ ...editingInvestigation, contentMarkdown: e.target.value })}
                placeholder="# Заголовок\n- Пункт\n[посилання](https://...)"
                className="w-full bg-[#1a1a1a] border border-[#f4f4f4]/10 text-white text-sm font-medium px-4 py-3 outline-none focus:border-[#f4f4f4]/40 resize-y leading-relaxed"
              />
              <div className="mt-3 border border-[#f4f4f4]/10 bg-[#0f0f0f] p-4">
                <p className="font-mono text-[10px] uppercase tracking-widest text-[#f4f4f4]/40 mb-2">Превʼю</p>
                <div className="whitespace-pre-wrap text-sm text-[#f4f4f4]/75 leading-relaxed font-medium">
                  {editingInvestigation.contentMarkdown || 'Поки порожньо'}
                </div>
              </div>
            </div>

            <div>
              <label className="block font-mono text-[10px] uppercase tracking-widest text-[#f4f4f4]/35 mb-2">ТЕГИ</label>
              <div className="flex flex-wrap gap-2 mb-3">
                {editingInvestigation.tags.map(tag => (
                  <span key={tag} className="flex items-center gap-1.5 px-3 py-1 border border-[#f4f4f4]/20 font-mono text-[10px] tracking-widest text-[#f4f4f4]/75">
                    #{tag}
                    <button onClick={() => removeInvTag(tag)} className="text-[#f4f4f4]/30 hover:text-red-400 transition-colors">
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input value={invTagInput} onChange={e => setInvTagInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addInvTag(); } }} className="flex-1 bg-[#1a1a1a] border border-[#f4f4f4]/10 text-white font-mono text-xs px-4 py-2.5 outline-none focus:border-[#f4f4f4]/40" placeholder="NEW_TAG" />
                <button onClick={addInvTag} className="px-4 py-2.5 border border-[#f4f4f4]/20 font-mono text-xs text-[#f4f4f4]/60 hover:text-white hover:border-[#f4f4f4]/60 transition-colors">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between pt-6 border-t border-[#f4f4f4]/10">
            <button onClick={() => { setEditingInvestigation(null); setIsNewInvestigation(false); }} className="font-mono text-xs uppercase tracking-widest text-[#f4f4f4]/45 hover:text-white">Скасувати</button>
            <button
              onClick={async () => {
                if (!editingInvestigation) return;
                setSaving(true);
                const next = isNewInvestigation
                  ? [editingInvestigation, ...investigations]
                  : investigations.map((i) => i.id === editingInvestigation.id ? editingInvestigation : i);
                try {
                  await saveInvestigations(token, next);
                  setInvestigations(next);
                  setEditingInvestigation(null);
                  setIsNewInvestigation(false);
                  setSaveStatus('ok');
                  setSaveMsg('Інтерактивне розслідування збережено');
                } catch (e: any) {
                  setSaveStatus('error');
                  setSaveMsg(e.message || 'Помилка збереження розслідування');
                } finally {
                  setSaving(false);
                }
              }}
              disabled={saving || !editingInvestigation.title}
              className="flex items-center justify-center gap-2 bg-white text-[#111111] font-mono font-extrabold text-xs uppercase tracking-widest px-8 py-3 hover:bg-[#f4f4f4] disabled:opacity-30"
            >
              {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Зберегти розслідування
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Editor overlay ────────────────────────────────────────────────────────
  if (editing) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,#151515_0%,#0a0a0a_50%,#060606_100%)] text-[#f4f4f4] p-3 md:p-8">
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
          <div className="space-y-6 border border-[#f4f4f4]/10 bg-[#101010]/90 p-4 md:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                className="w-full bg-[#1a1a1a] border border-[#f4f4f4]/10 text-white text-lg md:text-xl font-semibold px-4 py-3 outline-none focus:border-[#f4f4f4]/40 transition-colors placeholder:text-[#f4f4f4]/20"
              />
            </div>

            <div>
              <label className="block font-mono text-[9px] uppercase tracking-widest text-[#f4f4f4]/30 mb-2">TELEGRAM URL</label>
              <input
                value={editing.telegramUrl || ''}
                onChange={e => setEditing({ ...editing, telegramUrl: e.target.value })}
                placeholder="https://t.me/oko_gora/12345"
                className="w-full bg-[#1a1a1a] border border-[#f4f4f4]/10 text-white text-sm px-4 py-3 outline-none focus:border-[#f4f4f4]/40 transition-colors placeholder:text-[#f4f4f4]/20"
              />
            </div>

            <div>
              <label className="block font-mono text-[9px] uppercase tracking-widest text-[#f4f4f4]/30 mb-2">ТЕКСТ</label>
              <textarea
                rows={8}
                value={editing.text}
                onChange={e => setEditing({ ...editing, text: e.target.value })}
                placeholder="Текст статті..."
                className="w-full bg-[#1a1a1a] border border-[#f4f4f4]/10 text-white text-sm md:text-base font-medium px-4 py-3 outline-none focus:border-[#f4f4f4]/40 transition-colors resize-none leading-relaxed placeholder:text-[#f4f4f4]/20"
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
          <div className="mt-10 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between pt-6 border-t border-[#f4f4f4]/10">
            <button
              onClick={() => { setEditing(null); setIsNew(false); }}
              className="font-mono text-xs uppercase tracking-widest text-[#f4f4f4]/45 hover:text-white transition-colors text-left"
            >
              СКАСУВАТИ
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !editing.title}
              className="flex items-center justify-center gap-2 bg-white text-[#111111] font-mono font-extrabold text-xs uppercase tracking-widest px-8 py-3 hover:bg-[#f4f4f4] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#151515_0%,#0a0a0a_45%,#060606_100%)] text-[#f4f4f4]">
      {/* Top bar */}
      <div className="sticky top-0 z-30 border-b border-[#f4f4f4]/10 px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0c0c0c]/90 backdrop-blur-md">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="font-mono text-xs uppercase tracking-widest text-[#f4f4f4]/90 font-bold">ОКО ГОРА // АДМІН</span>
          <span className="font-mono text-[10px] text-[#f4f4f4]/35 ml-2 truncate">@{username}</span>
        </div>
        <div className="flex items-center gap-4 self-end sm:self-auto">
          <a href="/" className="font-mono text-[9px] uppercase tracking-widest text-[#f4f4f4]/30 hover:text-white transition-colors flex items-center gap-1.5">
            <Eye className="w-3 h-3" /> САЙТ
          </a>
          <button onClick={handleLogout} className="font-mono text-[9px] uppercase tracking-widest text-[#f4f4f4]/30 hover:text-red-400 transition-colors flex items-center gap-1.5">
            <LogOut className="w-3 h-3" /> ВИЙТИ
          </button>
        </div>
      </div>

      {/* Mobile Sticky Actions */}
      <div className="xl:hidden sticky top-[78px] z-20 border-b border-[#f4f4f4]/10 bg-[#0b0b0b]/95 backdrop-blur-md px-4 py-2">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => { setEditing(emptyPost()); setIsNew(true); }}
            className="flex items-center justify-center gap-1.5 bg-white text-[#111111] font-mono font-extrabold text-[10px] uppercase tracking-widest px-3 py-2.5 hover:bg-[#f4f4f4] transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Нова стаття
          </button>
          <button
            onClick={refreshWorkflowStatus}
            disabled={workflowLoading}
            className="flex items-center justify-center gap-1.5 border border-[#f4f4f4]/20 text-[#f4f4f4]/80 font-mono font-bold text-[10px] uppercase tracking-widest px-3 py-2.5 hover:text-white hover:border-[#f4f4f4]/60 transition-colors disabled:opacity-40"
          >
            {workflowLoading ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Status
          </button>
        </div>
      </div>

      {/* Status toast */}
      {saveStatus !== 'idle' && (
        <div className={`mx-4 sm:mx-6 mt-4 flex items-center gap-2 px-4 py-3 font-mono text-xs md:text-sm font-semibold border ${saveStatus === 'ok' ? 'bg-green-500/10 border-green-500/20 text-green-300' : 'bg-red-500/10 border-red-500/20 text-red-300'}`}>
          {saveStatus === 'ok' ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {saveMsg}
          {saveStatus === 'ok' && <span className="text-[#f4f4f4]/30 ml-2">— GitHub Actions деплой запущено автоматично</span>}
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        {/* Header */}
        <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-6 mb-8">
          <div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black uppercase tracking-tighter mb-1">Статті</h1>
            <p className="font-mono text-[11px] text-[#f4f4f4]/45 uppercase tracking-widest font-semibold">{posts.length} публікацій</p>
          </div>
          <div className="w-full xl:w-auto flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Telegraph import */}
            {showTgInput ? (
              <div className="w-full xl:w-auto flex items-center gap-2">
                <div className="flex flex-col gap-1 w-full">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      autoFocus
                      value={tgUrl}
                      onChange={e => { setTgUrl(e.target.value); setTgError(''); }}
                      onKeyDown={e => e.key === 'Enter' && handleTelegraphImport()}
                      placeholder="https://telegra.ph/..."
                      className="w-full sm:w-80 bg-[#1a1a1a] border border-[#f4f4f4]/20 text-white font-mono text-xs px-3 py-2.5 outline-none focus:border-[#f4f4f4]/50 placeholder:text-[#f4f4f4]/20 transition-colors"
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
                      className="px-3 py-2.5 border border-[#f4f4f4]/10 text-[#f4f4f4]/40 hover:text-white transition-colors"
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
                className="flex items-center gap-2 border border-[#f4f4f4]/15 text-[#f4f4f4]/65 font-mono font-bold text-xs uppercase tracking-widest px-4 py-2.5 sm:px-5 sm:py-3 hover:text-white hover:border-[#f4f4f4]/50 transition-colors"
              >
                <Download className="w-4 h-4" /> TELEGRAPH
              </button>
            )}

            <button
              onClick={handleTelegramSync}
              disabled={syncLoading}
              className="flex items-center gap-2 border border-[#f4f4f4]/15 text-[#f4f4f4]/65 font-mono font-bold text-xs uppercase tracking-widest px-4 py-2.5 sm:px-5 sm:py-3 hover:text-white hover:border-[#f4f4f4]/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title="Запустити GitHub Action sync-telegram-posts.yml"
            >
              {syncLoading ? <Loader className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {syncLoading ? 'SYNC...' : 'SYNC TG'}
            </button>

            <button
              onClick={handleXRssSync}
              disabled={xRssLoading}
              className="flex items-center gap-2 border border-[#f4f4f4]/15 text-[#f4f4f4]/65 font-mono font-bold text-xs uppercase tracking-widest px-4 py-2.5 sm:px-5 sm:py-3 hover:text-white hover:border-[#f4f4f4]/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title="Запустити GitHub Action sync-x-rss.yml"
            >
              {xRssLoading ? <Loader className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {xRssLoading ? 'SYNC...' : 'SYNC X RSS'}
            </button>
            <button
              onClick={handleFacebookRssSync}
              disabled={fbRssLoading}
              className="flex items-center gap-2 border border-[#f4f4f4]/15 text-[#f4f4f4]/65 font-mono font-bold text-xs uppercase tracking-widest px-4 py-2.5 sm:px-5 sm:py-3 hover:text-white hover:border-[#f4f4f4]/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title="Запустити GitHub Action sync-facebook-rss.yml"
            >
              {fbRssLoading ? <Loader className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {fbRssLoading ? 'SYNC...' : 'SYNC FB RSS'}
            </button>

            <button
              onClick={refreshWorkflowStatus}
              disabled={workflowLoading}
              className="flex items-center gap-2 border border-[#f4f4f4]/15 text-[#f4f4f4]/65 font-mono font-bold text-xs uppercase tracking-widest px-4 py-2.5 sm:py-3 hover:text-white hover:border-[#f4f4f4]/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title="Оновити статус pipeline"
            >
              {workflowLoading ? <Loader className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              STATUS
            </button>

            <button
              onClick={() => { setEditing(emptyPost()); setIsNew(true); }}
              className="flex items-center gap-2 bg-white text-[#111111] font-mono font-extrabold text-xs uppercase tracking-widest px-5 py-2.5 sm:px-6 sm:py-3 hover:bg-[#f4f4f4] transition-colors"
            >
              <Plus className="w-4 h-4" /> НОВА СТАТТЯ
            </button>
            <button
              onClick={() => {
                setEditingInvestigation({
                  id: `INV-${Date.now()}`,
                  title: '',
                  summary: '',
                  code: `CASE-${new Date().getHours()}${new Date().getMinutes()}`,
                  url: '',
                  tags: [],
                  publishedAt: new Date().toISOString(),
                  status: 'draft',
                  contentMarkdown: '',
                });
                setIsNewInvestigation(true);
              }}
              className="flex items-center gap-2 bg-[#c9a227] text-[#111111] font-mono font-extrabold text-xs uppercase tracking-widest px-5 py-2.5 sm:px-6 sm:py-3 hover:brightness-105 transition-colors"
            >
              <Sparkles className="w-4 h-4" /> НОВЕ РОЗСЛІДУВАННЯ
            </button>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="lg:col-span-2 border border-[#f4f4f4]/10 bg-[#101010] p-4">
            <p className="font-mono text-[10px] uppercase tracking-widest text-[#f4f4f4]/65 mb-2 flex items-center gap-2"><Sparkles className="w-3 h-3" /> Швидкий сценарій роботи</p>
            <p className="text-sm font-semibold text-[#f4f4f4]/88 leading-relaxed">
              1) Оновити контент через <span className="text-white">SYNC TG / X / FB</span>, 2) дочекатися <span className="text-white">Deploy = Успішно</span>, 3) перевірити сайт.
            </p>
          </div>
          <div className="border border-[#f4f4f4]/10 bg-[#101010] p-4">
            <p className="font-mono text-[10px] uppercase tracking-widest text-[#f4f4f4]/65 mb-2 flex items-center gap-2"><CircleHelp className="w-3 h-3" /> Підказка</p>
            <p className="text-xs font-semibold text-[#f4f4f4]/72 leading-relaxed">
              {isAnySyncRunning ? 'Йде синхронізація: не запускай повторно ті самі кнопки до завершення.' : 'Синхронізації неактивні — можна запускати оновлення безпечно.'}
            </p>
          </div>
        </div>

        {/* Posts list */}
        <div className="mb-6 border border-[#f4f4f4]/10 bg-[#101010] p-4 sm:p-5">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2 mb-3">
            <p className="font-mono text-[10px] uppercase tracking-widest text-[#f4f4f4]/70 font-bold">Pipeline Monitor</p>
            <p className="font-mono text-[10px] text-[#f4f4f4]/45">SYNC TG / X RSS / FB RSS → Sync Workflows → Deploy to GitHub Pages</p>
          </div>
          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-3">
            {[{ title: 'Sync Telegram', run: syncRun }, { title: 'Sync X RSS', run: xRssRun }, { title: 'Sync FB RSS', run: fbRssRun }, { title: 'Deploy', run: deployRun }].map(item => (
              <div key={item.title} className="border border-[#f4f4f4]/10 p-3 bg-[#f4f4f4]/[0.02] relative overflow-hidden">
                <div className={`absolute left-0 top-0 h-full w-1 ${
                  !item.run ? 'bg-white/20' :
                  item.run.status === 'queued' || item.run.status === 'in_progress' ? 'bg-amber-400' :
                  item.run.conclusion === 'success' ? 'bg-green-400' : 'bg-red-400'
                }`} />
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-[#f4f4f4]/70 font-bold">{item.title}</span>
                  <span className={`px-2 py-1 border font-mono text-[9px] uppercase tracking-widest font-bold ${statusClass(item.run)}`}>
                    {statusLabel(item.run)}
                  </span>
                </div>
                <div className="mt-2 font-mono text-[10px] text-[#f4f4f4]/45">
                  {item.run ? `Run #${item.run.id} • ${timeLabel(item.run.createdAt)}` : 'Ще немає запусків'}
                </div>
                {item.run?.htmlUrl && (
                  <a
                    href={item.run.htmlUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex mt-2 font-mono text-[10px] uppercase tracking-widest text-[#f4f4f4]/62 hover:text-white transition-colors font-bold"
                  >
                    Відкрити в GitHub
                  </a>
                )}
              </div>
            ))}
          </div>
          {workflowError && (
            <div className="mt-3 font-mono text-[10px] text-red-400 flex items-center gap-2">
              <AlertTriangle className="w-3 h-3" /> {workflowError}
            </div>
          )}
          {!workflowError && (syncRun?.status === 'queued' || syncRun?.status === 'in_progress' || xRssRun?.status === 'queued' || xRssRun?.status === 'in_progress' || fbRssRun?.status === 'queued' || fbRssRun?.status === 'in_progress' || deployRun?.status === 'queued' || deployRun?.status === 'in_progress') && (
            <div className="mt-3 font-mono text-[10px] text-amber-300">Оновлюється автоматично кожні 7 секунд, поки workflow у процесі.</div>
          )}
          {!workflowError && deployRun?.conclusion === 'success' && (
            <div className="mt-3 font-mono text-[10px] text-green-400">Синхронізація і деплой завершені. Онови сайт з hard refresh.</div>
          )}
        </div>

        <div className="mb-10 border border-[#f4f4f4]/10 bg-[#101010] p-4 sm:p-5">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2 mb-4">
            <p className="font-mono text-[10px] uppercase tracking-widest text-[#f4f4f4]/70 font-bold">RSS X Configuration</p>
            <p className="font-mono text-[10px] text-[#f4f4f4]/45">Керування авторами, ключами та фільтрами без редагування коду</p>
          </div>
          <div className="mb-4 p-3 border border-[#f4f4f4]/10 bg-[#f4f4f4]/[0.02]">
            <p className="font-mono text-[10px] uppercase tracking-widest text-[#f4f4f4]/55 mb-1">Порада</p>
            <p className="text-xs font-semibold text-[#f4f4f4]/72 leading-relaxed">
              Спочатку збережи конфіг, потім натисни <span className="text-white">RUN X RSS SYNC</span>, щоб нові правила одразу потрапили в стрічку.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-widest text-[#f4f4f4]/35 mb-2">Window Days</label>
              <input
                type="number"
                min={1}
                max={14}
                value={rssConfig.windowDays}
                onChange={(e) => setRssConfig({ ...rssConfig, windowDays: Number(e.target.value) })}
                className="w-full bg-[#1a1a1a] border border-[#f4f4f4]/15 text-white font-mono text-sm px-3 py-2.5 outline-none focus:border-[#f4f4f4]/40"
              />
            </div>
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-widest text-[#f4f4f4]/35 mb-2">Max Items</label>
              <input
                type="number"
                min={10}
                max={200}
                value={rssConfig.maxItems}
                onChange={(e) => setRssConfig({ ...rssConfig, maxItems: Number(e.target.value) })}
                className="w-full bg-[#1a1a1a] border border-[#f4f4f4]/15 text-white font-mono text-sm px-3 py-2.5 outline-none focus:border-[#f4f4f4]/40"
              />
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-4">
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-widest text-[#f4f4f4]/35 mb-2">Authors (`handle | Name`)</label>
              <textarea
                rows={10}
                value={authorsInput}
                onChange={(e) => setAuthorsInput(e.target.value)}
                className="w-full bg-[#1a1a1a] border border-[#f4f4f4]/15 text-white font-mono text-xs font-semibold px-3 py-2.5 outline-none focus:border-[#f4f4f4]/40 resize-none"
              />
            </div>
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-widest text-[#f4f4f4]/35 mb-2">Keywords (one per line)</label>
              <textarea
                rows={10}
                value={keywordsInput}
                onChange={(e) => setKeywordsInput(e.target.value)}
                className="w-full bg-[#1a1a1a] border border-[#f4f4f4]/15 text-white font-mono text-xs font-semibold px-3 py-2.5 outline-none focus:border-[#f4f4f4]/40 resize-none"
              />
            </div>
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-widest text-[#f4f4f4]/35 mb-2">Exclude Keywords</label>
              <textarea
                rows={10}
                value={excludeInput}
                onChange={(e) => setExcludeInput(e.target.value)}
                className="w-full bg-[#1a1a1a] border border-[#f4f4f4]/15 text-white font-mono text-xs font-semibold px-3 py-2.5 outline-none focus:border-[#f4f4f4]/40 resize-none"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              onClick={handleSaveRssConfig}
              disabled={rssConfigSaving}
              className="flex items-center gap-2 border border-[#f4f4f4]/20 text-[#f4f4f4]/70 font-mono text-xs uppercase tracking-widest px-4 py-2.5 hover:text-white hover:border-[#f4f4f4]/60 disabled:opacity-30 transition-colors"
            >
              {rssConfigSaving ? <Loader className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              {rssConfigSaving ? 'SAVING...' : 'SAVE RSS CONFIG'}
            </button>
            <button
              onClick={fetchRssConfigFromSite}
              disabled={rssConfigLoading}
              className="flex items-center gap-2 border border-[#f4f4f4]/15 text-[#f4f4f4]/50 font-mono text-xs uppercase tracking-widest px-4 py-2.5 hover:text-white hover:border-[#f4f4f4]/50 disabled:opacity-30 transition-colors"
            >
              {rssConfigLoading ? <Loader className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              RELOAD CONFIG
            </button>
            <button
              onClick={handleXRssSync}
              disabled={xRssLoading}
              className="flex items-center gap-2 bg-white text-[#111111] font-mono font-bold text-xs uppercase tracking-widest px-4 py-2.5 hover:bg-[#f4f4f4] disabled:opacity-30 transition-colors"
            >
              {xRssLoading ? <Loader className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              RUN X RSS SYNC
            </button>
          </div>
        </div>

        <div className="mb-10 border border-[#f4f4f4]/10 bg-[#101010] p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <p className="font-mono text-[12px] uppercase tracking-widest text-[#f4f4f4]/80 font-bold">Інтерактивні розслідування</p>
              <p className="text-sm font-semibold text-[#f4f4f4]/60">Керуй картками розслідувань, які показуються на головній сторінці.</p>
            </div>
            <button
              onClick={() => {
                setEditingInvestigation({
                  id: `INV-${Date.now()}`,
                  title: '',
                  summary: '',
                  code: `CASE-${new Date().getHours()}${new Date().getMinutes()}`,
                  url: '',
                  tags: [],
                  publishedAt: new Date().toISOString(),
                  status: 'draft',
                  contentMarkdown: '',
                });
                setIsNewInvestigation(true);
              }}
              className="flex items-center gap-2 border border-[#f4f4f4]/25 text-[#f4f4f4] font-mono font-extrabold text-xs uppercase tracking-widest px-4 py-2.5 hover:border-[#f4f4f4]/60"
            >
              <Plus className="w-4 h-4" /> Додати кейс
            </button>
          </div>
          {loadingInvestigations ? (
            <div className="font-mono text-xs text-[#f4f4f4]/40">Завантаження...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {investigations.map((item, idx) => (
                <div key={item.id} className="border border-[#f4f4f4]/10 bg-[#0f0f0f] p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-mono text-[10px] text-[#f4f4f4]/50 font-bold">{item.code}</p>
                    <span className={`font-mono text-[10px] uppercase ${item.status === 'published' ? 'text-green-400' : 'text-amber-300'}`}>{item.status || 'published'}</span>
                  </div>
                  <h4 className="mt-2 text-lg font-extrabold text-white">{item.title}</h4>
                  <p className="mt-2 text-sm font-medium text-[#f4f4f4]/65 line-clamp-3">{item.summary}</p>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {item.tags.slice(0, 4).map((t) => <span key={t} className="px-2 py-0.5 border border-[#f4f4f4]/10 font-mono text-[9px] text-[#f4f4f4]/50">#{t}</span>)}
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                    <button
                      onClick={() => {
                        if (idx === 0) return;
                        const next = [...investigations];
                        [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                        setInvestigations(next);
                      }}
                      className="px-2 py-1.5 border border-[#f4f4f4]/20 font-mono text-[10px] font-bold uppercase text-[#f4f4f4]/75 hover:text-white disabled:opacity-30"
                      disabled={idx === 0}
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => {
                        if (idx === investigations.length - 1) return;
                        const next = [...investigations];
                        [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
                        setInvestigations(next);
                      }}
                      className="px-2 py-1.5 border border-[#f4f4f4]/20 font-mono text-[10px] font-bold uppercase text-[#f4f4f4]/75 hover:text-white disabled:opacity-30"
                      disabled={idx === investigations.length - 1}
                    >
                      ↓
                    </button>
                    <button onClick={() => { setEditingInvestigation(item); setIsNewInvestigation(false); }} className="px-3 py-1.5 border border-[#f4f4f4]/20 font-mono text-[10px] font-bold uppercase text-[#f4f4f4]/75 hover:text-white">Редагувати</button>
                    <button
                      onClick={async () => {
                        if (!confirm('Видалити розслідування?')) return;
                        const next = investigations.filter((x) => x.id !== item.id);
                        setSaving(true);
                        try {
                          await saveInvestigations(token, next);
                          setInvestigations(next);
                          setSaveStatus('ok');
                          setSaveMsg('Розслідування видалено');
                        } catch (e: any) {
                          setSaveStatus('error');
                          setSaveMsg(e.message || 'Помилка видалення розслідування');
                        } finally {
                          setSaving(false);
                        }
                      }}
                      className="px-3 py-1.5 border border-red-500/30 font-mono text-[10px] font-bold uppercase text-red-400 hover:text-red-300"
                    >
                      Видалити
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-4">
            <button
              onClick={async () => {
                setSaving(true);
                try {
                  await saveInvestigations(token, investigations);
                  setSaveStatus('ok');
                  setSaveMsg('Порядок розслідувань збережено');
                } catch (e: any) {
                  setSaveStatus('error');
                  setSaveMsg(e.message || 'Не вдалося зберегти порядок розслідувань');
                } finally {
                  setSaving(false);
                }
              }}
              disabled={saving}
              className="px-4 py-2.5 border border-[#f4f4f4]/25 font-mono text-xs uppercase tracking-widest font-bold text-[#f4f4f4]/80 hover:text-white"
            >
              Зберегти порядок кейсів
            </button>
          </div>
        </div>

        {loadingPosts ? (
          <div className="flex items-center justify-center py-24 text-[#f4f4f4]/20">
            <Loader className="w-6 h-6 animate-spin mr-3" />
            <span className="font-mono text-xs uppercase tracking-widest">Завантаження...</span>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="mb-2">
              <input
                value={postSearch}
                onChange={(e) => setPostSearch(e.target.value)}
                placeholder="Пошук по ID, заголовку або тексту..."
                className="w-full bg-[#1a1a1a] border border-[#f4f4f4]/15 text-white text-base font-semibold px-4 py-3 outline-none focus:border-[#f4f4f4]/40"
              />
            </div>
            {filteredPosts.map((post) => (
              <div
                key={post.id}
                className="flex flex-col md:flex-row md:items-center gap-4 bg-[#111111] border border-[#f4f4f4]/8 px-4 sm:px-5 py-4 hover:border-[#f4f4f4]/25 transition-colors group"
              >
                {/* Order controls */}
                <div className="flex md:flex-col gap-1 shrink-0">
                  <button onClick={() => movePost(posts.findIndex((p) => p.id === post.id), -1)} disabled={posts.findIndex((p) => p.id === post.id) === 0 || !!postSearch.trim()} className="text-[#f4f4f4]/20 hover:text-white disabled:opacity-10 transition-colors">
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => movePost(posts.findIndex((p) => p.id === post.id), 1)} disabled={posts.findIndex((p) => p.id === post.id) === posts.length - 1 || !!postSearch.trim()} className="text-[#f4f4f4]/20 hover:text-white disabled:opacity-10 transition-colors">
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Post info */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-1.5">
                    <span className="font-mono text-[10px] text-[#f4f4f4]/45 shrink-0 font-bold">{post.id}</span>
                    <span className="font-mono text-[10px] text-[#f4f4f4]/35 shrink-0">{post.date}</span>
                    <div className="flex gap-1 flex-wrap">
                      {post.tags.map(t => (
                        <span key={t} className="font-mono text-[9px] px-1.5 py-0.5 border border-[#f4f4f4]/10 text-[#f4f4f4]/45 tracking-wide font-semibold">#{t}</span>
                      ))}
                    </div>
                  </div>
                  <p className="text-base font-bold text-[#f4f4f4]/94 truncate">{post.title}</p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => { setEditing(post); setIsNew(false); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-[#f4f4f4]/20 font-mono text-[10px] uppercase tracking-widest text-[#f4f4f4]/72 hover:text-white hover:border-[#f4f4f4]/60 transition-colors font-bold"
                  >
                    <Edit2 className="w-3 h-3" /> РЕДАГУВАТИ
                  </button>
                  <button
                    onClick={() => {
                      const copy: Post = {
                        ...post,
                        id: `TG-${Date.now()}`,
                        title: `${post.title} (копія)`,
                      };
                      setEditing(copy);
                      setIsNew(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-[#f4f4f4]/20 font-mono text-[10px] uppercase tracking-widest text-[#f4f4f4]/72 hover:text-white hover:border-[#f4f4f4]/60 transition-colors font-bold"
                  >
                    <Plus className="w-3 h-3" /> ДУБЛЮВАТИ
                  </button>
                  <button
                    onClick={() => handleDelete(post.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-red-500/20 font-mono text-[10px] uppercase tracking-widest text-red-500/70 hover:text-red-400 hover:border-red-500/60 transition-colors font-bold"
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
          <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="font-mono text-[10px] uppercase tracking-widest text-[#f4f4f4]/35">
              Після зміни порядку натисни «Зберегти порядок», щоб оновлення потрапили на сайт.
            </p>
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
              className="flex items-center gap-2 border border-[#f4f4f4]/20 font-mono text-[10px] uppercase tracking-widest text-[#f4f4f4]/65 hover:text-white hover:border-[#f4f4f4]/60 px-5 py-2.5 transition-colors disabled:opacity-30 font-bold self-start sm:self-auto"
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
