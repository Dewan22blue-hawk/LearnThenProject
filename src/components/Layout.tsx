import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LogOut, Moon, Plus, Search, Sun, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Dock } from './navigation/Dock';
import { isNavActive, NAV_ITEMS } from './navigation/navConfig';
import { QuickCommandModal } from './navigation/QuickCommandModal';

const THEME_KEY = 'outputlab-theme';

function getInitialTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === 'dark' || saved === 'light') return saved;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const [theme, setTheme] = useState<'light' | 'dark'>(getInitialTheme);
  const [commandOpen, setCommandOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!accountOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setAccountOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [accountOpen]);

  const handleLogout = async () => {
    setAccountOpen(false);
    await signOut();
    navigate('/masuk');
  };

  const toggleTheme = () => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  const currentNav = NAV_ITEMS.find((item) => isNavActive(pathname, item.to)) ?? NAV_ITEMS[0];
  const userInitial = (user?.email?.[0] ?? 'U').toUpperCase();

  return (
    <div className="min-h-[100svh] flex flex-col">
      <div className="mx-auto w-full max-w-[1320px] flex-1 px-3 pt-3 pb-[calc(84px+env(safe-area-inset-bottom))] sm:px-5 sm:pt-5 md:pb-8">
        {/* Top Floating Glass Pill Bar */}
        <header className="sticky top-2.5 z-30 mb-3 sm:mb-4">
          <div className="ol-glass-chrome grid grid-cols-[1fr_auto] items-center gap-2 rounded-[22px] px-3 py-2 sm:grid-cols-[1fr_minmax(220px,380px)_1fr] sm:rounded-full sm:px-3.5 sm:py-1.5">
            {/* Brand */}
            <Link
              to="/"
              className="flex min-w-0 items-center gap-2.5 rounded-full pr-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ol-accent)]"
            >
              <span
                aria-hidden="true"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--ol-pick)] text-[var(--ol-pick-ink)] shadow-sm"
              >
                <svg viewBox="0 0 28 28" className="h-5 w-5" fill="none">
                  <circle cx="14" cy="14" r="7.5" stroke="currentColor" strokeWidth="2.8" />
                  <path d="M14 6.5V14L19.2 17" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
                </svg>
              </span>
              <span className="min-w-0">
                <strong className="block truncate text-xs font-extrabold tracking-[0.14em] text-[var(--ol-ink)]">
                  De TRACKER
                </strong>
                <small className="block truncate text-[10px] font-semibold text-[var(--ol-muted)]">
                  {currentNav.label}
                </small>
              </span>
            </Link>

            {/* Center Quick-Search / Command Trigger */}
            <button
              type="button"
              onClick={() => setCommandOpen(true)}
              aria-label="Cari menu atau aksi cepat"
              className="col-span-2 flex min-h-[40px] w-full items-center gap-2.5 rounded-full border border-[var(--ol-line)] bg-[var(--ol-inner)] px-3 text-left transition hover:bg-[var(--ol-raised)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ol-accent)] sm:col-span-1"
            >
              <span
                aria-hidden="true"
                className="h-5 w-5 shrink-0 rounded-full shadow-sm"
                style={{
                  background:
                    'radial-gradient(circle at 30% 25%, #e8fff8 5%, #5ce1c6 35%, #09644f 85%)',
                }}
              />
              <span className="min-w-0 flex-1 truncate text-xs font-bold text-[var(--ol-ink)]">
                {currentNav.prompt}
              </span>
              <kbd className="hidden rounded-md border border-[var(--ol-line)] bg-[var(--ol-surface)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--ol-muted)] md:inline-block">
                ⌘K
              </kbd>
              <Search className="h-3.5 w-3.5 shrink-0 text-[var(--ol-muted)]" aria-hidden="true" />
            </button>

            {/* Right Actions */}
            <div className="flex items-center justify-end gap-1.5">
              <Link
                to="/materi/baru"
                className="hidden h-10 items-center gap-1.5 rounded-full bg-[var(--ol-pick)] px-3.5 text-xs font-bold text-[var(--ol-pick-ink)] transition hover:opacity-90 lg:inline-flex"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Materi</span>
              </Link>

              <button
                type="button"
                onClick={toggleTheme}
                aria-label={theme === 'light' ? 'Aktifkan mode gelap' : 'Aktifkan mode terang'}
                title={theme === 'light' ? 'Mode gelap' : 'Mode terang'}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--ol-line)] bg-[var(--ol-inner)] text-[var(--ol-ink)] transition hover:bg-[var(--ol-raised)]"
              >
                {theme === 'light' ? (
                  <Moon className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Sun className="h-4 w-4" aria-hidden="true" />
                )}
              </button>

              <div className="relative" ref={accountRef}>
                <button
                  type="button"
                  onClick={() => setAccountOpen((prev) => !prev)}
                  aria-label="Menu akun"
                  aria-expanded={accountOpen}
                  className="inline-flex h-10 items-center gap-2 rounded-full border border-[var(--ol-line)] bg-[var(--ol-raised)] px-2.5 text-xs font-bold text-[var(--ol-ink)] transition hover:opacity-90"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--ol-accent)] text-[11px] font-extrabold text-white dark:text-slate-950">
                    {userInitial}
                  </span>
                  <span className="hidden max-w-[110px] truncate xl:inline">{user?.email}</span>
                </button>

                {accountOpen && (
                  <div className="absolute right-0 mt-2 w-60 rounded-2xl border border-[var(--ol-rim)] bg-[var(--ol-surface)] p-2.5 text-[var(--ol-ink)] shadow-xl">
                    <div className="mb-2 flex items-center gap-2.5 rounded-xl bg-[var(--ol-inner)] px-3 py-2">
                      <User className="h-4 w-4 shrink-0 text-[var(--ol-muted)]" aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-semibold text-[var(--ol-muted)]">Akun aktif</p>
                        <p className="truncate text-xs font-bold">{user?.email ?? 'Pengguna'}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex min-h-[40px] w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-red-600 transition hover:bg-red-500/10 dark:text-red-400"
                    >
                      <LogOut className="h-4 w-4" aria-hidden="true" />
                      <span>Keluar</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Tablet Horizontal Dock (768px - 1023px) */}
        <div className="mb-3 hidden justify-center md:flex lg:hidden">
          <Dock variant="top" />
        </div>

        {/* Desktop Stage + Floating Side Rail Dock */}
        <div className="flex items-start gap-4 lg:gap-5">
          <Dock variant="side" />

          <main className="ol-stage-surface min-w-0 flex-1 overflow-x-clip rounded-[24px] p-4 sm:rounded-[30px] sm:p-6 lg:p-8">
            <div className="mx-auto w-full max-w-5xl">{children}</div>
          </main>
        </div>
      </div>

      {/* Mobile Fixed Bottom Floating Dock (< 768px) */}
      <Dock variant="bottom" />

      {/* Command Palette / Quick Navigation Modal */}
      <QuickCommandModal
        open={commandOpen}
        theme={theme}
        onToggleTheme={toggleTheme}
        onLogout={handleLogout}
        onClose={() => setCommandOpen(false)}
      />
    </div>
  );
}
