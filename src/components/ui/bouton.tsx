// components/ui/Button.tsx
'use client';

import React from 'react';
import clsx from 'clsx';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'danger' | 'ghost' | 'success' | 'outline';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  loading?: boolean;
  children: React.ReactNode;
}

const base =
  'inline-flex items-center justify-center font-medium rounded-lg ' +
  'transition-all duration-150 ease-out ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ' +
  'active:scale-[0.97] ' +
  'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 ' +
  'cursor-pointer select-none';

const sizes = {
  xs: 'px-2.5 py-1 text-xs gap-1 min-h-[30px]',
  sm: 'px-3.5 py-1.5 text-sm gap-1.5 min-h-[36px]',
  md: 'px-4 py-2 text-sm gap-2 min-h-[40px]',
  lg: 'px-5 py-2.5 text-base gap-2 min-h-[46px]',
};

const variants = {
  primary:
    'bg-indigo-500 text-white hover:bg-indigo-600 active:bg-indigo-700 ' +
    'focus-visible:ring-indigo-400 shadow-sm',
  danger:
    'bg-red-500/90 text-white hover:bg-red-600 active:bg-red-700 ' +
    'focus-visible:ring-red-300 shadow-sm',
  ghost:
    'bg-transparent text-slate-600 dark:text-zinc-300 ' +
    'hover:bg-slate-100 dark:hover:bg-zinc-800 ' +
    'focus-visible:ring-slate-300 border border-slate-200 dark:border-zinc-700',
  success:
    'bg-emerald-500/90 text-white hover:bg-emerald-600 active:bg-emerald-700 ' +
    'focus-visible:ring-emerald-300 shadow-sm',
  outline:
    'bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-200 ' +
    'border border-slate-200 dark:border-zinc-700 ' +
    'hover:bg-slate-50 dark:hover:bg-zinc-800 hover:border-slate-300 ' +
    'focus-visible:ring-slate-300',
};

function Spinner() {
  return (
    <svg
      className="animate-spin"
      width="14" height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    >
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" opacity="0.3"/>
      <path d="M12 2v4"/>
    </svg>
  );
}

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={clsx(base, sizes[size], variants[variant], className)}
    >
      {loading ? (
        <Spinner />
      ) : icon ? (
        <span className="shrink-0">{icon}</span>
      ) : null}
      {children}
    </button>
  );
}
