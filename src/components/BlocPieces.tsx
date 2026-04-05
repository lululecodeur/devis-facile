'use client';
import { useEffect, useState } from 'react';
import Button from '@/components/ui/bouton';
import LigneDraggablePiece from '@/components/LigneDraggablePiece';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { Plus, ChevronUp, Bookmark } from 'lucide-react';
import Aide from '@/components/Aide';
import { useToast } from '@/context/ToastContext';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

interface LignePiece {
  id: string;
  designation: string;
  unite: string;
  prixAchat: number;
  margePourcent: number;
  quantite: number;
  prixManuel?: number;
  mode: 'calculé' | 'manuel';
  tvaTaux?: number;
}

export default function BlocPieces({
  lignes,
  setLignes,
  afficher,
  setAfficher,
  nomCategorie,
  setNomCategorie,
  secteurActif,
  globalTvaTaux = 20,
}: {
  lignes: LignePiece[];
  setLignes: (l: LignePiece[]) => void;
  afficher: boolean;
  setAfficher: (v: boolean) => void;
  nomCategorie: string;
  setNomCategorie: (v: string) => void;
  secteurActif?: string;
  globalTvaTaux?: number;
}) {
  const [prestationsSauvegardees, setPrestationsSauvegardees] = useState<LignePiece[]>([]);
  const [newLineId, setNewLineId] = useState<string | null>(null);
  const { toast } = useToast();
  const [confirmState, setConfirmState] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const askConfirm = (message: string, onConfirm: () => void) => setConfirmState({ message, onConfirm });
  const [replie, setReplie] = useState(!afficher);
  const sensors = useSensors(useSensor(PointerSensor));

  const ajouterLigne = () => {
    const id = crypto.randomUUID();
    setNewLineId(id);
    setLignes([
      ...lignes,
      { id, designation: '', unite: '', prixAchat: 0, margePourcent: 0, quantite: 1, prixManuel: 0, mode: 'calculé' },
    ]);
  };

  const modifierLigne = (id: string, champ: keyof LignePiece, valeur: string | number) => {
    setLignes(
      lignes.map(l => {
        if (l.id !== id) return l;
        let v: string | number = valeur;
        if (typeof valeur === 'string' && /,/.test(valeur)) v = valeur;
        return { ...l, [champ]: v };
      })
    );
  };

  const supprimerLigne = (id: string) => setLignes(lignes.filter(l => l.id !== id));

  const aidePieces = `🔩 Nom de la catégorie
Renommez cette catégorie selon votre activité : Pièces, Matériaux, Fournitures, etc.

💸 Tarification
• Mode calculé : prix d'achat HT + marge (%) → prix final automatique
• Mode manuel : vous saisissez directement un prix de vente HT

🛠️ Gestion des lignes
Cliquez sur l'icône 🔖 pour enregistrer une pièce et la réutiliser dans un autre devis.`;

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 640) setReplie(true);
  }, []);

  const sauvegarderLigne = (ligne: LignePiece) => {
    if (!secteurActif) return;
    const cle = `prestationsPieces_${secteurActif}`;
    const nouvelleListe = [...prestationsSauvegardees.filter(p => p.id !== ligne.id), ligne];
    localStorage.setItem(cle, JSON.stringify(nouvelleListe));
    setPrestationsSauvegardees(nouvelleListe);
    toast.success('Pièce enregistrée.');
  };

  useEffect(() => {
    if (secteurActif) {
      const sauvegardes = localStorage.getItem(`prestationsPieces_${secteurActif}`);
      if (sauvegardes) {
        try {
          const parsed = JSON.parse(sauvegardes);
          if (Array.isArray(parsed)) setPrestationsSauvegardees(parsed);
        } catch {}
      }
      const nomSauvegarde = localStorage.getItem(`nomCategoriePieces_${secteurActif}`);
      if (nomSauvegarde) setNomCategorie(nomSauvegarde);
    }
  }, [secteurActif]);

  useEffect(() => {
    const seen = new Set<string>();
    const lignesCorrigees = lignes.map(l => {
      let id = l.id || crypto.randomUUID();
      while (seen.has(id)) id = crypto.randomUUID();
      seen.add(id);
      return { ...l, id };
    });
    setLignes(lignesCorrigees);
  }, []);

  if (replie) {
    return (
      <div
        className="flex justify-between items-center p-3 rounded-lg"
        style={{ border: '1px solid var(--border)', backgroundColor: 'var(--surface-2)' }}
      >
        <div>
          <span className="font-semibold text-sm" style={{ color: 'var(--fg)' }}>
            {nomCategorie || 'Pièces'}
          </span>
          <p className="text-xs mt-0.5" style={{ color: 'var(--fg-muted)' }}>
            {lignes.length} ligne{lignes.length > 1 ? 's' : ''} —{' '}
            {afficher ? 'visible dans PDF' : 'masqué'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setReplie(false)} variant="ghost" size="xs">
            Afficher
          </Button>
          <Button onClick={() => setAfficher(!afficher)} variant="outline" size="xs">
            {afficher ? 'Retirer du PDF' : 'Inclure dans PDF'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={nomCategorie}
            onChange={e => {
              setNomCategorie(e.target.value);
              localStorage.setItem(`nomCategoriePieces_${secteurActif || 'global'}`, e.target.value);
            }}
            className="font-semibold text-base bg-transparent focus:outline-none"
            style={{
              border: 'none',
              borderBottom: '1.5px dashed var(--border)',
              color: 'var(--fg)',
              padding: '0 0 2px',
            }}
          />
        </div>
        <div className="flex items-center gap-2">
          <Aide titre="Aide" contenu={aidePieces} />
          <Button onClick={() => setReplie(true)} variant="ghost" size="xs">
            <ChevronUp size={14} />
            Réduire
          </Button>
        </div>
      </div>

      {/* Table */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={event => {
          const { active, over } = event;
          if (!over || active.id === over.id) return;
          const oldIndex = lignes.findIndex(l => l.id === active.id);
          const newIndex = lignes.findIndex(l => l.id === over.id);
          setLignes(arrayMove(lignes, oldIndex, newIndex));
        }}
      >
        <div className="overflow-x-auto rounded-lg" style={{ border: '1px solid var(--border)' }}>
          <table className="w-full text-sm border-separate border-spacing-0">
            <thead>
              <tr>
                <th className="table-header-cell" style={{ width: '28px', borderRadius: '0.5rem 0 0 0' }} />
                <th className="table-header-cell">Désignation</th>
                <th className="table-header-cell">Unité</th>
                <th className="table-header-cell">Achat (€)</th>
                <th className="table-header-cell">% Marge</th>
                <th className="table-header-cell">Qté</th>
                <th className="table-header-cell">Mode</th>
                <th className="table-header-cell">Prix fixe (€)</th>
                <th className="table-header-cell" style={{ width: '88px' }}>TVA</th>
                <th className="table-header-cell" style={{ textAlign: 'center', borderRadius: '0 0.5rem 0 0' }}>Actions</th>
              </tr>
            </thead>
            <SortableContext items={lignes.map(l => l.id)} strategy={verticalListSortingStrategy}>
              <tbody>
                {lignes.length === 0 && (
                  <tr>
                    <td colSpan={10} style={{ padding: '2rem', textAlign: 'center', color: 'var(--fg-subtle)' }}>
                      Aucune pièce — cliquez sur « Ajouter une ligne » pour commencer.
                    </td>
                  </tr>
                )}
                {lignes.map(ligne => (
                  <LigneDraggablePiece
                    key={ligne.id}
                    ligne={ligne}
                    modifierLigne={modifierLigne}
                    supprimerLigne={() => supprimerLigne(ligne.id)}
                    sauvegarderLigne={() => sauvegarderLigne(ligne)}
                    globalTvaTaux={globalTvaTaux}
                    autoFocus={ligne.id === newLineId}
                    onEnterLastField={ajouterLigne}
                  />
                ))}
              </tbody>
            </SortableContext>
          </table>
        </div>
      </DndContext>

      {/* Add + toggle */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={ajouterLigne}
          className="inline-flex items-center gap-1.5 text-sm font-medium rounded-lg px-3 py-1.5 transition-all duration-150"
          style={{
            border: '1.5px dashed var(--border-strong)',
            color: 'var(--fg-muted)',
            backgroundColor: 'transparent',
            cursor: 'pointer',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)';
            (e.currentTarget as HTMLElement).style.color = 'var(--accent)';
            (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--accent-light)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-strong)';
            (e.currentTarget as HTMLElement).style.color = 'var(--fg-muted)';
            (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
          }}
        >
          <Plus size={14} />
          Ajouter une ligne
        </button>

        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={afficher}
            onChange={e => {
              const val = e.target.checked;
              setAfficher(val);
              if (!val) setReplie(true);
            }}
            className="sr-only"
          />
          <div
            className={`toggle-track${afficher ? ' on' : ''}`}
            onClick={() => setAfficher(!afficher)}
          >
            <div className="toggle-thumb" />
          </div>
          <span className="text-sm font-medium" style={{ color: 'var(--fg-muted)' }}>
            Visible dans le PDF
          </span>
        </label>
      </div>

      {/* Saved pieces */}
      {secteurActif && prestationsSauvegardees.length > 0 && (
        <div className="mt-2">
          <h3
            className="text-xs font-semibold uppercase tracking-wider mb-2"
            style={{ color: 'var(--fg-subtle)' }}
          >
            <Bookmark size={12} style={{ display: 'inline', marginRight: '4px' }} />
            Pièces enregistrées ({secteurActif})
          </h3>
          <div
            className="flex flex-col gap-2 rounded-lg p-3"
            style={{ border: '1px solid var(--border)', backgroundColor: 'var(--surface-2)' }}
          >
            {prestationsSauvegardees.map((prestation, index) => (
              <div
                key={index}
                className="flex justify-between items-center rounded-md p-3"
                style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
              >
                <div>
                  <span className="text-sm font-medium" style={{ color: 'var(--fg)' }}>
                    {prestation.designation}
                  </span>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--fg-muted)' }}>
                    {prestation.mode === 'manuel'
                      ? `Prix fixe : ${prestation.prixManuel} €`
                      : `${prestation.prixAchat} € achat + ${prestation.margePourcent}% marge × ${prestation.quantite}`}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => setLignes([...lignes, { ...prestation, id: crypto.randomUUID() }])}
                  >
                    Ajouter
                  </Button>
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => {
                      askConfirm('Supprimer cette pièce ?', () => {
                        const updated = [...prestationsSauvegardees];
                        updated.splice(index, 1);
                        localStorage.setItem(`prestationsPieces_${secteurActif}`, JSON.stringify(updated));
                        setPrestationsSauvegardees(updated);
                        toast.success('Pièce supprimée.');
                      });
                    }}
                  >
                    Supprimer
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
