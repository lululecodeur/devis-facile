import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2, Bookmark } from 'lucide-react';

export interface LignePiece {
  id: string;
  designation: string;
  unite: string;
  prixAchat: number | string;
  margePourcent: number | string;
  quantite: number | string;
  prixManuel?: number | string;
  mode: 'calculé' | 'manuel';
  tvaTaux?: number;   // per-line override; falls back to global rate when undefined
}

const TVA_OPTIONS = [
  { label: '0 %',    value: 0   },
  { label: '5,5 %',  value: 5.5 },
  { label: '10 %',   value: 10  },
  { label: '20 %',   value: 20  },
];

export default function LigneDraggablePiece({
  ligne,
  modifierLigne,
  supprimerLigne,
  sauvegarderLigne,
  globalTvaTaux = 20,
  autoFocus = false,
  onEnterLastField,
}: {
  ligne: LignePiece;
  modifierLigne: (id: string, champ: keyof LignePiece, valeur: string | number) => void;
  supprimerLigne: (id: string) => void;
  sauvegarderLigne: () => void;
  globalTvaTaux?: number;
  autoFocus?: boolean;
  onEnterLastField?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: ligne.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  const afficherValeur = (val: string | number | undefined) => {
    if (val === '' || val === 0 || val === undefined || val === null) return '';
    return typeof val === 'string' ? val.replace('.', ',') : val.toString().replace('.', ',');
  };

  // Numeric field handlers
  const handleNumericChange = (champ: keyof LignePiece) => (e: React.ChangeEvent<HTMLInputElement>) => {
    modifierLigne(ligne.id, champ, e.target.value.replace(',', '.'));
  };

  const handleNumericBlur = (champ: keyof LignePiece, val: string | number | undefined) => {
    const n = parseFloat(String(val ?? '').replace(',', '.'));
    if (!isNaN(n)) modifierLigne(ligne.id, champ, n.toFixed(2));
  };

  const handleEnterKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); onEnterLastField?.(); }
  };

  const tvaEffective = ligne.tvaTaux ?? globalTvaTaux;
  const isCustomTva = ligne.tvaTaux !== undefined && ligne.tvaTaux !== globalTvaTaux;

  const iconBtn = (
    onClick: () => void,
    icon: React.ReactNode,
    hoverBg: string,
    hoverColor: string,
    hoverBorder: string,
    title: string
  ) => (
    <button
      onClick={onClick}
      title={title}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: '30px', height: '30px', borderRadius: '6px',
        border: '1px solid var(--border)', backgroundColor: 'var(--surface-2)',
        color: 'var(--fg-muted)', cursor: 'pointer', transition: 'all 0.15s ease',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.backgroundColor = hoverBg;
        el.style.color = hoverColor;
        el.style.borderColor = hoverBorder;
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.backgroundColor = 'var(--surface-2)';
        el.style.color = 'var(--fg-muted)';
        el.style.borderColor = 'var(--border)';
      }}
    >
      {icon}
    </button>
  );

  return (
    <tr
      ref={setNodeRef}
      style={{ ...style, backgroundColor: 'var(--surface)' }}
      className="group"
    >
      {/* Drag */}
      <td
        style={{ width: '28px', padding: '0.5rem 0.25rem 0.5rem 0.5rem', color: 'var(--fg-subtle)', cursor: 'grab' }}
        {...attributes}
        {...listeners}
      >
        <GripVertical size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
      </td>

      {/* Désignation */}
      <td style={{ padding: '0.375rem 0.5rem' }}>
        <input
          type="text"
          className="table-input"
          value={ligne.designation}
          onChange={e => modifierLigne(ligne.id, 'designation', e.target.value)}
          placeholder="Désignation"
          autoFocus={autoFocus}
        />
      </td>

      {/* Unité */}
      <td style={{ padding: '0.375rem 0.5rem', width: '70px' }}>
        <input
          type="text"
          className="table-input"
          placeholder="u, kg…"
          value={ligne.unite || ''}
          onChange={e => modifierLigne(ligne.id, 'unite', e.target.value)}
        />
      </td>

      {/* Prix achat */}
      <td style={{ padding: '0.375rem 0.5rem', width: '90px' }}>
        <input
          type="text"
          inputMode="decimal"
          className="table-input"
          style={{ opacity: ligne.mode === 'manuel' ? 0.35 : 1 }}
          value={afficherValeur(ligne.prixAchat)}
          onChange={handleNumericChange('prixAchat')}
          onBlur={() => handleNumericBlur('prixAchat', ligne.prixAchat)}
          disabled={ligne.mode === 'manuel'}
          placeholder="50"
        />
      </td>

      {/* Marge */}
      <td style={{ padding: '0.375rem 0.5rem', width: '70px' }}>
        <input
          type="text"
          inputMode="decimal"
          className="table-input"
          style={{ opacity: ligne.mode === 'manuel' ? 0.35 : 1 }}
          value={afficherValeur(ligne.margePourcent)}
          onChange={handleNumericChange('margePourcent')}
          onBlur={() => handleNumericBlur('margePourcent', ligne.margePourcent)}
          disabled={ligne.mode === 'manuel'}
          placeholder="10"
        />
      </td>

      {/* Quantité */}
      <td style={{ padding: '0.375rem 0.5rem', width: '70px' }}>
        <input
          type="text"
          inputMode="decimal"
          className="table-input"
          value={afficherValeur(ligne.quantite)}
          onChange={handleNumericChange('quantite')}
          onBlur={() => handleNumericBlur('quantite', ligne.quantite)}
          placeholder="1"
        />
      </td>

      {/* Mode toggle */}
      <td style={{ padding: '0.375rem 0.5rem', width: '130px' }}>
        <div className="segment-control">
          <button
            type="button"
            onClick={() => modifierLigne(ligne.id, 'mode', 'calculé')}
            className={`segment-btn${ligne.mode === 'calculé' ? ' active' : ''}`}
          >
            Marge
          </button>
          <button
            type="button"
            onClick={() => modifierLigne(ligne.id, 'mode', 'manuel')}
            className={`segment-btn${ligne.mode === 'manuel' ? ' active' : ''}`}
          >
            Fixe
          </button>
        </div>
      </td>

      {/* Prix manuel */}
      <td style={{ padding: '0.375rem 0.5rem', width: '90px' }}>
        <input
          type="text"
          inputMode="decimal"
          className="table-input"
          style={{ opacity: ligne.mode === 'calculé' ? 0.35 : 1 }}
          value={ligne.prixManuel !== undefined && ligne.prixManuel !== 0
            ? String(ligne.prixManuel).replace('.', ',')
            : ''}
          onChange={handleNumericChange('prixManuel')}
          onBlur={() => handleNumericBlur('prixManuel', ligne.prixManuel)}
          disabled={ligne.mode === 'calculé'}
          placeholder="0"
        />
      </td>

      {/* TVA per-line */}
      <td style={{ padding: '0.375rem 0.5rem', width: '88px' }}>
        <select
          className="table-input"
          value={tvaEffective}
          onChange={e => modifierLigne(ligne.id, 'tvaTaux', Number(e.target.value))}
          onKeyDown={handleEnterKey}
          title="Taux de TVA pour cette ligne"
          style={{
            fontSize: '0.75rem',
            fontWeight: isCustomTva ? '700' : '400',
            color: isCustomTva ? 'var(--accent)' : 'var(--fg)',
            cursor: 'pointer',
          }}
        >
          {TVA_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </td>

      {/* Actions */}
      <td style={{ padding: '0.375rem 0.5rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
        <div className="flex items-center justify-center gap-1">
          {iconBtn(
            sauvegarderLigne,
            <Bookmark size={13} />,
            'var(--accent-light)', 'var(--accent)', 'var(--accent)',
            'Enregistrer cette pièce'
          )}
          {iconBtn(
            () => supprimerLigne(ligne.id),
            <Trash2 size={13} />,
            'var(--danger-light)', 'var(--danger)', 'var(--danger)',
            'Supprimer'
          )}
        </div>
      </td>
    </tr>
  );
}
