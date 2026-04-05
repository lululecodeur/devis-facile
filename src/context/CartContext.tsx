'use client';

import { createContext, useContext, useState, useMemo } from 'react';
import type { ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useEffect } from 'react';

// ─── Shared calculation types (imported by page + PreviewDevis) ─────────────

export interface LigneMainOeuvreCalc {
  mode: 'fixe' | 'horaire';
  prixFixe: number | string;
  prixHoraire: number | string;
  heures: number | string;
  tvaTaux?: number;
}

export interface LignePieceCalc {
  mode: 'manuel' | 'calculé';
  prixManuel?: number | string;
  prixAchat: number | string;
  margePourcent: number | string;
  quantite: number | string;
  tvaTaux?: number;
}

export interface ColonneCalc {
  nom: string;
  type: 'texte' | 'quantite' | 'prix' | 'prixAvecMarge';
}

export interface CategorieCalc {
  lignes: Record<string, any>[];
  colonnes: ColonneCalc[];
  afficher: boolean;
}

export interface CalcParams {
  tvaTaux: number;
  remisePourcent: number;
  acomptePourcent: number;
  sujetTVA: boolean;
  afficherMainOeuvre: boolean;
  afficherPieces: boolean;
}

export interface GroupeTVA {
  taux: number;
  baseHT: number;
  montantTVA: number;
}

export interface DevisTotals {
  totalHTBrut: number;
  remise: number;
  remisePourcent: number;
  totalHT: number;
  tvaTaux: number;
  tva: number;
  totalTTC: number;
  acompte: number;
  acomptePourcent: number;
  groupesTVA: GroupeTVA[];
}

// ─── Internal helpers ────────────────────────────────────────────────────────

const r2 = (n: number) => Math.round(n * 100) / 100;

const parse = (val: string | number | undefined | null): number => {
  if (typeof val === 'number') return val;
  return parseFloat((val?.toString() ?? '').replace(',', '.')) || 0;
};

// ─── Pure calculation function ───────────────────────────────────────────────

export function computeDevisTotals(
  lignesMainOeuvre: LigneMainOeuvreCalc[],
  lignesPieces: LignePieceCalc[],
  categories: CategorieCalc[],
  params: CalcParams,
): DevisTotals {
  const { tvaTaux, remisePourcent, acomptePourcent, sujetTVA, afficherMainOeuvre, afficherPieces } = params;

  // ── 1. Total HT Brut ───────────────────────────────────────────────────────
  let totalHTBrut = 0;

  if (afficherMainOeuvre) {
    lignesMainOeuvre.forEach(l => {
      const prix = l.mode === 'fixe'
        ? r2(parse(l.prixFixe))
        : r2(parse(l.prixHoraire) * parse(l.heures));
      totalHTBrut = r2(totalHTBrut + prix);
    });
  }

  if (afficherPieces) {
    lignesPieces.forEach(l => {
      const pu = l.mode === 'manuel'
        ? r2(parse(l.prixManuel))
        : r2(parse(l.prixAchat) * (1 + parse(l.margePourcent) / 100));
      totalHTBrut = r2(totalHTBrut + r2(pu * parse(l.quantite)));
    });
  }

  categories.forEach(cat => {
    if (!cat.afficher) return;
    cat.lignes.forEach(ligne => {
      let pu = 0;
      let quantite = 1;
      for (const col of cat.colonnes) {
        if (col.type === 'prix') {
          pu = r2(pu + parse(ligne[col.nom]));
        } else if (col.type === 'prixAvecMarge') {
          const achat = parse(ligne[col.nom + '_achat']);
          const marge = parse(ligne[col.nom + '_marge']);
          pu = r2(pu + r2(achat * (1 + marge / 100)));
        } else if (col.type === 'quantite') {
          quantite = parse(ligne[col.nom]) || 1;
        }
      }
      totalHTBrut = r2(totalHTBrut + r2(pu * quantite));
    });
  });

  // ── 2. Remise & Total HT ───────────────────────────────────────────────────
  const remise = r2(totalHTBrut * (parse(remisePourcent) / 100));
  const totalHT = r2(totalHTBrut - remise);
  const remiseRatio = totalHTBrut > 0 ? totalHT / totalHTBrut : 1;

  // ── 3. Multi-rate TVA groups ───────────────────────────────────────────────
  const groupesTVA: GroupeTVA[] = (() => {
    if (!sujetTVA) return [];

    const map: Record<number, GroupeTVA> = {};

    const addLine = (baseHTBrut: number, taux: number) => {
      if (!map[taux]) map[taux] = { taux, baseHT: 0, montantTVA: 0 };
      const base = r2(baseHTBrut * remiseRatio);
      map[taux].baseHT = r2(map[taux].baseHT + base);
      map[taux].montantTVA = r2(map[taux].montantTVA + r2(base * taux / 100));
    };

    if (afficherMainOeuvre) {
      lignesMainOeuvre.forEach(l => {
        const prix = l.mode === 'fixe'
          ? r2(parse(l.prixFixe))
          : r2(parse(l.prixHoraire) * parse(l.heures));
        addLine(prix, l.tvaTaux ?? tvaTaux);
      });
    }

    if (afficherPieces) {
      lignesPieces.forEach(l => {
        const pu = l.mode === 'manuel'
          ? r2(parse(l.prixManuel))
          : r2(parse(l.prixAchat) * (1 + parse(l.margePourcent) / 100));
        addLine(r2(pu * parse(l.quantite)), l.tvaTaux ?? tvaTaux);
      });
    }

    categories.forEach(cat => {
      if (!cat.afficher) return;
      cat.lignes.forEach(ligne => {
        let pu = 0, qte = 1;
        for (const col of cat.colonnes) {
          if (col.type === 'prix') {
            pu = r2(pu + parse(ligne[col.nom]));
          } else if (col.type === 'prixAvecMarge') {
            pu = r2(pu + r2(parse(ligne[col.nom + '_achat']) * (1 + parse(ligne[col.nom + '_marge']) / 100)));
          } else if (col.type === 'quantite') {
            qte = parse(ligne[col.nom]) || 1;
          }
        }
        addLine(r2(pu * qte), tvaTaux);
      });
    });

    return Object.values(map).sort((a, b) => a.taux - b.taux);
  })();

  // ── 4. Final totals ────────────────────────────────────────────────────────
  const tva = r2(groupesTVA.reduce((s, g) => s + g.montantTVA, 0));
  const totalTTC = r2(totalHT + tva);
  const acompte = r2(totalTTC * (parse(acomptePourcent) / 100));

  return {
    totalHTBrut,
    remise,
    remisePourcent: parse(remisePourcent),
    totalHT,
    tvaTaux,
    tva,
    totalTTC,
    acompte,
    acomptePourcent: parse(acomptePourcent),
    groupesTVA,
  };
}

// ─── Default values ──────────────────────────────────────────────────────────

const DEFAULT_PARAMS: CalcParams = {
  tvaTaux: 20,
  remisePourcent: 0,
  acomptePourcent: 30,
  sujetTVA: true,
  afficherMainOeuvre: true,
  afficherPieces: true,
};

// ─── Cart item (kept for backward compat) ────────────────────────────────────

interface CartItem {
  id: string;
  designation: string;
  quantite: number;
  prixUnitaire: number;
}

export interface PendingDevis {
  data: Record<string, any>;
  locked: boolean;
  quoteId: string;
}

// ─── Context shape ───────────────────────────────────────────────────────────

interface CartContextValue {
  // Legacy cart
  items: CartItem[];
  userId: string | null;
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;

  // Pending devis (cross-page navigation)
  pendingDevis: PendingDevis | null;
  setPendingDevis: (devis: PendingDevis | null) => void;

  // Calculation engine
  calcParams: CalcParams;
  setCalcParams: (patch: Partial<CalcParams>) => void;
  updateLines: (
    lignesMainOeuvre: LigneMainOeuvreCalc[],
    lignesPieces: LignePieceCalc[],
    categories: CategorieCalc[],
  ) => void;
  totals: DevisTotals;
}

// ─── Provider ────────────────────────────────────────────────────────────────

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [pendingDevis, setPendingDevis] = useState<PendingDevis | null>(null);

  // Calculation engine state
  const [calcParams, setCalcParamsState] = useState<CalcParams>(DEFAULT_PARAMS);
  const [lignesMainOeuvre, setLignesMainOeuvre] = useState<LigneMainOeuvreCalc[]>([]);
  const [lignesPieces, setLignesPieces] = useState<LignePieceCalc[]>([]);
  const [categories, setCategories] = useState<CategorieCalc[]>([]);

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });
  }, []);

  // Derived totals – recomputed only when inputs change
  const totals = useMemo<DevisTotals>(
    () => computeDevisTotals(lignesMainOeuvre, lignesPieces, categories, calcParams),
    [lignesMainOeuvre, lignesPieces, categories, calcParams],
  );

  const setCalcParams = (patch: Partial<CalcParams>) =>
    setCalcParamsState(prev => ({ ...prev, ...patch }));

  const updateLines = (
    mo: LigneMainOeuvreCalc[],
    pieces: LignePieceCalc[],
    cats: CategorieCalc[],
  ) => {
    setLignesMainOeuvre(mo);
    setLignesPieces(pieces);
    setCategories(cats);
  };

  const addItem = (item: CartItem) => setItems(prev => [...prev, item]);
  const removeItem = (id: string) => setItems(prev => prev.filter(i => i.id !== id));
  const clearCart = () => setItems([]);

  return (
    <CartContext.Provider
      value={{
        items, userId, addItem, removeItem, clearCart,
        pendingDevis, setPendingDevis,
        calcParams, setCalcParams,
        updateLines,
        totals,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a CartProvider');
  return ctx;
}
