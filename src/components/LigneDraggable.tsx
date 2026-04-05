import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2, Bookmark } from 'lucide-react';

export interface LigneMainOeuvre {
  id: string;
  designation: string;
  unite: string;
  mode: 'horaire' | 'fixe';
  prixHoraire: number | string;
  heures: number | string;
  prixFixe: number | string;
  tvaTaux?: number;   // per-line override; falls back to global rate when undefined
}

// BTP-standard VAT rates available for selection
const TVA_OPTIONS = [
  { label: '0 %',    value: 0   },
  { label: '5,5 %',  value: 5.5 },
  { label: '10 %',   value: 10  },
  { label: '20 %',   value: 20  },
];

export default function LigneDraggable({
  ligne,
  modifierLigne,
  supprimerLigne,
  sauvegarderLigne,
  globalTvaTaux = 20,
  autoFocus = false,
  onEnterLastField,
}: {
  ligne: LigneMainOeuvre;
  modifierLigne: (id: string, champ: keyof LigneMainOeuvre, valeur: string | number) => void;
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

  const afficherValeur = (val: number | string) => {
    if (val === '' || val === undefined || val === null) return '';
    return val.toString().replace('.', ',');
  };

  // Numeric field handlers
  const handleNumericChange = (champ: keyof LigneMainOeuvre) => (e: React.ChangeEvent<HTMLInputElement>) => {
    // Allow comma as decimal separator — store with dot internally
    modifierLigne(ligne.id, champ, e.target.value.replace(',', '.'));
  };

  const handleNumericBlur = (champ: keyof LigneMainOeuvre, val: string | number) => {
    const n = parseFloat(String(val).replace(',', '.'));
    if (!isNaN(n)) modifierLigne(ligne.id, champ, n.toFixed(2));
  };

  const handleEnterKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); onEnterLastField?.(); }
  };

  // The effective TVA for this line (per-line or fall back to global)
  const tvaEffective = ligne.tvaTaux ?? globalTvaTaux;
  const isCustomTva = ligne.tvaTaux !== undefined && ligne.tvaTaux !== globalTvaTaux;

  return (
    <tr
      ref={setNodeRef}
      style={{
        ...style,
        backgroundColor: 'var(--surface)',
        borderRadius: '0.5rem',
      }}
      className="group"
    >
      {/* Drag handle */}
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
          className="table-input"
          value={ligne.designation}
          onChange={e => modifierLigne(ligne.id, 'designation', e.target.value)}
          placeholder="Désignation"
          autoFocus={autoFocus}
        />
      </td>

      {/* Unité */}
      <td style={{ padding: '0.375rem 0.5rem', width: '80px' }}>
        <input
          type="text"
          className="table-input"
          value={ligne.unite || ''}
          onChange={e => modifierLigne(ligne.id, 'unite', e.target.value)}
          placeholder="h, m²…"
        />
      </td>

      {/* Mode toggle */}
      <td style={{ padding: '0.375rem 0.5rem', width: '140px' }}>
        <div className="segment-control">
          <button
            type="button"
            onClick={() => modifierLigne(ligne.id, 'mode', 'horaire')}
            className={`segment-btn${ligne.mode === 'horaire' ? ' active' : ''}`}
          >
            À l'heure
          </button>
          <button
            type="button"
            onClick={() => modifierLigne(ligne.id, 'mode', 'fixe')}
            className={`segment-btn${ligne.mode === 'fixe' ? ' active' : ''}`}
          >
            Fixe
          </button>
        </div>
      </td>

      {/* Prix horaire */}
      <td style={{ padding: '0.375rem 0.5rem', width: '100px' }}>
        <input
          type="text"
          inputMode="decimal"
          className="table-input"
          style={{ opacity: ligne.mode === 'fixe' ? 0.35 : 1 }}
          value={afficherValeur(ligne.prixHoraire)}
          onChange={handleNumericChange('prixHoraire')}
          onBlur={() => handleNumericBlur('prixHoraire', ligne.prixHoraire)}
          placeholder="0"
        />
      </td>

      {/* Heures */}
      <td style={{ padding: '0.375rem 0.5rem', width: '80px' }}>
        <input
          type="text"
          inputMode="decimal"
          className="table-input"
          style={{ opacity: ligne.mode === 'fixe' ? 0.35 : 1 }}
          value={afficherValeur(ligne.heures)}
          onChange={handleNumericChange('heures')}
          onBlur={() => handleNumericBlur('heures', ligne.heures)}
          placeholder="0"
        />
      </td>

      {/* Prix fixe */}
      <td style={{ padding: '0.375rem 0.5rem', width: '100px' }}>
        <input
          type="text"
          inputMode="decimal"
          className="table-input"
          style={{ opacity: ligne.mode === 'horaire' ? 0.35 : 1 }}
          value={afficherValeur(ligne.prixFixe)}
          onChange={handleNumericChange('prixFixe')}
          onBlur={() => handleNumericBlur('prixFixe', ligne.prixFixe)}
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
          <button
            onClick={sauvegarderLigne}
            title="Enregistrer cette prestation"
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: '30px', height: '30px', borderRadius: '6px',
              border: '1px solid var(--border)', backgroundColor: 'var(--surface-2)',
              color: 'var(--fg-muted)', cursor: 'pointer', transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLElement;
              el.style.backgroundColor = 'var(--accent-light)';
              el.style.color = 'var(--accent)';
              el.style.borderColor = 'var(--accent)';
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLElement;
              el.style.backgroundColor = 'var(--surface-2)';
              el.style.color = 'var(--fg-muted)';
              el.style.borderColor = 'var(--border)';
            }}
          >
            <Bookmark size={13} />
          </button>
          <button
            onClick={() => supprimerLigne(ligne.id)}
            title="Supprimer"
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: '30px', height: '30px', borderRadius: '6px',
              border: '1px solid var(--border)', backgroundColor: 'var(--surface-2)',
              color: 'var(--fg-muted)', cursor: 'pointer', transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLElement;
              el.style.backgroundColor = 'var(--danger-light)';
              el.style.color = 'var(--danger)';
              el.style.borderColor = 'var(--danger)';
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLElement;
              el.style.backgroundColor = 'var(--surface-2)';
              el.style.color = 'var(--fg-muted)';
              el.style.borderColor = 'var(--border)';
            }}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </td>
    </tr>
  );
}
