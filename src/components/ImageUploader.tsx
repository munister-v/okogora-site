import { useState, useRef, useCallback } from 'react';
import { UploadCloud, Link, X, CheckCircle, AlertTriangle, Loader, Image as ImageIcon } from 'lucide-react';
import { uploadToGitHub, fetchImageFromUrl, validateFile } from '../lib/imageUpload';

interface Props {
  token: string;
  value: string;
  onChange: (filename: string) => void;
}

type Mode = 'idle' | 'uploading' | 'done' | 'error';

export default function ImageUploader({ token, value, onChange }: Props) {
  const [mode, setMode] = useState<Mode>('idle');
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const previewSrc = value
    ? value.startsWith('http')
      ? value
      : `https://raw.githubusercontent.com/munister-v/okogora/main/images/${value}`
    : null;

  const handleFile = useCallback(async (file: File) => {
    setError('');
    setMode('uploading');
    setProgress('Стиснення...');
    try {
      setProgress('Завантаження на GitHub...');
      const result = await uploadToGitHub(file, token);
      onChange(result.filename);
      setMode('done');
      setProgress('');
    } catch (e: any) {
      setError(e.message || 'Помилка');
      setMode('error');
      setProgress('');
    }
  }, [token, onChange]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const err = validateFile(file);
    if (err) { setError(err); setMode('error'); return; }
    handleFile(file);
  }, [handleFile]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateFile(file);
    if (err) { setError(err); setMode('error'); return; }
    handleFile(file);
  };

  const handleUrlSubmit = async () => {
    if (!urlInput.trim()) return;
    setError('');
    setMode('uploading');
    setProgress('Завантаження за URL...');
    try {
      const file = await fetchImageFromUrl(urlInput.trim());
      setProgress('Стиснення та збереження...');
      const result = await uploadToGitHub(file, token);
      onChange(result.filename);
      setMode('done');
      setUrlInput('');
      setShowUrlInput(false);
    } catch (e: any) {
      setError(e.message || 'Помилка');
      setMode('error');
    } finally {
      setProgress('');
    }
  };

  const reset = () => {
    setMode('idle');
    setError('');
    setProgress('');
    onChange('');
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="space-y-3">
      <label className="block font-mono text-[9px] uppercase tracking-widest text-[#f4f4f4]/30">
        ЗОБРАЖЕННЯ
      </label>

      {/* Preview if image set */}
      {value && (
        <div className="relative group">
          {previewSrc && (
            <img
              src={previewSrc}
              alt="preview"
              className="w-full h-48 object-cover border border-[#f4f4f4]/10 grayscale group-hover:grayscale-0 transition-all duration-500"
            />
          )}
          <div className="absolute inset-0 flex items-end p-3 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="flex items-center gap-2 w-full">
              <span className="font-mono text-[9px] text-white/60 truncate flex-1">{value}</span>
              <button
                onClick={reset}
                className="shrink-0 bg-red-500/80 hover:bg-red-500 text-white p-1 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
          {mode === 'done' && (
            <div className="flex items-center gap-2 mt-2 text-green-400 font-mono text-[9px]">
              <CheckCircle className="w-3 h-3" /> Завантажено у репозиторій
            </div>
          )}
        </div>
      )}

      {/* Drop zone — show when no image */}
      {!value && (
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => !mode.includes('upload') && inputRef.current?.click()}
          className={`relative border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center py-10 gap-3
            ${dragging ? 'border-white/50 bg-white/5' : 'border-[#f4f4f4]/15 hover:border-[#f4f4f4]/40'}
            ${mode === 'uploading' ? 'pointer-events-none' : ''}`}
        >
          {mode === 'uploading' ? (
            <>
              <Loader className="w-6 h-6 text-white/40 animate-spin" />
              <span className="font-mono text-[10px] text-white/40 uppercase tracking-widest">{progress}</span>
            </>
          ) : (
            <>
              <UploadCloud className="w-8 h-8 text-[#f4f4f4]/20" />
              <div className="text-center">
                <p className="font-mono text-[10px] text-[#f4f4f4]/50 uppercase tracking-widest">
                  Перетягніть файл або клікніть
                </p>
                <p className="font-mono text-[9px] text-[#f4f4f4]/20 mt-1">
                  JPG · PNG · WebP · GIF · макс. 5 МБ
                </p>
              </div>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={handleFileInput}
          />
        </div>
      )}

      {/* URL input toggle */}
      {!value && mode !== 'uploading' && (
        <div>
          {!showUrlInput ? (
            <button
              type="button"
              onClick={() => setShowUrlInput(true)}
              className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-widest text-[#f4f4f4]/30 hover:text-[#f4f4f4]/70 transition-colors"
            >
              <Link className="w-3 h-3" /> Завантажити за URL
            </button>
          ) : (
            <div className="flex gap-2">
              <input
                autoFocus
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleUrlSubmit()}
                placeholder="https://example.com/photo.jpg"
                className="flex-1 bg-[#1a1a1a] border border-[#f4f4f4]/10 text-white font-mono text-xs px-3 py-2 outline-none focus:border-[#f4f4f4]/40 placeholder:text-[#f4f4f4]/20"
              />
              <button
                onClick={handleUrlSubmit}
                disabled={!urlInput}
                className="px-4 py-2 bg-white text-[#111111] font-mono text-[9px] uppercase tracking-widest hover:bg-[#e0e0e0] disabled:opacity-30 transition-colors"
              >
                OK
              </button>
              <button
                onClick={() => { setShowUrlInput(false); setUrlInput(''); }}
                className="px-3 py-2 border border-[#f4f4f4]/10 text-[#f4f4f4]/40 hover:text-white transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Manual filename fallback */}
      {!value && mode !== 'uploading' && (
        <div className="flex items-center gap-2 mt-1">
          <ImageIcon className="w-3 h-3 text-[#f4f4f4]/20 shrink-0" />
          <input
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder="або вкажіть ім'я вже завантаженого файлу..."
            className="flex-1 bg-transparent border-b border-[#f4f4f4]/10 text-[#f4f4f4]/50 font-mono text-[10px] py-1 outline-none focus:border-[#f4f4f4]/30 placeholder:text-[#f4f4f4]/15 transition-colors"
          />
        </div>
      )}

      {/* Error */}
      {mode === 'error' && error && (
        <div className="flex items-center gap-2 text-red-400 font-mono text-[9px] bg-red-500/10 border border-red-500/20 px-3 py-2">
          <AlertTriangle className="w-3 h-3 shrink-0" />
          {error}
          <button onClick={() => { setMode('idle'); setError(''); }} className="ml-auto">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}
