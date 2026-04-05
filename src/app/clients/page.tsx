'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Users, Plus, Pencil, Trash2, UserCheck, CalendarDays,
  X, Save, Phone, Mail, MapPin, User,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useCart } from '@/context/CartContext';

interface ClientRow {
  id: string;
  name: string;
  address: string;
  email: string;
  phone: string;
  created_at: string;
}

export default function ClientsPage() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<ClientRow>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', address: '', email: '', phone: '' });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { setPendingDevis } = useCart();

  useEffect(() => {
    const fetchClients = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data, error } = await supabase
        .from('clients')
        .select('id, name, address, email, phone, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) console.error('Erreur chargement clients :', error);
      else setClients(data ?? []);
      setLoading(false);
    };

    fetchClients();
  }, []);

  const handleAdd = async () => {
    if (!addForm.name.trim() || !addForm.email.trim()) return;
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const { data, error } = await supabase
      .from('clients')
      .insert({ ...addForm, user_id: user.id })
      .select()
      .single();

    if (error) {
      console.error('Erreur ajout client :', error);
    } else if (data) {
      setClients(prev => [data, ...prev]);
      setAddForm({ name: '', address: '', email: '', phone: '' });
      setShowAddForm(false);
    }
    setSaving(false);
  };

  const handleSaveEdit = async (id: string) => {
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from('clients').update(editForm).eq('id', id);
    if (error) {
      console.error('Erreur modification client :', error);
    } else {
      setClients(prev => prev.map(c => c.id === id ? { ...c, ...editForm } : c));
      setEditingId(null);
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce client définitivement ?')) return;
    setDeletingId(id);
    const supabase = createClient();
    const { error } = await supabase.from('clients').delete().eq('id', id);
    if (error) {
      console.error('Erreur suppression client :', error);
      alert('Erreur lors de la suppression.');
    } else {
      setClients(prev => prev.filter(c => c.id !== id));
    }
    setDeletingId(null);
  };

  const handleUse = (client: ClientRow) => {
    setPendingDevis({
      data: { recepteur: { nom: client.name, adresse: client.address, email: client.email, tel: client.phone } },
      locked: false,
      quoteId: '',
    });
    window.location.href = '/';
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const now = new Date();
  const thisMonth = clients.filter(c => {
    const d = new Date(c.created_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-slate-400 text-sm animate-pulse">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Mes Clients
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {clients.length === 0
              ? 'Aucun client enregistré'
              : `${clients.length} client${clients.length > 1 ? 's' : ''} enregistré${clients.length > 1 ? 's' : ''}`}
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(v => !v)}
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg shadow-sm transition-colors"
        >
          {showAddForm ? <X size={16} /> : <Plus size={16} />}
          {showAddForm ? 'Annuler' : 'Nouveau client'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <div className="bg-indigo-50 dark:bg-indigo-950/30 rounded-xl border border-slate-200/60 dark:border-slate-700/50 px-5 py-4 flex items-center gap-4">
          <div className="w-9 h-9 rounded-lg bg-white dark:bg-slate-900 shadow-sm flex items-center justify-center shrink-0">
            <Users size={18} className="text-indigo-600" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Total clients</p>
            <p className="text-lg font-bold text-slate-900 dark:text-slate-100 leading-tight mt-0.5">{clients.length}</p>
          </div>
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-slate-200/60 dark:border-slate-700/50 px-5 py-4 flex items-center gap-4">
          <div className="w-9 h-9 rounded-lg bg-white dark:bg-slate-900 shadow-sm flex items-center justify-center shrink-0">
            <CalendarDays size={18} className="text-emerald-600" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Ajoutés ce mois-ci</p>
            <p className="text-lg font-bold text-slate-900 dark:text-slate-100 leading-tight mt-0.5">{thisMonth.length}</p>
          </div>
        </div>
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className="bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-2xl shadow-sm p-6 mb-6">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
            <Plus size={14} className="text-indigo-500" />
            Ajouter un client
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              className="form-input"
              placeholder="Nom *"
              value={addForm.name}
              onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
            />
            <input
              className="form-input"
              placeholder="Email *"
              type="email"
              value={addForm.email}
              onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))}
            />
            <input
              className="form-input"
              placeholder="Téléphone"
              value={addForm.phone}
              onChange={e => setAddForm(f => ({ ...f, phone: e.target.value }))}
            />
            <input
              className="form-input"
              placeholder="Adresse"
              value={addForm.address}
              onChange={e => setAddForm(f => ({ ...f, address: e.target.value }))}
            />
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleAdd}
              disabled={saving || !addForm.name.trim() || !addForm.email.trim()}
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              <Save size={14} />
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-700 text-sm px-4 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {clients.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl bg-white dark:bg-slate-900">
          <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
            <Users size={24} className="text-slate-400" />
          </div>
          <p className="text-slate-700 dark:text-slate-300 font-semibold text-base mb-1">Aucun client pour le moment</p>
          <p className="text-slate-400 text-sm mb-6">Ajoutez un client ou enregistrez-en un depuis un devis.</p>
          <button
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg shadow-sm transition-colors"
          >
            <Plus size={16} />
            Ajouter un client
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {clients.map(client => (
            <div
              key={client.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden"
            >
              {editingId === client.id ? (
                <div className="p-6">
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
                    <Pencil size={13} className="text-indigo-500" />
                    Modifier le client
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      className="form-input"
                      placeholder="Nom"
                      value={editForm.name ?? client.name}
                      onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                    />
                    <input
                      className="form-input"
                      placeholder="Email"
                      type="email"
                      value={editForm.email ?? client.email}
                      onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                    />
                    <input
                      className="form-input"
                      placeholder="Téléphone"
                      value={editForm.phone ?? client.phone}
                      onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                    />
                    <input
                      className="form-input"
                      placeholder="Adresse"
                      value={editForm.address ?? client.address}
                      onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))}
                    />
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => handleSaveEdit(client.id)}
                      disabled={saving}
                      className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                    >
                      <Save size={14} />
                      {saving ? 'Enregistrement...' : 'Sauvegarder'}
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-700 text-sm px-4 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-5 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center shrink-0">
                      <User size={18} className="text-indigo-600" />
                    </div>
                    <div className="space-y-1 min-w-0">
                      <p className="font-semibold text-slate-900 dark:text-slate-100">{client.name}</p>
                      {client.email && (
                        <p className="text-xs text-slate-500 flex items-center gap-1.5">
                          <Mail size={11} />
                          {client.email}
                        </p>
                      )}
                      {client.phone && (
                        <p className="text-xs text-slate-500 flex items-center gap-1.5">
                          <Phone size={11} />
                          {client.phone}
                        </p>
                      )}
                      {client.address && (
                        <p className="text-xs text-slate-500 flex items-center gap-1.5">
                          <MapPin size={11} />
                          {client.address}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleUse(client)}
                      title="Utiliser pour un devis"
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <UserCheck size={14} />
                      Utiliser
                    </button>
                    <button
                      onClick={() => { setEditingId(client.id); setEditForm({}); }}
                      title="Modifier"
                      className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => handleDelete(client.id)}
                      title="Supprimer"
                      disabled={deletingId === client.id}
                      className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors disabled:opacity-40"
                    >
                      {deletingId === client.id
                        ? <span className="text-[10px] leading-none">...</span>
                        : <Trash2 size={15} />
                      }
                    </button>
                  </div>
                </div>
              )}
              <div className="px-5 pb-3 flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-2.5">
                <span className="text-[11px] text-slate-400">Ajouté le {formatDate(client.created_at)}</span>
                <Link href="/historique" className="text-[11px] text-indigo-500 hover:text-indigo-700 font-medium transition-colors">
                  Voir les devis
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
