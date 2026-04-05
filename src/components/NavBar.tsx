'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Sun, Moon, FileText, Users, History, Zap } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function NavBar() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  useEffect(() => setMounted(true), []);

  const navLinks = [
    { href: '/', label: 'Devis', icon: FileText },
    { href: '/clients', label: 'Clients', icon: Users },
    { href: '/historique', label: 'Historique', icon: History },
  ];

  return (
    <nav
      className="sticky top-0 z-40 w-full no-print"
      style={{
        backgroundColor: 'var(--nav-bg)',
        borderBottom: '1px solid var(--nav-border)',
        boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.06)',
      }}
    >
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 h-[52px] flex items-center justify-between gap-4">

        {/* ── Brand ──────────────────────────────────────── */}
        <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
          <div
            style={{
              width: '30px',
              height: '30px',
              background: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 6px rgba(37,99,235,0.35)',
            }}
          >
            <Zap size={15} color="white" strokeWidth={2.5} fill="white" />
          </div>
          <div className="hidden sm:flex flex-col leading-none" style={{ gap: '1px' }}>
            <span style={{ fontWeight: '800', fontSize: '0.9rem', color: 'var(--fg)', letterSpacing: '-0.01em' }}>
              DevisPro
            </span>
            <span style={{ fontSize: '0.625rem', fontWeight: '500', color: 'var(--fg-subtle)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Générateur de devis
            </span>
          </div>
        </Link>

        {/* ── Nav links ──────────────────────────────────── */}
        <div className="flex items-center gap-0.5">
          {navLinks.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  padding: '0.375rem 0.75rem',
                  borderRadius: '0.5rem',
                  fontSize: '0.8125rem',
                  fontWeight: active ? 700 : 500,
                  color: active ? 'var(--accent)' : 'var(--fg-muted)',
                  backgroundColor: active ? 'var(--accent-light)' : 'transparent',
                  transition: 'all 0.15s ease',
                  textDecoration: 'none',
                  position: 'relative',
                }}
                onMouseEnter={e => {
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--surface-2)';
                    (e.currentTarget as HTMLElement).style.color = 'var(--fg)';
                  }
                }}
                onMouseLeave={e => {
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                    (e.currentTarget as HTMLElement).style.color = 'var(--fg-muted)';
                  }
                }}
              >
                <Icon size={14} strokeWidth={active ? 2.5 : 2} />
                <span className="hidden sm:inline">{label}</span>
                {active && (
                  <span
                    style={{
                      position: 'absolute',
                      bottom: '-1px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: '16px',
                      height: '2px',
                      backgroundColor: 'var(--accent)',
                      borderRadius: '9999px',
                    }}
                  />
                )}
              </Link>
            );
          })}
        </div>

        {/* ── Right side ─────────────────────────────────── */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Theme toggle */}
          {mounted && (
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              title={theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
                borderRadius: '0.5rem',
                border: '1.5px solid var(--border)',
                backgroundColor: 'transparent',
                color: 'var(--fg-muted)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                flexShrink: 0,
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--surface-2)';
                (e.currentTarget as HTMLElement).style.color = 'var(--fg)';
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-strong)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                (e.currentTarget as HTMLElement).style.color = 'var(--fg-muted)';
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
              }}
            >
              {theme === 'dark'
                ? <Sun size={14} strokeWidth={2} />
                : <Moon size={14} strokeWidth={2} />}
            </button>
          )}
        </div>

      </div>
    </nav>
  );
}
