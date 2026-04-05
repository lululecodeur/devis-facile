'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  FileText,
  Pencil,
  Trash2,
  Eye,
  Download,
  Plus,
  CheckCircle2,
  Clock,
  CalendarDays,
  TrendingUp,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useCart } from '@/context/CartContext';

interface QuoteRow {
  id: string;
  quote_number: string | null;
  content_json: Record<string, any>;
  status: 'draft' | 'finalized';
  total_ttc: number | null;
  created_at: string;
}

export default function HistoriquePage() {
  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { setPendingDevis } = useCart();
  const router = useRouter();

  useEffect(() => {
    const fetchQuotes = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data, error } = await supabase
        .from('quotes')
        .select('id, quote_number, content_json, status, total_ttc, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) console.error('Erreur chargement devis :', error);
      else setQuotes(data ?? []);
      setLoading(false);
    };

    fetchQuotes();
  }, []);

  const handleOpen = (row: QuoteRow) => {
    setPendingDevis({
      data: row.content_json,
      locked: row.status === 'finalized',
      quoteId: row.id,
    });
    router.push('/');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce devis définitivement ?')) return;
    setDeletingId(id);
    const supabase = createClient();
    const { error } = await supabase.from('quotes').delete().eq('id', id);
    if (error) {
      console.error('Erreur suppression :', error);
      alert('Erreur lors de la suppression.');
    } else {
      setQuotes(prev => prev.filter(q => q.id !== id));
    }
    setDeletingId(null);
  };

  const clientName = (row: QuoteRow): string =>
    row.content_json?.recepteur_nom ||
    row.content_json?.recepteur?.nom ||
    'Non spécifié';

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const formatTTC = (val: number | null) =>
    val != null ? `${val.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €` : '—';

  // Stats
  const finalized = quotes.filter(q => q.status === 'finalized');
  const drafts = quotes.filter(q => q.status === 'draft');
  const now = new Date();
  const thisMonth = quotes.filter(q => {
    const d = new Date(q.created_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const totalFinalisedTTC = finalized.reduce((sum, q) => sum + (q.total_ttc ?? 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-slate-400 text-sm animate-pulse">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Mon Historique
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {quotes.length === 0
              ? 'Aucun devis enregistré'
              : `${quotes.length} devis enregistré${quotes.length > 1 ? 's' : ''}`}
          </p>
        </div>
        <Link href="/">
          <button className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg shadow-sm transition-colors">
            <Plus size={16} />
            Nouveau Devis
          </button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard
          icon={<TrendingUp size={18} className="text-indigo-600" />}
          label="Total finalisés"
          value={`${totalFinalisedTTC.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €`}
          bg="bg-indigo-50 dark:bg-indigo-950/30"
        />
        <StatCard
          icon={<Clock size={18} className="text-amber-500" />}
          label="Brouillons en cours"
          value={String(drafts.length)}
          bg="bg-amber-50 dark:bg-amber-950/30"
        />
        <StatCard
          icon={<CalendarDays size={18} className="text-emerald-600" />}
          label="Devis ce mois-ci"
          value={String(thisMonth.length)}
          bg="bg-emerald-50 dark:bg-emerald-950/30"
        />
      </div>

      {/* Empty State */}
      {quotes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl bg-white dark:bg-slate-900">
          <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
            <FileText size={24} className="text-slate-400" />
          </div>
          <p className="text-slate-700 dark:text-slate-300 font-semibold text-base mb-1">Aucun devis pour le moment</p>
          <p className="text-slate-400 text-sm mb-6">Créez votre premier devis et retrouvez-le ici.</p>
          <Link href="/">
            <button className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg shadow-sm transition-colors">
              <Plus size={16} />
              Créer un devis
            </button>
          </Link>
        </div>
      ) : (
        /* Table — scrolls horizontally on mobile */
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-5 py-3.5 whitespace-nowrap">N°</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-5 py-3.5 whitespace-nowrap">Client</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-5 py-3.5 whitespace-nowrap">Total TTC</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-5 py-3.5 whitespace-nowrap">Statut</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-5 py-3.5 whitespace-nowrap">Date</th>
                  <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wide px-5 py-3.5 whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {quotes.map(row => (
                  <tr
                    key={row.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="px-5 py-4 font-mono text-xs text-slate-500 whitespace-nowrap">
                      {row.quote_number ?? '—'}
                    </td>
                    <td className="px-5 py-4 font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap">
                      {clientName(row)}
                    </td>
                    <td className="px-5 py-4 font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      {formatTTC(row.total_ttc)}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="px-5 py-4 text-slate-500 text-xs whitespace-nowrap">
                      {formatDate(row.created_at)}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-1">
                        {/* View / Edit */}
                        <ActionButton
                          onClick={() => handleOpen(row)}
                          title={row.status === 'finalized' ? 'Voir' : 'Modifier'}
                          icon={row.status === 'finalized'
                            ? <Eye size={15} />
                            : <Pencil size={15} />
                          }
                          variant="indigo"
                        />
                        {/* Download PDF — placeholder, wired to open for now */}
                        <ActionButton
                          onClick={() => handleOpen(row)}
                          title="Télécharger PDF"
                          icon={<Download size={15} />}
                          variant="slate"
                        />
                        {/* Delete */}
                        <ActionButton
                          onClick={() => handleDelete(row.id)}
                          title="Supprimer"
                          icon={deletingId === row.id
                            ? <span className="text-[10px] leading-none">...</span>
                            : <Trash2 size={15} />
                          }
                          variant="red"
                          disabled={deletingId === row.id}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Sub-components ───────────────────────────────────────────────────────── */

function StatCard({
  icon,
  label,
  value,
  bg,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  bg: string;
}) {
  return (
    <div className={`${bg} rounded-xl border border-slate-200/60 dark:border-slate-700/50 px-5 py-4 flex items-center gap-4`}>
      <div className="w-9 h-9 rounded-lg bg-white dark:bg-slate-900 shadow-sm flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-xs text-slate-500 font-medium">{label}</p>
        <p className="text-lg font-bold text-slate-900 dark:text-slate-100 leading-tight mt-0.5">{value}</p>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: 'draft' | 'finalized' }) {
  if (status === 'finalized') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
        <CheckCircle2 size={11} />
        Finalisé
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
      <Clock size={11} />
      Brouillon
    </span>
  );
}

function ActionButton({
  onClick,
  title,
  icon,
  variant,
  disabled = false,
}: {
  onClick: () => void;
  title: string;
  icon: React.ReactNode;
  variant: 'indigo' | 'slate' | 'red';
  disabled?: boolean;
}) {
  const base = 'inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
  const variants = {
    indigo: 'text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40',
    slate: 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800',
    red: 'text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40',
  };
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`${base} ${variants[variant]}`}
    >
      {icon}
    </button>
  );
}
