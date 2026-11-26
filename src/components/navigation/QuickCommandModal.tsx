import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, LogOut, Moon, Plus, Search, Sun, X } from 'lucide-react';
import { NAV_ITEMS } from './navConfig';

interface QuickCommandModalProps {
  open: boolean;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onLogout: () => void;
  onClose: () => void;
}

export function QuickCommandModal({
  open,
  theme,
  onToggleTheme,
  onLogout,
  onClose,
}: QuickCommandModalProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) {
      setQuery('');
      return;
    }
    const timer = setTimeout(() => inputRef.current?.focus(), 20);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  const filteredNav = useMemo(() => {
    const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    if (terms.length === 0) return NAV_ITEMS;
    return NAV_ITEMS.filter((item) =>
      terms.every((t) =>
        `${item.label} ${item.description} ${item.keywords}`.toLowerCase().includes(t),
      ),
    );
  }, [query]);

  if (!open) return null;

  const go = (to: string) => {
    onClose();
    navigate(to);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Cari menu atau aksi cepat"
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/45 px-3 pt-16 sm:pt-24 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-[var(--ol-rim)] bg-[var(--ol-surface)] p-4 text-[var(--ol-ink)] shadow-2xl">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-base font-extrabold tracking-tight">Navigasi Cepat</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup pencarian"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--ol-line)] bg-[var(--ol-inner)] text-[var(--ol-muted)] transition hover:bg-[var(--ol-raised)] hover:text-[var(--ol-ink)]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <label className="mb-3 flex min-h-[44px] items-center gap-2.5 rounded-2xl border border-[var(--ol-line)] bg-[var(--ol-inner)] px-3 focus-within:ring-2 focus-within:ring-[var(--ol-accent)]">
          <Search className="h-4 w-4 shrink-0 text-[var(--ol-muted)]" aria-hidden="true" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari halaman atau aksi..."
            aria-label="Cari halaman atau aksi"
            className="w-full bg-transparent py-2 text-sm font-medium outline-none placeholder:text-[var(--ol-muted)]"
          />
        </label>

        <div className="max-h-[55svh] space-y-1.5 overflow-y-auto pr-0.5">
          {filteredNav.map(({ to, label, description, icon: Icon }) => (
            <button
              key={to}
              type="button"
              onClick={() => go(to)}
              className="flex w-full items-center gap-3 rounded-2xl border border-[var(--ol-line)] bg-[var(--ol-inner)] px-3 py-2.5 text-left transition hover:bg-[var(--ol-raised)]"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--ol-surface)] text-[var(--ol-ink)] shadow-sm">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <strong className="block text-sm font-bold">{label}</strong>
                <small className="block truncate text-xs text-[var(--ol-muted)]">{description}</small>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-[var(--ol-muted)]" aria-hidden="true" />
            </button>
          ))}

          {filteredNav.length === 0 && (
            <p className="py-4 text-center text-xs text-[var(--ol-muted)]">
              Tidak ada menu yang cocok.
            </p>
          )}

          <div className="my-2 border-t border-[var(--ol-line)] pt-2">
            <p className="mb-1.5 px-1 text-[11px] font-bold uppercase tracking-wider text-[var(--ol-muted)]">
              Aksi Cepat
            </p>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => go('/materi/baru')}
                className="flex min-h-[44px] items-center gap-2 rounded-xl border border-[var(--ol-line)] bg-[var(--ol-inner)] px-3 py-2 text-xs font-bold transition hover:bg-[var(--ol-raised)]"
              >
                <Plus className="h-4 w-4 text-[var(--ol-accent)]" aria-hidden="true" />
                <span>Materi Baru</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onToggleTheme();
                  onClose();
                }}
                className="flex min-h-[44px] items-center gap-2 rounded-xl border border-[var(--ol-line)] bg-[var(--ol-inner)] px-3 py-2 text-xs font-bold transition hover:bg-[var(--ol-raised)]"
              >
                {theme === 'light' ? (
                  <Moon className="h-4 w-4 text-[var(--ol-muted)]" aria-hidden="true" />
                ) : (
                  <Sun className="h-4 w-4 text-[var(--ol-muted)]" aria-hidden="true" />
                )}
                <span>{theme === 'light' ? 'Mode Gelap' : 'Mode Terang'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onLogout();
                }}
                className="flex min-h-[44px] items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-600 transition hover:bg-red-500/15 dark:text-red-400 sm:col-span-2"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                <span>Keluar dari Akun</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
