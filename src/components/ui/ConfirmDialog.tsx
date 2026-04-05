'use client';

import { AlertTriangle } from 'lucide-react';
import Button from './bouton';

interface Props {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

export default function ConfirmDialog({
  message,
  onConfirm,
  onCancel,
  confirmLabel = 'Supprimer',
  cancelLabel = 'Annuler',
  danger = true,
}: Props) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-4"
      style={{ backgroundColor: 'rgb(0 0 0 / 0.45)', backdropFilter: 'blur(3px)' }}
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-4"
        style={{
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--border)',
          boxShadow: '0 20px 40px rgb(0 0 0 / 0.15)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span style={{ color: danger ? 'var(--danger)' : 'var(--warning)', flexShrink: 0, marginTop: '1px' }}>
            <AlertTriangle size={20} />
          </span>
          <p style={{ color: 'var(--fg)', fontSize: '0.95rem', lineHeight: '1.5' }}>
            {message}
          </p>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} size="sm" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
