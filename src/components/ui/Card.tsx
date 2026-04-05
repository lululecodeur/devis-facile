'use client';
import { useState, ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

export default function Card({
  children,
  title,
  icon,
  className = '',
  initialOpen = false,
  badge,
}: {
  children: ReactNode;
  title?: ReactNode;
  icon?: ReactNode;
  className?: string;
  initialOpen?: boolean;
  badge?: ReactNode;
}) {
  const [ouvert, setOuvert] = useState(initialOpen);

  return (
    <div
      className={`w-full card ${className}`}
      style={{ overflow: 'hidden' }}
    >
      {/* Header */}
      <button
        onClick={() => setOuvert(!ouvert)}
        className="w-full flex justify-between items-center cursor-pointer"
        style={{
          padding: '0.875rem 1.25rem',
          backgroundColor: 'transparent',
          border: 'none',
          outline: 'none',
          transition: 'background-color 0.15s ease',
          gap: '0.5rem',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--surface-2)';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', minWidth: 0 }}>
          {icon && (
            <div
              style={{
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '28px',
                height: '28px',
                borderRadius: '7px',
                backgroundColor: 'var(--accent-light)',
                color: 'var(--accent)',
              }}
            >
              {icon}
            </div>
          )}
          <span
            className="font-semibold text-sm text-left truncate"
            style={{ color: 'var(--fg)' }}
          >
            {title}
          </span>
          {badge && (
            <span
              style={{
                flexShrink: 0,
                fontSize: '0.6875rem',
                fontWeight: '600',
                padding: '0.125rem 0.5rem',
                borderRadius: '9999px',
                backgroundColor: 'var(--accent-light)',
                color: 'var(--accent)',
                border: '1px solid var(--accent-mid)',
              }}
            >
              {badge}
            </span>
          )}
        </div>

        <ChevronDown
          size={16}
          style={{
            color: 'var(--fg-subtle)',
            transition: 'transform 0.25s ease',
            transform: ouvert ? 'rotate(0deg)' : 'rotate(-90deg)',
            flexShrink: 0,
          }}
        />
      </button>

      {/* Collapsible body */}
      <div
        style={{
          display: 'grid',
          gridTemplateRows: ouvert ? '1fr' : '0fr',
          transition: 'grid-template-rows 0.28s ease',
        }}
      >
        <div style={{ overflow: 'hidden' }}>
          <div
            style={{
              padding: ouvert ? '0 1.25rem 1.25rem' : '0 1.25rem',
              borderTop: ouvert ? '1px solid var(--border)' : 'none',
              paddingTop: ouvert ? '1rem' : '0',
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
