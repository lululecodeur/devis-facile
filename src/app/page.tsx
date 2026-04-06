'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { exporterPDF } from '@/utils/exportPdf';
import PreviewDevis from '@/components/PreviewDevis';
import SignatureBlock from '@/components/SignatureBlock';
import Button from '@/components/ui/bouton';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { useToast } from '@/context/ToastContext';
import { useProfile } from '@/hooks/useProfile';
import { useCart } from '@/context/CartContext';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import {
  GripVertical,
  Plus,
  Trash2,
  Settings2,
  User,
  Download,
  Save,
  ChevronDown,
  FileText,
  X,
  Lock,
  BadgeCheck,
  Scale,
  AlignLeft,
  PenLine,
  Image as ImageIcon,
  ChevronUp,
  Receipt,
  CalendarClock,
  FolderPlus,
} from 'lucide-react';
import {
  genererNumeroDevisSupabase,
  genererNumeroDevis,
  previsualiserNumeroDevis,
} from '@/utils/numeroDevis';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// ─── Types ───────────────────────────────────────────────────────────────────

type LineType = 'service' | 'material' | 'standard';

interface UnifiedLine {
  id: string;
  type: LineType;
  designation: string;
  // service
  serviceMode: 'horaire' | 'fixe';
  prixHoraire: number;
  heures: number;
  prixFixe: number;
  // material
  prixAchat: number;
  margePourcent: number;
  quantite: number;
  prixManuel: number;
  materialMode: 'calculé' | 'manuel';
  // common
  unite: string;
  tvaTaux?: number;
  showSettings?: boolean;
}

interface Category {
  id: string;
  nom: string;
  defaultType: LineType;
  lines: UnifiedLine[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const parseNum = (val: any): number => {
  if (typeof val === 'number') return val;
  return parseFloat(String(val ?? '').replace(',', '.')) || 0;
};

const r2 = (n: number) => Math.round(n * 100) / 100;

const computeLineTotal = (line: UnifiedLine): number => {
  if (line.type === 'service') {
    return line.serviceMode === 'fixe'
      ? r2(parseNum(line.prixFixe))
      : r2(parseNum(line.prixHoraire) * parseNum(line.heures));
  }
  if (line.type === 'standard') {
    return r2(parseNum(line.prixManuel) * parseNum(line.quantite));
  }
  const pu =
    line.materialMode === 'manuel'
      ? parseNum(line.prixManuel)
      : r2(parseNum(line.prixAchat) * (1 + parseNum(line.margePourcent) / 100));
  return r2(pu * parseNum(line.quantite));
};

const fmtCurrency = (n: number) =>
  n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

const makeLine = (type: LineType): UnifiedLine => ({
  id: crypto.randomUUID(),
  type,
  designation: '',
  serviceMode: 'fixe',
  prixHoraire: 0,
  heures: 1,
  prixFixe: 0,
  prixAchat: 0,
  margePourcent: 0,
  quantite: 1,
  prixManuel: 0,
  materialMode: 'calculé',
  unite: type === 'service' ? 'U' : '',
});

const makeCategory = (nom: string, defaultType: LineType): Category => ({
  id: crypto.randomUUID(),
  nom,
  defaultType,
  lines: [],
});

// ─── Constants ────────────────────────────────────────────────────────────────

const LINE_COLORS: Record<LineType, { bg: string; text: string; border: string }> = {
  service: { bg: 'var(--accent-light)', text: 'var(--accent)', border: 'var(--accent-mid)' },
  material: { bg: '#fef3c7', text: '#92400e', border: '#fde68a' },
  standard: { bg: '#f0fdf4', text: '#166534', border: '#bbf7d0' },
};

const LINE_LABELS: Record<LineType, string> = {
  service: "Main d'œuvre",
  material: 'Matériaux',
  standard: 'Standard',
};

const PDF_COLS = [
  { nom: 'Désignation', type: 'texte' as const },
  { nom: 'Unité', type: 'texte' as const },
  { nom: 'Qté', type: 'quantite' as const },
  { nom: 'PU HT', type: 'prix' as const },
];

// ─── ServiceFields ────────────────────────────────────────────────────────────

function ServiceFields({
  line,
  set,
  isLocked,
}: {
  line: UnifiedLine;
  set: (patch: Partial<UnifiedLine>) => void;
  isLocked: boolean;
}) {
  return (
    <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
      <div className="segment-control" style={{ fontSize: '11px' }}>
        {(['fixe', 'horaire'] as const).map(m => (
          <button
            key={m}
            type="button"
            className={`segment-btn${line.serviceMode === m ? ' active' : ''}`}
            onClick={() => !isLocked && set({ serviceMode: m })}
            style={{ padding: '3px 8px', fontSize: '11px' }}
            disabled={isLocked}
          >
            {m === 'fixe' ? 'Forfait' : 'Horaire'}
          </button>
        ))}
      </div>

      {line.serviceMode === 'fixe' ? (
        <div className="flex items-center gap-1">
          <input
            type="number"
            className="form-input"
            style={{ width: '90px', padding: '4px 8px', textAlign: 'right' }}
            placeholder="0,00"
            value={line.prixFixe || ''}
            readOnly={isLocked}
            onChange={e => set({ prixFixe: parseNum(e.target.value) })}
            title="Prix forfaitaire HT"
          />
          <span className="text-xs" style={{ color: 'var(--fg-subtle)' }}>
            € HT
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <input
            type="number"
            className="form-input"
            style={{ width: '52px', padding: '4px 6px', textAlign: 'right' }}
            placeholder="0"
            value={line.heures || ''}
            readOnly={isLocked}
            onChange={e => set({ heures: parseNum(e.target.value) })}
            title="Nombre d'heures"
          />
          <span className="text-xs" style={{ color: 'var(--fg-subtle)' }}>
            h ×
          </span>
          <input
            type="number"
            className="form-input"
            style={{ width: '68px', padding: '4px 6px', textAlign: 'right' }}
            placeholder="0,00"
            value={line.prixHoraire || ''}
            readOnly={isLocked}
            onChange={e => set({ prixHoraire: parseNum(e.target.value) })}
            title="Taux horaire HT"
          />
          <span className="text-xs" style={{ color: 'var(--fg-subtle)' }}>
            €/h
          </span>
        </div>
      )}
    </div>
  );
}

// ─── MaterialFields ───────────────────────────────────────────────────────────

function MaterialFields({
  line,
  set,
  isLocked,
}: {
  line: UnifiedLine;
  set: (patch: Partial<UnifiedLine>) => void;
  isLocked: boolean;
}) {
  return (
    <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
      <div className="segment-control" style={{ fontSize: '11px' }}>
        {(['calculé', 'manuel'] as const).map(m => (
          <button
            key={m}
            type="button"
            className={`segment-btn${line.materialMode === m ? ' active' : ''}`}
            onClick={() => !isLocked && set({ materialMode: m })}
            style={{ padding: '3px 8px', fontSize: '11px' }}
            disabled={isLocked}
          >
            {m === 'calculé' ? 'Marge' : 'Prix fixe'}
          </button>
        ))}
      </div>

      {line.materialMode === 'manuel' ? (
        <div className="flex items-center gap-1">
          <input
            type="number"
            className="form-input"
            style={{ width: '80px', padding: '4px 6px', textAlign: 'right' }}
            placeholder="PV HT"
            value={line.prixManuel || ''}
            readOnly={isLocked}
            onChange={e => set({ prixManuel: parseNum(e.target.value) })}
            title="Prix de vente HT unitaire"
          />
          <span className="text-xs" style={{ color: 'var(--fg-subtle)' }}>
            € ×
          </span>
          <input
            type="number"
            className="form-input"
            style={{ width: '52px', padding: '4px 6px', textAlign: 'right' }}
            placeholder="1"
            value={line.quantite || ''}
            readOnly={isLocked}
            onChange={e => set({ quantite: parseNum(e.target.value) })}
            title="Quantité"
          />
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <input
            type="number"
            className="form-input"
            style={{ width: '68px', padding: '4px 6px', textAlign: 'right' }}
            placeholder="PA HT"
            value={line.prixAchat || ''}
            readOnly={isLocked}
            onChange={e => set({ prixAchat: parseNum(e.target.value) })}
            title="Prix d'achat HT"
          />
          <span className="text-xs" style={{ color: 'var(--fg-subtle)' }}>
            +{' '}
          </span>
          <input
            type="number"
            className="form-input"
            style={{ width: '50px', padding: '4px 6px', textAlign: 'right' }}
            placeholder="%"
            value={line.margePourcent || ''}
            readOnly={isLocked}
            onChange={e => set({ margePourcent: parseNum(e.target.value) })}
            title="Marge %"
          />
          <span className="text-xs" style={{ color: 'var(--fg-subtle)' }}>
            % ×
          </span>
          <input
            type="number"
            className="form-input"
            style={{ width: '50px', padding: '4px 6px', textAlign: 'right' }}
            placeholder="Qté"
            value={line.quantite || ''}
            readOnly={isLocked}
            onChange={e => set({ quantite: parseNum(e.target.value) })}
            title="Quantité"
          />
        </div>
      )}
    </div>
  );
}

// ─── StandardFields ───────────────────────────────────────────────────────────

function StandardFields({
  line,
  set,
  isLocked,
}: {
  line: UnifiedLine;
  set: (patch: Partial<UnifiedLine>) => void;
  isLocked: boolean;
}) {
  return (
    <div className="flex items-center gap-1 flex-shrink-0">
      <input
        type="number"
        className="form-input"
        style={{ width: '82px', padding: '4px 8px', textAlign: 'right' }}
        placeholder="Prix HT"
        value={line.prixManuel || ''}
        readOnly={isLocked}
        onChange={e => set({ prixManuel: parseNum(e.target.value) })}
        title="Prix unitaire HT"
      />
      <span className="text-xs" style={{ color: 'var(--fg-subtle)' }}>
        € ×
      </span>
      <input
        type="number"
        className="form-input"
        style={{ width: '52px', padding: '4px 6px', textAlign: 'right' }}
        placeholder="1"
        value={line.quantite || ''}
        readOnly={isLocked}
        onChange={e => set({ quantite: parseNum(e.target.value) })}
        title="Quantité"
      />
    </div>
  );
}

// ─── LineRow (sortable) ───────────────────────────────────────────────────────

function LineRow({
  line,
  onUpdate,
  onDelete,
  globalTvaTaux,
  isLocked,
}: {
  line: UnifiedLine;
  onUpdate: (updated: UnifiedLine) => void;
  onDelete: () => void;
  globalTvaTaux: number;
  isLocked: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: line.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 1000 : undefined,
  };

  const set = (patch: Partial<UnifiedLine>) => onUpdate({ ...line, ...patch });
  const total = computeLineTotal(line);

  return (
    <div ref={setNodeRef} style={style} className="flex flex-col gap-0">
      <div
        className="flex items-center gap-2 py-2 px-3 rounded-lg group"
        style={{ border: '1px solid var(--border)', backgroundColor: 'var(--surface)' }}
      >
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="text-gray-300 hover:text-gray-400 cursor-grab active:cursor-grabbing flex-shrink-0"
          style={{ touchAction: 'none', padding: '4px' }}
          disabled={isLocked}
          title="Déplacer"
        >
          <GripVertical size={14} />
        </button>

        {/* Designation */}
        <input
          className="form-input flex-1 min-w-0"
          style={{ minWidth: '100px' }}
          placeholder={
            line.type === 'service'
              ? 'Prestation…'
              : line.type === 'standard'
                ? 'Description…'
                : 'Fourniture…'
          }
          value={line.designation}
          readOnly={isLocked}
          onChange={e => set({ designation: e.target.value })}
        />

        {/* Type-specific fields */}
        {line.type === 'service' && <ServiceFields line={line} set={set} isLocked={isLocked} />}
        {line.type === 'material' && <MaterialFields line={line} set={set} isLocked={isLocked} />}
        {line.type === 'standard' && <StandardFields line={line} set={set} isLocked={isLocked} />}

        {/* Total */}
        <div
          className="flex-shrink-0 text-right font-semibold text-sm"
          style={{ minWidth: '72px', color: 'var(--fg)' }}
        >
          {fmtCurrency(total)}
        </div>

        {/* Actions — always visible */}
        {!isLocked && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => set({ showSettings: !line.showSettings })}
              className="p-1.5 rounded transition-colors"
              style={{
                color: line.showSettings ? 'var(--accent)' : 'var(--fg-subtle)',
                backgroundColor: line.showSettings ? 'var(--accent-light)' : 'transparent',
              }}
              title="Paramètres avancés"
            >
              <Settings2 size={13} />
            </button>
            <button
              onClick={onDelete}
              className="p-1.5 rounded transition-colors hover:text-red-500"
              style={{ color: 'var(--fg-subtle)' }}
              title="Supprimer"
            >
              <Trash2 size={13} />
            </button>
          </div>
        )}
      </div>

      {/* Expanded settings */}
      {line.showSettings && !isLocked && (
        <div
          className="flex flex-wrap items-center gap-4 px-4 py-3 rounded-b-lg -mt-1"
          style={{
            border: '1px solid var(--border)',
            borderTop: 'none',
            backgroundColor: 'var(--surface-2)',
          }}
        >
          <div className="flex items-center gap-2">
            <label
              className="text-xs font-medium"
              style={{ color: 'var(--fg-muted)', whiteSpace: 'nowrap' }}
            >
              TVA ligne (%)
            </label>
            <input
              type="number"
              className="form-input"
              style={{ width: '80px', padding: '4px 8px', fontSize: '12px' }}
              placeholder={String(globalTvaTaux)}
              value={line.tvaTaux ?? ''}
              onChange={e =>
                set({ tvaTaux: e.target.value === '' ? undefined : parseNum(e.target.value) })
              }
            />
            {line.tvaTaux !== undefined && (
              <button
                onClick={() => set({ tvaTaux: undefined })}
                className="text-xs"
                style={{ color: 'var(--fg-muted)', textDecoration: 'underline' }}
              >
                Réinitialiser
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium" style={{ color: 'var(--fg-muted)' }}>
              Unité
            </label>
            <input
              className="form-input"
              style={{ width: '64px', padding: '4px 8px', fontSize: '12px' }}
              value={line.unite}
              onChange={e => set({ unite: e.target.value })}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── CategorySection ──────────────────────────────────────────────────────────

function CategorySection({
  category,
  onUpdate,
  onDelete,
  globalTvaTaux,
  isLocked,
}: {
  category: Category;
  onUpdate: (updated: Category) => void;
  onDelete: () => void;
  globalTvaTaux: number;
  isLocked: boolean;
}) {
  const [showTypeMenu, setShowTypeMenu] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const setLines = useCallback(
    (lines: UnifiedLine[]) => onUpdate({ ...category, lines }),
    [category, onUpdate]
  );

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (over && active.id !== over.id) {
      const oldIndex = category.lines.findIndex(l => l.id === active.id);
      const newIndex = category.lines.findIndex(l => l.id === over.id);
      setLines(arrayMove(category.lines, oldIndex, newIndex));
    }
  };

  const updateLine = (id: string, updated: UnifiedLine) =>
    setLines(category.lines.map(l => (l.id === id ? updated : l)));

  const deleteLine = (id: string) => setLines(category.lines.filter(l => l.id !== id));

  const addLine = (type: LineType) => setLines([...category.lines, makeLine(type)]);

  const subtotal = category.lines.reduce((s, l) => s + computeLineTotal(l), 0);
  const lineCount = category.lines.length;

  return (
    <div
      className="flex flex-col rounded-xl overflow-hidden"
      style={{ border: '1.5px solid var(--border)', backgroundColor: 'var(--surface)' }}
    >
      {/* Category header */}
      <div
        className="flex items-center gap-3 px-4 py-3"
        style={{
          background: 'linear-gradient(to right, var(--surface-2), var(--surface))',
          borderBottom: '1px solid var(--border)',
          borderLeft: '3px solid var(--accent)',
        }}
      >
        {/* Category name */}
        {isLocked ? (
          <span className="flex-1 text-sm font-bold" style={{ color: 'var(--fg)' }}>
            {category.nom || 'Catégorie'}
          </span>
        ) : (
          <input
            className="flex-1 bg-transparent border-0 outline-none text-sm font-bold"
            style={{ color: 'var(--fg)', boxShadow: 'none', padding: '2px 4px', minWidth: 0 }}
            placeholder="Nom de la catégorie…"
            value={category.nom}
            onChange={e => onUpdate({ ...category, nom: e.target.value })}
          />
        )}

        {/* Line count badge */}
        {lineCount > 0 && (
          <span
            className="flex-shrink-0 text-xs px-2 py-0.5 rounded-full"
            style={{
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
              color: 'var(--fg-muted)',
            }}
          >
            {lineCount} ligne{lineCount > 1 ? 's' : ''}
          </span>
        )}

        {/* Subtotal */}
        <span
          className="flex-shrink-0 text-sm font-semibold"
          style={{ color: 'var(--fg)', minWidth: '80px', textAlign: 'right' }}
        >
          {fmtCurrency(subtotal)}
        </span>

        {/* Section type gear + delete */}
        {!isLocked && (
          <div className="flex items-center gap-1 flex-shrink-0">
            {/* Type settings gear */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowTypeMenu(o => !o)}
                className="p-1.5 rounded transition-colors"
                style={{
                  color: showTypeMenu ? 'var(--accent)' : 'var(--fg-subtle)',
                  backgroundColor: showTypeMenu ? 'var(--accent-light)' : 'transparent',
                }}
                title="Changer le type de section"
              >
                <Settings2 size={14} />
              </button>
              {showTypeMenu && (
                <>
                  <div
                    className="fixed inset-0"
                    onClick={() => setShowTypeMenu(false)}
                    style={{ zIndex: 40 }}
                  />
                  <div
                    className="absolute right-0 top-full mt-1 rounded-xl shadow-lg overflow-hidden"
                    style={{
                      zIndex: 50,
                      backgroundColor: 'var(--surface)',
                      border: '1px solid var(--border)',
                      minWidth: '170px',
                    }}
                  >
                    <div
                      className="px-3 py-2 text-xs font-semibold uppercase tracking-wide"
                      style={{ color: 'var(--fg-subtle)', borderBottom: '1px solid var(--border)' }}
                    >
                      Type de section
                    </div>
                    {(['service', 'material', 'standard'] as const).map(t => {
                      const c = LINE_COLORS[t];
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => {
                            onUpdate({
                              ...category,
                              defaultType: t,
                              lines: category.lines.map(l => ({ ...l, type: t })),
                            });
                            setShowTypeMenu(false);
                          }}
                          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-left transition-colors"
                          style={{
                            backgroundColor: category.defaultType === t ? c.bg : 'transparent',
                            color: category.defaultType === t ? c.text : 'var(--fg)',
                          }}
                        >
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: c.text }}
                          />
                          {LINE_LABELS[t]}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Delete category */}
            <button
              onClick={onDelete}
              className="p-1.5 rounded transition-colors hover:text-red-500"
              style={{ color: 'var(--fg-subtle)' }}
              title="Supprimer cette catégorie"
            >
              <Trash2 size={13} />
            </button>
          </div>
        )}
      </div>

      {/* Lines */}
      <div className="flex flex-col gap-0 p-3">
        {category.lines.length === 0 && (
          <div
            className="flex flex-col items-center justify-center py-6 rounded-lg mb-3"
            style={{ border: '1.5px dashed var(--border)', backgroundColor: 'var(--surface-2)' }}
          >
            <p className="text-xs" style={{ color: 'var(--fg-subtle)' }}>
              Aucune ligne — cliquez sur &quot;+ Ajouter une ligne&quot; ci-dessous
            </p>
          </div>
        )}

        {category.lines.length > 0 && (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={category.lines.map(l => l.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="flex flex-col gap-1.5 mb-3">
                {category.lines.map(line => (
                  <LineRow
                    key={line.id}
                    line={line}
                    onUpdate={updated => updateLine(line.id, updated)}
                    onDelete={() => deleteLine(line.id)}
                    globalTvaTaux={globalTvaTaux}
                    isLocked={isLocked}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        {/* Add line inside category */}
        {!isLocked && <AddLineCategoryButton defaultType={category.defaultType} onAdd={addLine} />}
      </div>
    </div>
  );
}

// ─── AddLineCategoryButton ────────────────────────────────────────────────────

function AddLineCategoryButton({
  defaultType,
  onAdd,
}: {
  defaultType: LineType;
  onAdd: (type: LineType) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onAdd(defaultType)}
      className="flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-lg transition-all w-full justify-center"
      style={{
        border: '1.5px dashed var(--border)',
        color: 'var(--accent)',
        backgroundColor: 'var(--accent-light)',
      }}
    >
      <Plus size={13} />
      Ajouter une ligne
    </button>
  );
}

// ─── CategoryEditor ───────────────────────────────────────────────────────────

const SECTION_TYPES: { type: LineType; label: string; desc: string }[] = [
  { type: 'service', label: "Main d'œuvre", desc: 'Forfait ou taux horaire' },
  { type: 'material', label: 'Matériaux', desc: "Prix d'achat + marge ou prix fixe" },
  { type: 'standard', label: 'Catégorie personnalisée', desc: 'Prix unitaire × quantité' },
];

function CategoryEditor({
  categories,
  setCategories,
  globalTvaTaux,
  isLocked,
}: {
  categories: Category[];
  setCategories: (cats: Category[]) => void;
  globalTvaTaux: number;
  isLocked: boolean;
}) {
  const [addCatMenuOpen, setAddCatMenuOpen] = useState(false);

  const updateCategory = useCallback(
    (id: string, updated: Category) =>
      setCategories(categories.map(c => (c.id === id ? updated : c))),
    [categories, setCategories]
  );

  const deleteCategory = (id: string) => setCategories(categories.filter(c => c.id !== id));

  const addCategory = (type: LineType) => {
    const nom = SECTION_TYPES.find(s => s.type === type)?.label ?? 'Nouvelle section';
    setCategories([...categories, makeCategory(nom, type)]);
    setAddCatMenuOpen(false);
  };

  if (categories.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <div
          className="flex flex-col items-center justify-center py-12 rounded-xl"
          style={{ border: '1.5px dashed var(--border)', backgroundColor: 'var(--surface-2)' }}
        >
          <FolderPlus size={24} style={{ color: 'var(--fg-subtle)', marginBottom: '10px' }} />
          <p className="text-sm font-semibold" style={{ color: 'var(--fg-muted)' }}>
            Aucune catégorie
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--fg-subtle)' }}>
            Ajoutez des sections pour organiser votre devis
          </p>
          {!isLocked && (
            <div className="flex gap-2 mt-4">
              {SECTION_TYPES.map(({ type, label }) => {
                const c = LINE_COLORS[type];
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => addCategory(type)}
                    className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg"
                    style={{
                      backgroundColor: c.bg,
                      color: c.text,
                      border: `1px solid ${c.border}`,
                    }}
                  >
                    <Plus size={12} />
                    {label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Category sections */}
      {categories.map(cat => (
        <CategorySection
          key={cat.id}
          category={cat}
          onUpdate={updated => updateCategory(cat.id, updated)}
          onDelete={() => deleteCategory(cat.id)}
          globalTvaTaux={globalTvaTaux}
          isLocked={isLocked}
        />
      ))}

      {/* Add category */}
      {!isLocked && (
        <div className="relative mt-1">
          <button
            type="button"
            onClick={() => setAddCatMenuOpen(o => !o)}
            className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg transition-all w-full justify-center"
            style={{
              border: '1.5px dashed var(--border)',
              color: 'var(--fg-muted)',
              backgroundColor: 'var(--surface-2)',
            }}
          >
            <FolderPlus size={15} />
            Ajouter une catégorie
          </button>

          {addCatMenuOpen && (
            <>
              <div
                className="fixed inset-0"
                onClick={() => setAddCatMenuOpen(false)}
                style={{ zIndex: 40 }}
              />
              <div
                className="absolute left-0 right-0 top-full mt-1 rounded-xl shadow-xl overflow-hidden"
                style={{
                  zIndex: 50,
                  backgroundColor: 'var(--surface)',
                  border: '1px solid var(--border)',
                }}
              >
                {SECTION_TYPES.map(({ type, label, desc }) => {
                  const c = LINE_COLORS[type];
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => addCategory(type)}
                      className="flex items-center gap-3 w-full px-4 py-3 text-left transition-colors hover:opacity-90"
                      style={{ borderBottom: '1px solid var(--border)' }}
                    >
                      <span
                        className="flex-shrink-0 text-xs font-bold px-2 py-0.5 rounded-full"
                        style={{
                          backgroundColor: c.bg,
                          color: c.text,
                          border: `1px solid ${c.border}`,
                        }}
                      >
                        {label}
                      </span>
                      <div>
                        <p className="text-sm font-medium" style={{ color: 'var(--fg)' }}>
                          {label}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--fg-muted)' }}>
                          {desc}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
    >
      <div className="card w-full max-w-md max-h-[90vh] overflow-y-auto" style={{ padding: '0' }}>
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <h2 className="text-base font-semibold" style={{ color: 'var(--fg)' }}>
            {title}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:opacity-70 transition-opacity"
            style={{ color: 'var(--fg-muted)' }}
          >
            <X size={16} />
          </button>
        </div>
        <div className="px-5 py-4 flex flex-col gap-4">{children}</div>
      </div>
    </div>
  );
}

// ─── DocumentHeader ───────────────────────────────────────────────────────────

function DocumentHeader({
  logo,
  hauteurLogo,
  emetteur,
  recepteur,
  numeroDevis,
  titre,
  statut,
  onClickEmetteur,
  onClickClient,
  onClickLogo,
}: {
  logo: string | null;
  hauteurLogo: number;
  emetteur: { nom: string; adresse?: string; email?: string; tel?: string; siret?: string };
  recepteur: { nom: string; adresse?: string; email?: string; tel?: string };
  numeroDevis: string;
  titre: string;
  statut: 'brouillon' | 'finalise';
  onClickEmetteur: () => void;
  onClickClient: () => void;
  onClickLogo: () => void;
}) {
  const today = new Date().toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-4"
      style={{ border: '1px solid var(--border)', backgroundColor: 'var(--surface)' }}
    >
      <div className="flex items-start justify-between gap-4">
        <button
          type="button"
          onClick={onClickEmetteur}
          className="flex items-start gap-3 text-left flex-1 min-w-0 p-2 rounded-lg transition-all hover:opacity-80 group"
          style={{ border: '1px dashed var(--border)', backgroundColor: 'transparent' }}
        >
          {logo ? (
            <img
              src={logo}
              alt="Logo"
              style={{
                height: `${Math.min(hauteurLogo, 60)}px`,
                objectFit: 'contain',
                maxWidth: '120px',
                flexShrink: 0,
              }}
            />
          ) : (
            <div
              className="flex flex-col items-center justify-center rounded-lg flex-shrink-0"
              style={{
                width: '48px',
                height: '48px',
                border: '1.5px dashed var(--border)',
                backgroundColor: 'var(--surface-2)',
              }}
              onClick={e => {
                e.stopPropagation();
                onClickLogo();
              }}
            >
              <ImageIcon size={16} style={{ color: 'var(--fg-subtle)' }} />
            </div>
          )}
          <div className="min-w-0">
            <p
              className="font-semibold text-sm truncate"
              style={{ color: emetteur.nom ? 'var(--fg)' : 'var(--fg-subtle)' }}
            >
              {emetteur.nom || 'Informations de votre entreprise'}
            </p>
            {emetteur.adresse && (
              <p
                className="text-xs mt-0.5 whitespace-pre-line"
                style={{ color: 'var(--fg-muted)' }}
              >
                {emetteur.adresse}
              </p>
            )}
            {emetteur.email && (
              <p className="text-xs mt-0.5" style={{ color: 'var(--fg-muted)' }}>
                {emetteur.email}
              </p>
            )}
            <p
              className="text-xs mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ color: 'var(--accent)' }}
            >
              Cliquer pour modifier
            </p>
          </div>
        </button>

        <div className="text-right flex-shrink-0">
          {statut === 'finalise' ? (
            <div className="flex items-center gap-1.5 justify-end mb-1">
              <Lock size={12} style={{ color: 'var(--fg-subtle)' }} />
              <span className="text-xs font-semibold" style={{ color: 'var(--fg-muted)' }}>
                Finalisé
              </span>
            </div>
          ) : (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold mb-1"
              style={{
                backgroundColor: 'var(--accent-light)',
                color: 'var(--accent)',
                border: '1px solid var(--accent-mid)',
              }}
            >
              Brouillon
            </span>
          )}
          <p className="text-xs font-mono font-semibold" style={{ color: 'var(--fg)' }}>
            {numeroDevis || '—'}
          </p>
          <p className="text-xs" style={{ color: 'var(--fg-muted)' }}>
            {today}
          </p>
        </div>
      </div>

      <div className="h-px w-full" style={{ backgroundColor: 'var(--border)' }} />
      <p className="text-sm font-semibold" style={{ color: 'var(--fg)' }}>
        {titre || 'Titre du devis'}
      </p>

      <button
        type="button"
        onClick={onClickClient}
        className="flex items-start gap-3 text-left p-3 rounded-lg transition-all hover:opacity-80 group w-full"
        style={{ border: '1px dashed var(--border)', backgroundColor: 'var(--surface-2)' }}
      >
        <div
          className="flex items-center justify-center rounded-full flex-shrink-0"
          style={{
            width: '32px',
            height: '32px',
            backgroundColor: 'var(--accent-light)',
            border: '1px solid var(--accent-mid)',
          }}
        >
          <User size={14} style={{ color: 'var(--accent)' }} />
        </div>
        <div className="min-w-0">
          <p
            className="font-semibold text-sm"
            style={{ color: recepteur.nom ? 'var(--fg)' : 'var(--fg-subtle)' }}
          >
            {recepteur.nom || 'Nom du client'}
          </p>
          {recepteur.adresse && (
            <p className="text-xs mt-0.5 whitespace-pre-line" style={{ color: 'var(--fg-muted)' }}>
              {recepteur.adresse}
            </p>
          )}
          {recepteur.email && (
            <p className="text-xs" style={{ color: 'var(--fg-muted)' }}>
              {recepteur.email}
            </p>
          )}
          {!recepteur.nom && (
            <p className="text-xs" style={{ color: 'var(--fg-subtle)' }}>
              Cliquer pour renseigner le client
            </p>
          )}
        </div>
        <span
          className="ml-auto text-xs opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 self-center"
          style={{ color: 'var(--accent)' }}
        >
          Modifier
        </span>
      </button>
    </div>
  );
}

// ─── Accordion ────────────────────────────────────────────────────────────────

function Accordion({
  title,
  icon,
  children,
  defaultOpen = false,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        style={{ borderBottom: open ? '1px solid var(--border)' : 'none' }}
      >
        <span
          className="flex items-center gap-2 text-sm font-semibold"
          style={{ color: 'var(--fg)' }}
        >
          {icon}
          {title}
        </span>
        {open ? (
          <ChevronUp size={14} style={{ color: 'var(--fg-muted)' }} />
        ) : (
          <ChevronDown size={14} style={{ color: 'var(--fg-muted)' }} />
        )}
      </button>
      {open && <div className="px-4 py-4 flex flex-col gap-4">{children}</div>}
    </div>
  );
}

// ─── StickyBar ────────────────────────────────────────────────────────────────

function StickyBar({
  totalHT,
  tva,
  totalTTC,
  sujetTVA,
  tvaTaux,
  savingQuote,
  exportEnCours,
  statut,
  onSaveDraft,
  onExport,
}: {
  totalHT: number;
  tva: number;
  totalTTC: number;
  sujetTVA: boolean;
  tvaTaux: number;
  savingQuote: boolean;
  exportEnCours: boolean;
  statut: 'brouillon' | 'finalise';
  onSaveDraft: () => void;
  onExport: () => void;
}) {
  return (
    <div
      className="sticky top-0 z-30 flex items-center gap-3 px-4 py-2.5 rounded-xl mb-5"
      style={{
        backgroundColor: 'var(--surface)',
        border: '1px solid var(--border)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div className="flex items-center gap-4 flex-1 min-w-0 overflow-hidden">
        <div className="flex flex-col min-w-[60px]">
          <span className="text-xs font-medium" style={{ color: 'var(--fg-subtle)' }}>
            HT
          </span>
          <span className="text-sm font-semibold" style={{ color: 'var(--fg)' }}>
            {fmtCurrency(totalHT)}
          </span>
        </div>
        <div className="h-8 w-px" style={{ backgroundColor: 'var(--border)' }} />
        <div className="flex flex-col min-w-[60px] hidden sm:flex">
          <span className="text-xs font-medium" style={{ color: 'var(--fg-subtle)' }}>
            {sujetTVA ? `TVA ${tvaTaux}%` : 'TVA'}
          </span>
          <span className="text-sm font-semibold" style={{ color: 'var(--fg)' }}>
            {sujetTVA ? fmtCurrency(tva) : '—'}
          </span>
        </div>
        <div className="h-8 w-px hidden sm:block" style={{ backgroundColor: 'var(--border)' }} />
        <div className="flex flex-col min-w-[80px]">
          <span className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>
            TTC
          </span>
          <span className="text-base font-bold" style={{ color: 'var(--accent)' }}>
            {fmtCurrency(totalTTC)}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {statut === 'brouillon' && (
          <Button
            onClick={onSaveDraft}
            disabled={savingQuote}
            variant="ghost"
            size="sm"
            icon={<Save size={14} />}
          >
            <span className="hidden sm:inline">
              {savingQuote ? 'Enregistrement…' : 'Brouillon'}
            </span>
          </Button>
        )}
        <Button
          onClick={onExport}
          disabled={exportEnCours}
          variant="primary"
          size="sm"
          icon={<Download size={14} />}
        >
          {exportEnCours ? 'Export…' : 'Exporter PDF'}
        </Button>
      </div>
    </div>
  );
}

// ─── Migration helpers ────────────────────────────────────────────────────────

function migrateOldUnifiedLines(lines: any[]): Category[] {
  const cats: Category[] = [];
  let current: Category | null = null;

  for (const line of lines) {
    if (line.type === 'section') {
      current = makeCategory(line.designation || 'Section', line.defaultLineType || 'service');
      cats.push(current);
    } else {
      if (!current) {
        current = makeCategory('Prestations', 'service');
        cats.push(current);
      }
      const {
        id,
        type,
        designation,
        serviceMode,
        prixHoraire,
        heures,
        prixFixe,
        prixAchat,
        margePourcent,
        quantite,
        prixManuel,
        materialMode,
        unite,
        tvaTaux,
      } = line;
      if (type === 'service' || type === 'material') {
        current.lines.push({
          id: id || crypto.randomUUID(),
          type,
          designation: designation || '',
          serviceMode: serviceMode || 'fixe',
          prixHoraire: parseNum(prixHoraire),
          heures: parseNum(heures) || 1,
          prixFixe: parseNum(prixFixe),
          prixAchat: parseNum(prixAchat),
          margePourcent: parseNum(margePourcent),
          quantite: parseNum(quantite) || 1,
          prixManuel: parseNum(prixManuel),
          materialMode: materialMode || 'calculé',
          unite: unite || '',
          tvaTaux,
        });
      }
    }
  }

  return cats.length > 0
    ? cats
    : [makeCategory("Main d'œuvre", 'service'), makeCategory('Matériaux', 'material')];
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function EditorDevis() {
  const { toast } = useToast();
  const [confirmState, setConfirmState] = useState<{
    message: string;
    onConfirm: () => void;
  } | null>(null);
  const askConfirm = (message: string, onConfirm: () => void) =>
    setConfirmState({ message, onConfirm });

  const {
    userId,
    emetteur,
    setEmetteur,
    profilArtisan,
    iban,
    setIban,
    bic,
    setBic,
    saving: profileSaving,
    saveProfile,
  } = useProfile();
  const { pendingDevis, setPendingDevis, setCalcParams, updateLines, totals } = useCart();

  // ── Core state ──────────────────────────────────────────────────────────────
  const [titre, setTitre] = useState('Nouveau devis');
  const [mentions, setMentions] = useState('');
  const [intro, setIntro] = useState('');
  const [conclusion, setConclusion] = useState('');
  const [logo, setLogo] = useState<string | null>(null);
  const [hauteurLogo, setHauteurLogo] = useState(80);
  const [tvaTaux, setTvaTaux] = useState(20);
  const [remisePourcent, setRemisePourcent] = useState(0);
  const [acomptePourcent, setAcomptePourcent] = useState(30);
  const [sujetTVA, setSujetTVA] = useState(true);
  const [dureeValidite, setDureeValidite] = useState(30);
  const [conditionsReglement, setConditionsReglement] = useState(
    '30 % à la signature du devis, solde à la réception des travaux.'
  );
  const [recepteur, setRecepteur] = useState({ nom: '', adresse: '', email: '', tel: '' });
  const [numeroDevis, setNumeroDevis] = useState('');
  const [statut, setStatut] = useState<'brouillon' | 'finalise'>('brouillon');
  const [dateFinalisation, setDateFinalisation] = useState<string | null>(null);
  const [quoteId, setQuoteId] = useState<string | null>(null);
  const [savingQuote, setSavingQuote] = useState(false);
  const [exportEnCours, setExportEnCours] = useState(false);
  const [signatureEmetteur, setSignatureEmetteur] = useState<string | null>(null);
  const [signatureClient, setSignatureClient] = useState<string | null>(null);
  const [clientId, setClientId] = useState('');
  const [clientsList, setClientsList] = useState<
    { id: string; name: string; address: string; email: string; phone: string }[]
  >([]);
  const [showPDFMobile, setShowPDFMobile] = useState(false);
  const [showEmetteurModal, setShowEmetteurModal] = useState(false);
  const [showClientModal, setShowClientModal] = useState(false);
  const [showLogoModal, setShowLogoModal] = useState(false);

  // ── Category state ───────────────────────────────────────────────────────
  const [categories, setCategories] = useState<Category[]>([
    makeCategory("Main d'œuvre", 'service'),
    makeCategory('Matériaux', 'material'),
  ]);

  // ── Flatten all lines for CartContext + PreviewDevis compat ──────────────
  const allLines = useMemo(() => categories.flatMap(c => c.lines), [categories]);

  const lignesMainOeuvre = useMemo(
    () =>
      allLines
        .filter(l => l.type === 'service')
        .map(l => ({
          id: l.id,
          designation: l.designation,
          unite: l.unite || 'U',
          mode: l.serviceMode as 'horaire' | 'fixe',
          prixHoraire: l.prixHoraire,
          heures: l.heures,
          prixFixe: l.prixFixe,
          tvaTaux: l.tvaTaux,
        })),
    [allLines]
  );

  const lignesPieces = useMemo(
    () =>
      allLines
        .filter(l => l.type === 'material' || l.type === 'standard')
        .map(l =>
          l.type === 'standard'
            ? {
                id: l.id,
                designation: l.designation,
                unite: l.unite || 'U',
                prixAchat: 0,
                margePourcent: 0,
                quantite: l.quantite,
                prixManuel: l.prixManuel,
                mode: 'manuel' as const,
                tvaTaux: l.tvaTaux,
              }
            : {
                id: l.id,
                designation: l.designation,
                unite: l.unite,
                prixAchat: l.prixAchat,
                margePourcent: l.margePourcent,
                quantite: l.quantite,
                prixManuel: l.prixManuel,
                mode: l.materialMode as 'calculé' | 'manuel',
                tvaTaux: l.tvaTaux,
              }
        ),
    [allLines]
  );

  // ── Sync CartContext ─────────────────────────────────────────────────────
  useEffect(() => {
    setCalcParams({
      tvaTaux,
      remisePourcent,
      acomptePourcent,
      sujetTVA,
      afficherMainOeuvre: true,
      afficherPieces: true,
    });
  }, [tvaTaux, remisePourcent, acomptePourcent, sujetTVA]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    updateLines(lignesMainOeuvre, lignesPieces, []);
  }, [lignesMainOeuvre, lignesPieces]); // eslint-disable-line react-hooks/exhaustive-deps

  const { totalHTBrut, remise, totalHT, tva, totalTTC, acompte, groupesTVA } = totals;

  // ── Derive categoriesDynamiques for PDF preview ──────────────────────────
  const previewCategoriesDynamiques = useMemo(() => {
    return categories
      .filter(c => c.lines.length > 0)
      .map(cat => ({
        nom: cat.nom,
        colonnes: PDF_COLS,
        afficher: true,
        lignes: cat.lines.map(line => {
          let qty: number, pu: number, unite: string;
          if (line.type === 'service') {
            qty = line.serviceMode === 'horaire' ? parseNum(line.heures) : 1;
            pu =
              line.serviceMode === 'horaire' ? parseNum(line.prixHoraire) : parseNum(line.prixFixe);
            unite = line.unite || (line.serviceMode === 'horaire' ? 'h' : 'U');
          } else if (line.type === 'standard') {
            qty = parseNum(line.quantite) || 1;
            pu = parseNum(line.prixManuel);
            unite = line.unite || 'U';
          } else {
            qty = parseNum(line.quantite) || 1;
            pu =
              line.materialMode === 'manuel'
                ? parseNum(line.prixManuel)
                : r2(parseNum(line.prixAchat) * (1 + parseNum(line.margePourcent) / 100));
            unite = line.unite || 'U';
          }
          return { Désignation: line.designation || '—', Unité: unite, Qté: qty, 'PU HT': pu };
        }),
      }));
  }, [categories]);

  // ── Load from localStorage ───────────────────────────────────────────────
  useEffect(() => {
    const savedLogo = localStorage.getItem('logo');
    if (savedLogo) setLogo(savedLogo);
    const savedMentions = localStorage.getItem('mentions');
    if (savedMentions) setMentions(savedMentions);
    const savedSujetTVA = localStorage.getItem('sujetTVA');
    if (savedSujetTVA !== null) setSujetTVA(savedSujetTVA === 'true');
    const savedConditions = localStorage.getItem('conditionsReglement');
    if (savedConditions) setConditionsReglement(savedConditions);
    const savedDuree = localStorage.getItem('dureeValidite');
    if (savedDuree) setDureeValidite(Number(savedDuree));

    // Try new format first (categories_v3), then migrate old flat lines
    const savedCats = localStorage.getItem('categories_v3');
    if (savedCats) {
      try {
        const parsed = JSON.parse(savedCats);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setCategories(parsed);
          return;
        }
      } catch {}
    }
    // Migration from old unifiedLines_v2
    const savedOld = localStorage.getItem('unifiedLines_v2');
    if (savedOld) {
      try {
        const parsed = JSON.parse(savedOld);
        if (Array.isArray(parsed)) setCategories(migrateOldUnifiedLines(parsed));
      } catch {}
    }
  }, []);

  // Persist on change
  useEffect(() => {
    if (logo) localStorage.setItem('logo', logo);
  }, [logo]);
  useEffect(() => {
    localStorage.setItem('mentions', mentions);
  }, [mentions]);
  useEffect(() => {
    localStorage.setItem('sujetTVA', String(sujetTVA));
  }, [sujetTVA]);
  useEffect(() => {
    localStorage.setItem('conditionsReglement', conditionsReglement);
  }, [conditionsReglement]);
  useEffect(() => {
    localStorage.setItem('dureeValidite', String(dureeValidite));
  }, [dureeValidite]);
  useEffect(() => {
    localStorage.setItem('categories_v3', JSON.stringify(categories));
  }, [categories]);

  // ── Load from pendingDevis (historique) ──────────────────────────────────
  useEffect(() => {
    if (pendingDevis) {
      const data = pendingDevis.data;
      try {
        setTitre(data.titre || '');
        setIntro(data.intro || '');
        setConclusion(data.conclusion || '');
        setMentions(data.mentions || '');
        setEmetteur(data.emetteur || { nom: '', adresse: '', siret: '', email: '', tel: '' });
        setTvaTaux(data.tvaTaux ?? 20);
        setRemisePourcent(data.remisePourcent ?? 0);
        setAcomptePourcent(data.acomptePourcent ?? 30);
        setRecepteur(data.recepteur || { nom: '', adresse: '', email: '', tel: '' });
        if (data.sujetTVA !== undefined) setSujetTVA(data.sujetTVA);
        if (data.dureeValidite !== undefined) setDureeValidite(data.dureeValidite);
        if (data.conditionsReglement !== undefined)
          setConditionsReglement(data.conditionsReglement);
        if (pendingDevis.locked) setStatut('finalise');
        setQuoteId(pendingDevis.quoteId);

        // Try new categories_v3 format first
        if (data.categories && Array.isArray(data.categories)) {
          setCategories(data.categories);
        } else {
          // Migrate legacy lignesMainOeuvre + lignesPieces
          const moLines = (data.lignesMainOeuvre || []).map(
            (l: any): UnifiedLine => ({
              id: l.id || crypto.randomUUID(),
              type: 'service',
              designation: l.designation || '',
              serviceMode: l.mode || 'fixe',
              prixHoraire: parseNum(l.prixHoraire),
              heures: parseNum(l.heures) || 1,
              prixFixe: parseNum(l.prixFixe),
              unite: l.unite || 'U',
              prixAchat: 0,
              margePourcent: 0,
              quantite: 1,
              prixManuel: 0,
              materialMode: 'calculé',
              tvaTaux: l.tvaTaux,
            })
          );
          const pieceLines = (data.lignesPieces || []).map(
            (l: any): UnifiedLine => ({
              id: l.id || crypto.randomUUID(),
              type: 'material',
              designation: l.designation || '',
              materialMode: l.mode || 'calculé',
              prixAchat: parseNum(l.prixAchat),
              margePourcent: parseNum(l.margePourcent),
              quantite: parseNum(l.quantite) || 1,
              prixManuel: parseNum(l.prixManuel),
              unite: l.unite || '',
              serviceMode: 'fixe',
              prixHoraire: 0,
              heures: 1,
              prixFixe: 0,
              tvaTaux: l.tvaTaux,
            })
          );
          const newCats: Category[] = [];
          if (moLines.length > 0)
            newCats.push({ ...makeCategory("Main d'œuvre", 'service'), lines: moLines });
          if (pieceLines.length > 0)
            newCats.push({ ...makeCategory('Matériaux', 'material'), lines: pieceLines });
          if (newCats.length > 0) setCategories(newCats);
        }
      } catch (err) {
        console.error('Erreur chargement devis :', err);
      } finally {
        setPendingDevis(null);
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch clients ────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchClients = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('clients')
        .select('id, name, address, email, phone')
        .eq('user_id', user.id)
        .order('name', { ascending: true });
      if (data) setClientsList(data);
    };
    fetchClients();
  }, []);

  // ── Logo upload ──────────────────────────────────────────────────────────
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setLogo(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  // ── Save to Supabase ─────────────────────────────────────────────────────
  const saveQuote = async (opts: {
    numero: string;
    statutFinal: 'brouillon' | 'finalise';
    finaliseAt: string | null;
    ht: number;
    ttc: number;
  }): Promise<string | null> => {
    if (!userId) return null;
    setSavingQuote(true);
    const supabase = createClient();
    const payload = {
      user_id: userId,
      quote_number: opts.numero,
      status: opts.statutFinal === 'finalise' ? 'finalized' : 'draft',
      total_ht: Math.round(opts.ht * 100) / 100,
      total_ttc: Math.round(opts.ttc * 100) / 100,
      client_id: clientId || null,
      content_json: {
        titre,
        intro,
        conclusion,
        mentions,
        emetteur,
        recepteur,
        categories,
        // Legacy fields for backward compat
        lignesMainOeuvre,
        lignesPieces,
        tvaTaux,
        remisePourcent,
        acomptePourcent,
        sujetTVA,
        dureeValidite,
        conditionsReglement,
        finalized_at: opts.finaliseAt,
      },
    };
    try {
      let id = quoteId;
      if (id) {
        const { error } = await supabase.from('quotes').update(payload).eq('id', id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('quotes').insert(payload).select('id').single();
        if (error) throw error;
        id = data.id;
        setQuoteId(id);
      }
      return id;
    } catch (err) {
      console.error('saveQuote error', err);
      return null;
    } finally {
      setSavingQuote(false);
    }
  };

  const handleSaveDraft = async () => {
    const num = numeroDevis || previsualiserNumeroDevis();
    if (!numeroDevis) setNumeroDevis(num);
    const saved = await saveQuote({
      numero: num,
      statutFinal: 'brouillon',
      finaliseAt: null,
      ht: totalHT,
      ttc: totalTTC,
    });
    if (saved) toast.success('Brouillon enregistré.');
    else if (userId) toast.error('Sauvegarde cloud échouée.');
    else toast.info('Connectez-vous pour sauvegarder dans le cloud.');
  };

  const handleExport = async () => {
    setExportEnCours(true);
    try {
      if (!recepteur.nom.trim()) {
        toast.error('Merci de renseigner le nom du client.');
        return;
      }
      const hasLines = allLines.length > 0;
      if (!hasLines) {
        toast.error("Ajoutez au moins une ligne avant d'exporter.");
        return;
      }
      const el = document.getElementById('devis-final') as HTMLElement;
      if (!el) {
        toast.error('Aperçu introuvable, rechargez la page.');
        return;
      }
      await exporterPDF(el);
      toast.success('Devis exporté avec succès !');
    } catch {
      toast.error("Erreur lors de l'export. Réessayez.");
    } finally {
      setExportEnCours(false);
    }
  };

  const handleFinaliser = async () => {
    askConfirm(
      'Finaliser ce devis ? Il deviendra en lecture seule et recevra un numéro définitif.',
      async () => {
        const supabase = createClient();
        const num = userId ? await genererNumeroDevisSupabase(supabase) : genererNumeroDevis();
        const now = new Date().toISOString();
        setNumeroDevis(num);
        setStatut('finalise');
        setDateFinalisation(now);
        await saveQuote({
          numero: num,
          statutFinal: 'finalise',
          finaliseAt: now,
          ht: totalHT,
          ttc: totalTTC,
        });
        toast.success(`Devis finalisé — N° ${num}`);
      }
    );
  };

  // ── Preview props ────────────────────────────────────────────────────────
  const previewProps = {
    logo,
    hauteurLogo,
    numeroDevis,
    emetteur,
    recepteur,
    titre,
    intro,
    lignesMainOeuvre,
    lignesPieces,
    // Always use categorized display in preview
    afficherMainOeuvre: false,
    afficherPieces: false,
    nomMainOeuvre: "Main d'œuvre",
    nomPieces: 'Matériaux',
    categoriesDynamiques: previewCategoriesDynamiques,
    totalHTBrut,
    remise,
    remisePourcent,
    totalHT,
    tvaTaux,
    tva,
    totalTTC,
    acompte,
    acomptePourcent,
    mentions,
    conclusion,
    signatureClient,
    signatureEmetteur,
    iban,
    bic,
    profilArtisan,
    sujetTVA,
    dureeValidite,
    conditionsReglement,
    statut,
    dateFinalisation,
    groupesTVA,
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      {confirmState && (
        <ConfirmDialog
          message={confirmState.message}
          onConfirm={() => {
            confirmState.onConfirm();
            setConfirmState(null);
          }}
          onCancel={() => setConfirmState(null)}
        />
      )}

      {/* Emetteur modal */}
      {showEmetteurModal && (
        <Modal title="Informations de l'émetteur" onClose={() => setShowEmetteurModal(false)}>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              {logo ? (
                <div className="flex flex-col gap-2 flex-1">
                  <img
                    src={logo}
                    alt="Logo"
                    style={{ height: '60px', objectFit: 'contain', maxWidth: '150px' }}
                  />
                  <input
                    type="range"
                    min="40"
                    max="160"
                    value={hauteurLogo}
                    onChange={e => setHauteurLogo(Number(e.target.value))}
                    className="form-input"
                  />
                  <button
                    onClick={() => {
                      setLogo(null);
                      localStorage.removeItem('logo');
                    }}
                    className="text-xs underline"
                    style={{ color: 'var(--danger)' }}
                  >
                    Supprimer le logo
                  </button>
                </div>
              ) : (
                <label
                  htmlFor="logo-upload"
                  className="flex items-center gap-2 cursor-pointer text-sm font-medium py-2 px-4 rounded-lg"
                  style={{
                    backgroundColor: 'var(--accent-light)',
                    color: 'var(--accent)',
                    border: '1px solid var(--accent-mid)',
                  }}
                >
                  <ImageIcon size={14} /> Ajouter un logo
                  <input
                    id="logo-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoUpload}
                  />
                </label>
              )}
            </div>
            <div className="h-px" style={{ backgroundColor: 'var(--border)' }} />
            <div>
              <label className="form-label">Nom de l'entreprise</label>
              <input
                className="form-input"
                placeholder="Ex : Dupont Plomberie"
                value={emetteur.nom}
                onChange={e => setEmetteur({ ...emetteur, nom: e.target.value })}
              />
            </div>
            <div>
              <label className="form-label">Adresse</label>
              <textarea
                className="form-input"
                rows={2}
                placeholder="12 rue des Lilas, 75000 Paris"
                value={emetteur.adresse || ''}
                onChange={e => setEmetteur({ ...emetteur, adresse: e.target.value })}
              />
            </div>
            <div>
              <label className="form-label">SIRET</label>
              <input
                className="form-input"
                placeholder="123 456 789 00010"
                value={emetteur.siret || ''}
                onChange={e => setEmetteur({ ...emetteur, siret: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">Email</label>
                <input
                  className="form-input"
                  type="email"
                  placeholder="contact@entreprise.fr"
                  value={emetteur.email || ''}
                  onChange={e => setEmetteur({ ...emetteur, email: e.target.value })}
                />
              </div>
              <div>
                <label className="form-label">Téléphone</label>
                <input
                  className="form-input"
                  type="tel"
                  placeholder="01 23 45 67 89"
                  value={emetteur.tel || ''}
                  onChange={e => setEmetteur({ ...emetteur, tel: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">IBAN</label>
                <input
                  className="form-input"
                  placeholder="FR76…"
                  value={iban}
                  onChange={e => setIban(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label">BIC</label>
                <input
                  className="form-input"
                  placeholder="AGRIFRPP"
                  value={bic}
                  onChange={e => setBic(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                onClick={async () => {
                  const ok = await saveProfile(emetteur, profilArtisan, iban, bic);
                  if (ok) {
                    toast.success('Profil sauvegardé.');
                    setShowEmetteurModal(false);
                  } else toast.error('Erreur lors de la sauvegarde.');
                }}
                variant="primary"
                size="sm"
                disabled={profileSaving}
              >
                {profileSaving ? 'Enregistrement…' : 'Sauvegarder'}
              </Button>
              <Button onClick={() => setShowEmetteurModal(false)} variant="ghost" size="sm">
                Fermer
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Client modal */}
      {showClientModal && (
        <Modal title="Informations du client" onClose={() => setShowClientModal(false)}>
          <div className="flex flex-col gap-3">
            {clientsList.length > 0 && (
              <>
                <div>
                  <label className="form-label">Sélectionner un client existant</label>
                  <select
                    className="form-input"
                    defaultValue=""
                    onChange={e => {
                      const found = clientsList.find(c => c.id === e.target.value);
                      if (found) {
                        setRecepteur({
                          nom: found.name,
                          adresse: found.address,
                          email: found.email,
                          tel: found.phone,
                        });
                        setClientId(found.id);
                      }
                    }}
                  >
                    <option value="" disabled>
                      Choisir un client…
                    </option>
                    {clientsList.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                        {c.email ? ` — ${c.email}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border)' }} />
                  <span className="text-xs" style={{ color: 'var(--fg-subtle)' }}>
                    ou saisir manuellement
                  </span>
                  <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border)' }} />
                </div>
              </>
            )}
            <div>
              <label className="form-label">Nom du client</label>
              <input
                className="form-input"
                type="text"
                placeholder="Jean Dupont"
                value={recepteur.nom}
                onChange={e => setRecepteur({ ...recepteur, nom: e.target.value })}
              />
            </div>
            <div>
              <label className="form-label">Adresse</label>
              <textarea
                className="form-input"
                rows={2}
                placeholder="7 avenue de la République, 75011 Paris"
                value={recepteur.adresse || ''}
                onChange={e => setRecepteur({ ...recepteur, adresse: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">Email</label>
                <input
                  className="form-input"
                  type="email"
                  placeholder="jean@dupont.fr"
                  value={recepteur.email || ''}
                  onChange={e => setRecepteur({ ...recepteur, email: e.target.value })}
                />
              </div>
              <div>
                <label className="form-label">Téléphone</label>
                <input
                  className="form-input"
                  type="tel"
                  placeholder="06 78 90 12 34"
                  value={recepteur.tel || ''}
                  onChange={e => setRecepteur({ ...recepteur, tel: e.target.value })}
                />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                onClick={async () => {
                  try {
                    if (!recepteur.nom.trim() || !recepteur.email.trim()) {
                      toast.error('Nom et email requis.');
                      return;
                    }
                    const supabase = createClient();
                    const {
                      data: { user },
                    } = await supabase.auth.getUser();
                    if (!user) {
                      toast.error('Vous devez être connecté.');
                      return;
                    }
                    const existant = clientsList.find(
                      c =>
                        c.name.trim() === recepteur.nom.trim() &&
                        c.email.trim() === recepteur.email.trim()
                    );
                    if (existant) {
                      toast.info('Ce client est déjà enregistré.');
                      return;
                    }
                    const { data, error } = await supabase
                      .from('clients')
                      .insert({
                        name: recepteur.nom,
                        address: recepteur.adresse,
                        email: recepteur.email,
                        phone: recepteur.tel,
                        user_id: user.id,
                      })
                      .select()
                      .single();
                    if (error) toast.error("Erreur lors de l'enregistrement.");
                    else if (data) {
                      setClientsList(prev =>
                        [...prev, data].sort((a, b) => a.name.localeCompare(b.name))
                      );
                      toast.success('Client enregistré.');
                    }
                  } catch {
                    toast.error("Erreur lors de l'enregistrement.");
                  }
                }}
                variant="ghost"
                size="sm"
              >
                Enregistrer le client
              </Button>
              <Button onClick={() => setShowClientModal(false)} variant="primary" size="sm">
                Valider
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* PDF Preview (mobile) */}
      {showPDFMobile && (
        <div
          className="fixed inset-0 overflow-auto z-40 p-4 lg:hidden"
          style={{ backgroundColor: 'var(--bg)' }}
        >
          <div className="flex justify-end mb-4">
            <Button onClick={() => setShowPDFMobile(false)} variant="primary" size="sm">
              Fermer l'aperçu
            </Button>
          </div>
          <div className="overflow-x-auto">
            <PreviewDevis {...previewProps} />
          </div>
        </div>
      )}

      {/* Main layout */}
      <main className="min-h-screen p-4 sm:p-6 lg:p-8 font-sans">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-full sm:max-w-screen-md lg:max-w-screen-xl mx-auto">
          {/* Left column: Editor */}
          <div className="flex flex-col gap-4">
            <StickyBar
              totalHT={totalHT}
              tva={tva}
              totalTTC={totalTTC}
              sujetTVA={sujetTVA}
              tvaTaux={tvaTaux}
              savingQuote={savingQuote}
              exportEnCours={exportEnCours}
              statut={statut}
              onSaveDraft={handleSaveDraft}
              onExport={handleExport}
            />

            <DocumentHeader
              logo={logo}
              hauteurLogo={hauteurLogo}
              emetteur={emetteur}
              recepteur={recepteur}
              numeroDevis={numeroDevis}
              titre={titre}
              statut={statut}
              onClickEmetteur={() => setShowEmetteurModal(true)}
              onClickClient={() => setShowClientModal(true)}
              onClickLogo={() => setShowEmetteurModal(true)}
            />

            {/* Title & number */}
            <div className="card flex flex-col gap-3" style={{ padding: '16px' }}>
              <div className="flex items-center gap-3">
                <input
                  className="form-input flex-1"
                  placeholder="Titre du devis"
                  value={titre}
                  readOnly={statut === 'finalise'}
                  onChange={e => setTitre(e.target.value)}
                />
                <div className="flex items-center gap-2 flex-shrink-0">
                  <input
                    className="form-input"
                    style={{ width: '120px' }}
                    placeholder="N° devis"
                    value={numeroDevis}
                    readOnly={statut === 'finalise'}
                    onChange={e => setNumeroDevis(e.target.value)}
                  />
                  {statut === 'brouillon' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setNumeroDevis(previsualiserNumeroDevis())}
                    >
                      Générer
                    </Button>
                  )}
                </div>
              </div>

              {statut === 'brouillon' ? (
                <Button
                  variant="primary"
                  size="sm"
                  icon={<BadgeCheck size={14} />}
                  disabled={savingQuote}
                  onClick={handleFinaliser}
                >
                  {savingQuote ? 'Enregistrement…' : 'Finaliser le devis'}
                </Button>
              ) : (
                <div
                  className="flex items-center gap-2 p-3 rounded-lg"
                  style={{ border: '1px solid var(--border)', backgroundColor: 'var(--surface-2)' }}
                >
                  <Lock size={14} style={{ color: 'var(--fg-muted)', flexShrink: 0 }} />
                  <div className="flex-1">
                    <p className="text-sm font-semibold" style={{ color: 'var(--fg)' }}>
                      Devis finalisé
                    </p>
                    <p className="text-xs" style={{ color: 'var(--fg-muted)' }}>
                      {dateFinalisation
                        ? new Date(dateFinalisation).toLocaleDateString('fr-FR')
                        : ''}{' '}
                      — lecture seule
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() =>
                      askConfirm('Repasser ce devis en brouillon ?', () => {
                        setStatut('brouillon');
                        setDateFinalisation(null);
                        toast.info('Repassé en brouillon.');
                      })
                    }
                  >
                    Débloquer
                  </Button>
                </div>
              )}
            </div>

            {/* Category editor */}
            <div
              className="rounded-xl"
              style={{
                border: '1px solid var(--border)',
                backgroundColor: 'var(--surface)',
                padding: '16px',
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold" style={{ color: 'var(--fg)' }}>
                  Lignes du devis
                </h2>
                {allLines.length > 0 && (
                  <span className="text-xs" style={{ color: 'var(--fg-subtle)' }}>
                    {allLines.length} ligne{allLines.length > 1 ? 's' : ''} · {categories.length}{' '}
                    catégorie{categories.length > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <CategoryEditor
                categories={categories}
                setCategories={setCategories}
                globalTvaTaux={tvaTaux}
                isLocked={statut === 'finalise'}
              />
            </div>

            {/* Intro / Conclusion */}
            <Accordion title="Introduction & conclusion" icon={<AlignLeft size={14} />}>
              <div>
                <label className="form-label">Introduction (facultatif)</label>
                <textarea
                  className="form-input"
                  rows={3}
                  placeholder="Merci pour votre confiance, voici notre proposition…"
                  value={intro}
                  onChange={e => setIntro(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label">Remarques complémentaires (facultatif)</label>
                <textarea
                  className="form-input"
                  rows={3}
                  placeholder="N'hésitez pas à nous contacter pour toute question."
                  value={conclusion}
                  onChange={e => setConclusion(e.target.value)}
                />
              </div>
            </Accordion>

            {/* Fiscal & mentions */}
            <Accordion title="Fiscal & mentions" icon={<Scale size={14} />}>
              <div
                className="flex items-center justify-between p-3 rounded-lg"
                style={{ border: '1px solid var(--border)', backgroundColor: 'var(--surface-2)' }}
              >
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--fg)' }}>
                    Assujetti à la TVA
                  </p>
                  <p className="text-xs" style={{ color: 'var(--fg-muted)' }}>
                    {sujetTVA ? 'TVA calculée et affichée.' : 'Mention légale : art. 293 B du CGI'}
                  </p>
                </div>
                <div
                  className={`toggle-track${sujetTVA ? ' on' : ''}`}
                  onClick={() => setSujetTVA(!sujetTVA)}
                >
                  <div className="toggle-thumb" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="field-group">
                  <label className="form-label">TVA (%)</label>
                  <input
                    type="number"
                    onWheel={e => e.currentTarget.blur()}
                    className="form-input"
                    disabled={!sujetTVA}
                    style={{ opacity: sujetTVA ? 1 : 0.4 }}
                    value={tvaTaux}
                    onChange={e => setTvaTaux(Math.max(0, parseNum(e.target.value)))}
                  />
                </div>
                <div className="field-group">
                  <label className="form-label">Remise (%)</label>
                  <input
                    type="number"
                    onWheel={e => e.currentTarget.blur()}
                    className="form-input"
                    value={remisePourcent}
                    onChange={e => setRemisePourcent(Math.max(0, parseNum(e.target.value)))}
                  />
                </div>
                <div className="field-group">
                  <label className="form-label">Acompte (%)</label>
                  <input
                    type="number"
                    onWheel={e => e.currentTarget.blur()}
                    className="form-input"
                    value={acomptePourcent}
                    onChange={e => setAcomptePourcent(Math.max(0, parseNum(e.target.value)))}
                  />
                </div>
              </div>
              <div>
                <label className="form-label">Mentions légales</label>
                <textarea
                  className="form-input"
                  rows={3}
                  placeholder="Devis valable 30 jours…"
                  value={mentions}
                  onChange={e => setMentions(e.target.value)}
                />
              </div>
            </Accordion>

            {/* Conditions commerciales */}
            <Accordion title="Conditions commerciales" icon={<CalendarClock size={14} />}>
              <div className="grid grid-cols-2 gap-4">
                <div className="field-group">
                  <label className="form-label">Validité (jours)</label>
                  <input
                    type="number"
                    onWheel={e => e.currentTarget.blur()}
                    className="form-input"
                    min={1}
                    max={365}
                    value={dureeValidite}
                    onChange={e => setDureeValidite(Math.max(1, parseInt(e.target.value) || 30))}
                  />
                </div>
              </div>
              <div className="field-group">
                <label className="form-label">Conditions de règlement</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {[
                    '30 % à la signature, solde à réception.',
                    'Paiement comptant à la livraison.',
                    '50 % à la commande, 50 % à la réception.',
                  ].map(preset => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setConditionsReglement(preset)}
                      className="text-xs px-2 py-1 rounded-md transition-all"
                      style={{
                        border: '1px solid var(--border)',
                        backgroundColor:
                          conditionsReglement === preset
                            ? 'var(--accent-light)'
                            : 'var(--surface-2)',
                        color: conditionsReglement === preset ? 'var(--accent)' : 'var(--fg-muted)',
                        cursor: 'pointer',
                      }}
                    >
                      {preset.length > 28 ? preset.slice(0, 28) + '…' : preset}
                    </button>
                  ))}
                </div>
                <textarea
                  className="form-input"
                  rows={2}
                  value={conditionsReglement}
                  onChange={e => setConditionsReglement(e.target.value)}
                />
              </div>
            </Accordion>

            {/* Signature */}
            <Accordion title="Signature numérique" icon={<PenLine size={14} />}>
              <SignatureBlock
                label="Signature de l'émetteur"
                value={signatureEmetteur}
                onChange={setSignatureEmetteur}
              />
            </Accordion>

            {/* Navigation */}
            <div className="flex items-center justify-between pt-2 pb-4">
              <Link href="/historique">
                <Button variant="ghost" size="sm">
                  Historique des devis
                </Button>
              </Link>
            </div>
          </div>

          {/* Right column: PDF preview (desktop) */}
          <div className="hidden lg:block">
            <div className="mx-auto w-[794px] sticky top-8">
              <p
                className="text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-1.5"
                style={{ color: 'var(--fg-subtle)' }}
              >
                <FileText size={12} />
                Aperçu du document
              </p>
              <PreviewDevis {...previewProps} />
            </div>
          </div>
        </div>

        {/* Mobile PDF toggle */}
        <div className="fixed bottom-4 right-4 z-50 lg:hidden">
          <Button onClick={() => setShowPDFMobile(prev => !prev)} variant="primary" size="sm">
            {showPDFMobile ? 'Fermer PDF' : "Voir l'aperçu PDF"}
          </Button>
        </div>
      </main>
    </>
  );
}
