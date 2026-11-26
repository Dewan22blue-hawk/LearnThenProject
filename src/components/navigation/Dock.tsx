import { useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { isNavActive, NAV_ITEMS } from './navConfig';

interface DockProps {
  variant: 'side' | 'top' | 'bottom';
}

export function Dock({ variant }: DockProps) {
  const { pathname } = useLocation();
  const navRef = useRef<HTMLElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const container = navRef.current;
    const indicator = indicatorRef.current;
    if (!container || !indicator) return;

    const adjust = () => {
      const current = container.querySelector<HTMLElement>('[aria-current="page"]');
      if (!current) {
        indicator.dataset.ready = 'false';
        return;
      }
      indicator.style.width = `${current.offsetWidth}px`;
      indicator.style.height = `${current.offsetHeight}px`;
      indicator.style.transform = `translate(${current.offsetLeft}px, ${current.offsetTop}px)`;
      indicator.dataset.ready = 'true';
    };

    const observer = new ResizeObserver(adjust);
    observer.observe(container);
    container.querySelectorAll('a').forEach((link) => observer.observe(link));
    adjust();

    return () => observer.disconnect();
  }, [pathname, variant]);

  if (variant === 'side') {
    return (
      <nav
        ref={navRef}
        aria-label="Navigasi utama"
        className="ol-glass-chrome sticky top-24 hidden lg:flex flex-col items-center gap-1 rounded-full p-1.5"
      >
        <span ref={indicatorRef} className="ol-dock-indicator" aria-hidden="true" />
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => {
          const active = isNavActive(pathname, to);
          return (
            <NavLink
              key={to}
              to={to}
              aria-label={label}
              aria-current={active ? 'page' : undefined}
              className={`group relative z-10 flex h-11 w-11 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ol-accent)] ${
                active
                  ? 'text-[var(--ol-pick-ink)]'
                  : 'text-[var(--ol-muted)] hover:bg-[var(--ol-inner)] hover:text-[var(--ol-ink)]'
              }`}
            >
              <Icon className="h-[18px] w-[18px] stroke-[1.9]" aria-hidden="true" />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute left-[calc(100%+12px)] z-50 whitespace-nowrap rounded-xl border border-[var(--ol-rim)] bg-[var(--ol-surface)] px-3 py-1.5 text-xs font-bold text-[var(--ol-ink)] opacity-0 shadow-lg transition-all duration-150 translate-x-[-4px] group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100"
              >
                {label}
              </span>
            </NavLink>
          );
        })}
      </nav>
    );
  }

  if (variant === 'top') {
    return (
      <nav
        ref={navRef}
        aria-label="Navigasi tablet"
        className="ol-glass-chrome relative hidden md:inline-flex lg:hidden items-center gap-1 rounded-full p-1.5"
      >
        <span ref={indicatorRef} className="ol-dock-indicator" aria-hidden="true" />
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => {
          const active = isNavActive(pathname, to);
          return (
            <NavLink
              key={to}
              to={to}
              aria-current={active ? 'page' : undefined}
              className={`relative z-10 inline-flex min-h-[40px] items-center gap-2 whitespace-nowrap rounded-full px-3.5 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ol-accent)] ${
                active
                  ? 'text-[var(--ol-pick-ink)]'
                  : 'text-[var(--ol-muted)] hover:bg-[var(--ol-inner)] hover:text-[var(--ol-ink)]'
              }`}
            >
              <Icon className="h-4 w-4 stroke-[1.9]" aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          );
        })}
      </nav>
    );
  }

  // Mobile fixed bottom floating glass dock
  return (
    <div className="fixed inset-x-3 bottom-[max(10px,env(safe-area-inset-bottom))] z-40 md:hidden">
      <nav
        ref={navRef}
        aria-label="Navigasi mobile"
        className="ol-glass-chrome relative grid grid-cols-6 items-center gap-0.5 rounded-[26px] p-1.5"
      >
        <span ref={indicatorRef} className="ol-dock-indicator !rounded-[20px]" aria-hidden="true" />
        {NAV_ITEMS.map(({ to, shortLabel, label, icon: Icon }) => {
          const active = isNavActive(pathname, to);
          return (
            <NavLink
              key={to}
              to={to}
              aria-label={label}
              aria-current={active ? 'page' : undefined}
              className={`relative z-10 flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-[20px] px-1 py-1 text-[10px] font-bold leading-tight tracking-tight transition-colors active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ol-accent)] ${
                active
                  ? 'text-[var(--ol-pick-ink)]'
                  : 'text-[var(--ol-muted)] hover:text-[var(--ol-ink)]'
              }`}
            >
              <Icon className="h-[17px] w-[17px] shrink-0 stroke-[2]" aria-hidden="true" />
              <span className="max-w-full truncate">{shortLabel}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
