'use client';

import { useState, useEffect } from 'react';
import Button from '@/components/ui/bouton';
import { X, Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/context/ToastContext';

interface ColonneCategorie {
  nom: string;
  type: 'texte' | 'quantite' | 'prix' | 'prixAvecMarge';
}

interface Props {
  mode: 'creation' | 'edition';
  initialCategorie?: {
    nom: string;
    colonnes: ColonneCategorie[];
  };
  onClose: () => void;
  onCreate: (categorie: {
    nom: string;
    colonnes: ColonneCategorie[];
    lignes: any[];
    afficher: boolean;
  }) => void;
}

export default function ModalNouvelleCategorie({ mode, initialCategorie, onClose, onCreate }: Props) {
  const { toast } = useToast();
  const [nom, setNom] = useState('');
  const [colonnes, setColonnes] = useState<ColonneCategorie[]>([]);

  useEffect(() => {
    if (mode === 'edition' && initialCategorie) {
      setNom(initialCategorie.nom);
      setColonnes(initialCategorie.colonnes);
    } else {
      setNom('');
      setColonnes([
        { nom: 'Désignation', type: 'texte' },
        { nom: 'Unité', type: 'texte' },
        { nom: 'Qté', type: 'quantite' },
        { nom: 'PU HT (€)', type: 'prix' },
      ]);
    }
  }, [mode, initialCategorie]);

  const ajouterColonne = () => setColonnes([...colonnes, { nom: '', type: 'texte' }]);

  const modifierColonne = (index: number, key: keyof ColonneCategorie, value: string) => {
    const copie = [...colonnes];
    copie[index][key] = value as any;
    setColonnes(copie);
  };

  const supprimerColonne = (index: number) => {
    const copie = [...colonnes];
    copie.splice(index, 1);
    setColonnes(copie);
  };

  const valider = () => {
    if (!nom.trim()) {
      toast.error('Merci de renseigner un nom de catégorie.');
      return;
    }
    const colonnesValides = colonnes.filter(c => c.nom.trim() !== '');
    if (colonnesValides.length === 0) {
      toast.error("Merci d'ajouter au moins une colonne.");
      return;
    }
    onCreate({ nom: nom.trim(), colonnes: colonnesValides, lignes: [], afficher: true });
    onClose();
  };

  const typeLabels: Record<string, string> = {
    texte: 'Texte',
    quantite: 'Quantité',
    prix: 'Prix',
    prixAvecMarge: 'Prix avec marge',
  };

  return (
    <div
      className="fixed inset-0 flex justify-center items-center z-50"
      style={{ backgroundColor: 'rgb(0 0 0 / 0.5)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className="w-full mx-4"
        style={{
          maxWidth: '560px',
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '1rem',
          boxShadow: '0 24px 48px rgb(0 0 0 / 0.18)',
          padding: '1.5rem',
        }}
      >
        {/* Header */}
        <div className="flex justify-between items-start mb-5">
          <div>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--fg)' }}>
              {mode === 'creation' ? 'Nouvelle catégorie' : 'Modifier la catégorie'}
            </h2>
            <p className="text-sm mt-0.5" style={{ color: 'var(--fg-muted)' }}>
              {mode === 'creation'
                ? 'Définissez un nom et les colonnes de votre tableau.'
                : 'Modifiez la structure de la catégorie.'}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--surface-2)',
              color: 'var(--fg-muted)',
              cursor: 'pointer',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Nom */}
        <div className="mb-5">
          <label className="form-label">Nom de la catégorie</label>
          <input
            type="text"
            value={nom}
            onChange={e => setNom(e.target.value)}
            className="form-input"
            placeholder="Ex : Location, Transport, Nettoyage…"
          />
        </div>

        {/* Colonnes */}
        <div className="mb-5">
          <label className="form-label">Colonnes du tableau</label>
          <div className="flex flex-col gap-2">
            {colonnes.map((col, index) => (
              <div key={index} className="flex gap-2 items-center">
                <input
                  type="text"
                  value={col.nom}
                  onChange={e => modifierColonne(index, 'nom', e.target.value)}
                  className="form-input flex-1"
                  placeholder={`Colonne ${index + 1}`}
                />
                <select
                  value={col.type}
                  onChange={e => modifierColonne(index, 'type', e.target.value)}
                  className="form-select"
                  style={{ width: '160px', flexShrink: 0 }}
                >
                  {Object.entries(typeLabels).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
                <button
                  onClick={() => supprimerColonne(index)}
                  title="Supprimer cette colonne"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    backgroundColor: 'var(--surface-2)',
                    color: 'var(--fg-muted)',
                    cursor: 'pointer',
                    flexShrink: 0,
                    transition: 'all 0.15s ease',
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
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={ajouterColonne}
            className="inline-flex items-center gap-1.5 text-sm font-medium rounded-lg px-3 py-1.5 mt-3 transition-all duration-150"
            style={{
              border: '1.5px dashed var(--border-strong)',
              color: 'var(--fg-muted)',
              backgroundColor: 'transparent',
              cursor: 'pointer',
            }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLElement;
              el.style.borderColor = 'var(--accent)';
              el.style.color = 'var(--accent)';
              el.style.backgroundColor = 'var(--accent-light)';
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLElement;
              el.style.borderColor = 'var(--border-strong)';
              el.style.color = 'var(--fg-muted)';
              el.style.backgroundColor = 'transparent';
            }}
          >
            <Plus size={14} />
            Ajouter une colonne
          </button>
        </div>

        {/* Footer */}
        <div
          className="flex justify-end gap-3 pt-4"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          <Button onClick={onClose} variant="ghost" size="md">
            Annuler
          </Button>
          <Button onClick={valider} variant="primary" size="md">
            {mode === 'creation' ? 'Créer la catégorie' : 'Enregistrer'}
          </Button>
        </div>
      </div>
    </div>
  );
}
