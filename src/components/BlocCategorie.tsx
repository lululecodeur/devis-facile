'use client';
import { useState, useEffect } from 'react';
import Button from '@/components/ui/bouton';
import { DndContext, PointerSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2, ChevronUp, Pencil } from 'lucide-react';
import { useToast } from '@/context/ToastContext';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

type LigneCustom = { [cle: string]: any };

interface ColonneCategorie {
  nom: string;
  type: 'texte' | 'quantite' | 'prix' | 'prixAvecMarge';
}

interface CategorieDynamique {
  nom: string;
  colonnes: ColonneCategorie[];
  lignes: LigneCustom[];
  afficher: boolean;
  emoji?: string;
}

/* ── Draggable row ─────────────────────────────── */
function LigneSortable({
  ligne,
  index,
  colonnes,
  onUpdate,
  onDelete,
}: {
  ligne: LigneCustom;
  index: number;
  colonnes: ColonneCategorie[];
  onUpdate: (idx: number, cle: string, val: any) => void;
  onDelete: () => void;
}) {
  const id = ligne._id || index.toString();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    backgroundColor: 'var(--surface)',
  };

  const afficher = (val: any, type?: string): string => {
    const str = String(val ?? '');
    if (type === 'quantite') {
      if (str.includes(',')) return str;
      const n = parseFloat(str.replace(',', '.'));
      if (isNaN(n)) return '';
      return n % 1 === 0 ? String(n) : str;
    }
    return str;
  };

  return (
    <tr ref={setNodeRef} style={style} className="group">
      <td style={{ width: '28px', padding: '0.375rem 0.25rem 0.375rem 0.5rem', color: 'var(--fg-subtle)', cursor: 'grab' }} {...attributes} {...listeners}>
        <GripVertical size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
      </td>

      {colonnes.map((col, ci) => {
        const cle = col.nom;
        if (col.type === 'prixAvecMarge') {
          return (
            <td key={ci} style={{ padding: '0.375rem 0.5rem' }}>
              <div style={{ display: 'flex', gap: '6px' }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '0.65rem', color: 'var(--fg-subtle)', marginBottom: '2px' }}>€ achat</p>
                  <input
                    type="number"
                    onWheel={e => e.currentTarget.blur()}
                    value={afficher(ligne[cle + '_achat'])}
                    onChange={e => onUpdate(index, cle + '_achat', e.target.value)}
                    className="table-input"
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '0.65rem', color: 'var(--fg-subtle)', marginBottom: '2px' }}>% marge</p>
                  <input
                    type="number"
                    onWheel={e => e.currentTarget.blur()}
                    value={afficher(ligne[cle + '_marge'])}
                    onChange={e => onUpdate(index, cle + '_marge', e.target.value)}
                    className="table-input"
                  />
                </div>
              </div>
            </td>
          );
        }
        return (
          <td key={ci} style={{ padding: '0.375rem 0.5rem' }}>
            <input
              type="text"
              value={col.type === 'texte' ? ligne[cle] ?? '' : afficher(ligne[cle], col.type)}
              onChange={e => onUpdate(index, cle, e.target.value)}
              className="table-input"
              style={{ minWidth: '70px' }}
            />
          </td>
        );
      })}

      <td style={{ padding: '0.375rem 0.5rem', textAlign: 'center' }}>
        <button
          onClick={onDelete}
          title="Supprimer"
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '28px', height: '28px', borderRadius: '6px',
            border: '1px solid var(--border)', backgroundColor: 'var(--surface-2)',
            color: 'var(--fg-muted)', cursor: 'pointer', transition: 'all 0.15s ease',
          }}
          onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.backgroundColor = 'var(--danger-light)'; el.style.color = 'var(--danger)'; el.style.borderColor = 'var(--danger)'; }}
          onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.backgroundColor = 'var(--surface-2)'; el.style.color = 'var(--fg-muted)'; el.style.borderColor = 'var(--border)'; }}
        >
          <Trash2 size={13} />
        </button>
      </td>
    </tr>
  );
}

/* ── BlocCategorie ─────────────────────────────── */
export default function BlocCategorie({
  categorie,
  onUpdate,
  onDelete,
  onSaveCategorie,
  onDemanderEdition,
}: {
  categorie: CategorieDynamique;
  onUpdate: (updated: CategorieDynamique) => void;
  onDelete: () => void;
  onSaveCategorie?: (cat: { nom: string; colonnes: ColonneCategorie[]; lignes?: LigneCustom[]; emoji?: string }) => void;
  onDemanderEdition?: (cat: { nom: string; colonnes: ColonneCategorie[] }) => void;
}) {
  const { toast } = useToast();
  const [confirmState, setConfirmState] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const askConfirm = (message: string, onConfirm: () => void) => setConfirmState({ message, onConfirm });

  const [replie, setReplie] = useState(!categorie.afficher);
  const sensors = useSensors(useSensor(PointerSensor));

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 640) setReplie(true);
  }, []);

  const ajouterLigne = () => {
    const nouvelle: LigneCustom = { _id: crypto.randomUUID() };
    categorie.colonnes.forEach(col => {
      if (col.type === 'prixAvecMarge') {
        nouvelle[col.nom + '_achat'] = 0;
        nouvelle[col.nom + '_marge'] = 0;
      } else {
        nouvelle[col.nom] = col.type === 'texte' ? '' : 0;
      }
    });
    onUpdate({ ...categorie, lignes: [...categorie.lignes, nouvelle] });
  };

  const supprimerLigne = (i: number) => {
    const lignes = [...categorie.lignes];
    lignes.splice(i, 1);
    onUpdate({ ...categorie, lignes });
  };

  const modifierValeur = (i: number, cle: string, val: any) => {
    const lignes = [...categorie.lignes];
    lignes[i][cle] = val;
    onUpdate({ ...categorie, lignes });
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = categorie.lignes.findIndex(l => (l._id || '') === active.id);
    const newIndex = categorie.lignes.findIndex(l => (l._id || '') === over.id);
    if (oldIndex !== -1 && newIndex !== -1)
      onUpdate({ ...categorie, lignes: arrayMove(categorie.lignes, oldIndex, newIndex) });
  };

  if (replie) {
    return (
      <div
        className="flex justify-between items-center p-3 rounded-lg"
        style={{ border: '1px solid var(--border)', backgroundColor: 'var(--surface-2)' }}
      >
        <div>
          <span className="font-semibold text-sm" style={{ color: 'var(--fg)' }}>
            {categorie.emoji ? `${categorie.emoji} ` : ''}{categorie.nom || 'Catégorie personnalisée'}
          </span>
          <p className="text-xs mt-0.5" style={{ color: 'var(--fg-muted)' }}>
            {categorie.lignes.length} ligne{categorie.lignes.length > 1 ? 's' : ''} — {categorie.afficher ? 'visible dans PDF' : 'masqué'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setReplie(false)} variant="ghost" size="xs">Afficher</Button>
          <Button onClick={() => onUpdate({ ...categorie, afficher: !categorie.afficher })} variant="outline" size="xs">
            {categorie.afficher ? 'Retirer du PDF' : 'Inclure dans PDF'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-base" style={{ color: 'var(--fg)' }}>
          {categorie.emoji ? `${categorie.emoji} ` : ''}{categorie.nom}
        </h2>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="xs"
            icon={<Pencil size={13} />}
            onClick={() => onDemanderEdition?.({ nom: categorie.nom, colonnes: categorie.colonnes })}
          >
            Modifier structure
          </Button>
          <Button onClick={() => setReplie(true)} variant="ghost" size="xs">
            <ChevronUp size={14} />
            Réduire
          </Button>
        </div>
      </div>

      {/* Table */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="overflow-x-auto rounded-lg" style={{ border: '1px solid var(--border)' }}>
          <table className="w-full text-sm border-separate border-spacing-0">
            <thead>
              <tr>
                <th className="table-header-cell" style={{ width: '28px', borderRadius: '0.5rem 0 0 0' }} />
                {categorie.colonnes.map((col, idx) => (
                  <th key={idx} className="table-header-cell">{col.nom}</th>
                ))}
                <th className="table-header-cell" style={{ textAlign: 'center', borderRadius: '0 0.5rem 0 0' }}>Suppr.</th>
              </tr>
            </thead>
            <SortableContext items={categorie.lignes.map((l, i) => l._id || i.toString())} strategy={verticalListSortingStrategy}>
              <tbody>
                {categorie.lignes.length === 0 && (
                  <tr>
                    <td colSpan={categorie.colonnes.length + 2} style={{ padding: '2rem', textAlign: 'center', color: 'var(--fg-subtle)' }}>
                      Aucune ligne — cliquez sur « Ajouter une ligne » pour commencer.
                    </td>
                  </tr>
                )}
                {categorie.lignes.map((ligne, i) => (
                  <LigneSortable
                    key={ligne._id || i}
                    ligne={ligne}
                    index={i}
                    colonnes={categorie.colonnes}
                    onUpdate={modifierValeur}
                    onDelete={() => supprimerLigne(i)}
                  />
                ))}
              </tbody>
            </SortableContext>
          </table>
        </div>
      </DndContext>

      {/* Add line + PDF toggle + delete */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={ajouterLigne}
          className="inline-flex items-center gap-1.5 text-sm font-medium rounded-lg px-3 py-1.5 transition-all duration-150"
          style={{ border: '1.5px dashed var(--border-strong)', color: 'var(--fg-muted)', backgroundColor: 'transparent', cursor: 'pointer' }}
          onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'var(--accent)'; el.style.color = 'var(--accent)'; el.style.backgroundColor = 'var(--accent-light)'; }}
          onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'var(--border-strong)'; el.style.color = 'var(--fg-muted)'; el.style.backgroundColor = 'transparent'; }}
        >
          + Ajouter une ligne
        </button>

        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={categorie.afficher}
            onChange={e => { const val = e.target.checked; onUpdate({ ...categorie, afficher: val }); if (!val) setReplie(true); }}
            className="sr-only"
          />
          <div className={`toggle-track${categorie.afficher ? ' on' : ''}`} onClick={() => onUpdate({ ...categorie, afficher: !categorie.afficher })}>
            <div className="toggle-thumb" />
          </div>
          <span className="text-sm font-medium" style={{ color: 'var(--fg-muted)' }}>Visible dans le PDF</span>
        </label>

        <Button
          variant="ghost"
          size="xs"
          onClick={() => askConfirm('Retirer cette catégorie du devis ?', onDelete)}
          style={{ marginLeft: 'auto', color: 'var(--danger)' }}
        >
          Supprimer du devis
        </Button>
      </div>

      {confirmState && (
        <ConfirmDialog
          message={confirmState.message}
          onConfirm={() => { confirmState.onConfirm(); setConfirmState(null); }}
          onCancel={() => setConfirmState(null)}
        />
      )}
    </div>
  );
}
