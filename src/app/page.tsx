'use client';

import React from 'react';
import { useState, ChangeEvent, useEffect, useRef } from 'react';
import { exporterPDF } from '@/utils/exportPdf';
import Card from '@/components/ui/Card';
import SignatureBlock from '@/components/SignatureBlock';
import type SignatureCanvas from 'react-signature-canvas';
import BlocMainOeuvre from '@/components/BlocMainOeuvre';
import BlocPieces from '@/components/BlocPieces';
import Link from 'next/link';
import { createRoot } from 'react-dom/client';
import BlocCategorie from '@/components/BlocCategorie';
import ModalNouvelleCategorie from '@/components/ModalNouvelleCategorie';
import Button from '@/components/ui/bouton';
import PreviewDevis from '@/components/PreviewDevis';
import Aide from '@/components/Aide';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { useToast } from '@/context/ToastContext';
import {
  Building2, User, FileText, Wrench, LayoutGrid,
  Scale, AlignLeft, PenLine, Download, Image as ImageIcon,
  Hash, TrendingUp, ChevronRight, ShieldCheck, Lock, Copy,
  Receipt, CalendarClock, BadgeCheck,
} from 'lucide-react';
import { genererNumeroDevis, previsualiserNumeroDevis, genererNumeroDevisSupabase } from '@/utils/numeroDevis';
import { useProfile, type ProfilArtisan } from '@/hooks/useProfile';
import { createClient } from '@/lib/supabase/client';
import { useCart } from '@/context/CartContext';

// Types

// Ligne d'un devis
interface Ligne {
  designation: string;
  unite: string;
  quantite: number;
  prix: number;
}

// Ligne Main d'œuvre
interface LigneMainOeuvre {
  id: string;
  designation: string;
  unite: string;
  mode: 'horaire' | 'fixe';
  prixHoraire: number;
  heures: number;
  prixFixe: number;
  tvaTaux?: number;  // per-line override; undefined = inherit global rate
}

// Ligne Pièce
interface LignePiece {
  id: string;
  designation: string;
  unite: string;
  prixAchat: number;
  margePourcent: number;
  quantite: number;
  prixManuel?: number;
  mode: 'calculé' | 'manuel';
  tvaTaux?: number;  // per-line override; undefined = inherit global rate
}

type LigneCustom = { [key: string]: any };

interface ColonneCategorie {
  nom: string;
  type: 'texte' | 'quantite' | 'prix' | 'prixAvecMarge';
}

interface CategorieDynamique {
  nom: string;
  lignes: LigneCustom[];
  colonnes: ColonneCategorie[]; // ← nouveau
  afficher: boolean;
  emoji?: string;
}

interface CategorieSauvegardee {
  nom: string;
  colonnes: ColonneCategorie[];
  lignes?: LigneCustom[];
  emoji?: string;
}

// Totaux
const imprimerPDFViaPrintJS = async () => {
  const { default: printJS } = await import('print-js');

  const devis = document.getElementById('devis-final');
  if (!devis) {
    console.warn('Devis introuvable pour impression.');
    return;
    return;
  }

  // Crée un clone exact du rendu final
  const clone = devis.cloneNode(true) as HTMLElement;

  // On retire tout bord extérieur
  clone.style.boxShadow = 'none';
  clone.style.border = 'none';
  clone.style.margin = '0 auto';

  // Conteneur invisible
  const wrapper = document.createElement('div');
  wrapper.id = 'print-container';
  wrapper.style.position = 'fixed';
  wrapper.style.top = '-9999px';
  wrapper.style.left = '0';
  wrapper.style.zIndex = '-1';
  wrapper.appendChild(clone);
  document.body.appendChild(wrapper);

  printJS({
    printable: clone,
    type: 'html',
    scanStyles: true, // ✅ applique les classes (ex: Tailwind)
    targetStyles: ['*'], // récupère tous les styles actifs
    style: `
  @page { margin: 0; }

  * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  th[colspan] {
    background-color: #f2f2f2 !important;
  }

  th {
    border-bottom: 1px solid #e5e7eb !important;
  }
`,

    documentTitle: 'Devis imprimé',
    onPrintDialogClose: () => {
      wrapper.remove(); // nettoyage DOM
    },
  });
};

const exporterPDFSansClasses = async () => {
  const devis = document.getElementById('devis-final');
  if (!devis) {
    console.warn('❌ Élément #devis-final introuvable.');
    return;
  }

  const clone = devis.cloneNode(true) as HTMLElement;
  clone.style.width = '794px';
  clone.style.minHeight = '1123px';
  clone.style.padding = '32px';
  clone.style.margin = '0 auto';
  clone.style.backgroundColor = '#ffffff';
  clone.style.fontFamily = 'Arial, sans-serif';
  clone.style.fontSize = '14px';
  clone.style.lineHeight = '1.5';
  clone.style.transform = 'none';
  clone.style.transformOrigin = 'top left';

  // Supprimer classes
  clone.querySelectorAll('*').forEach(el => el.removeAttribute('class'));

  // Appliquer style uniquement aux tableaux de prestations
  clone.querySelectorAll('table').forEach(table => {
    const isTotaux = table.innerHTML.includes('Total TTC');
    if (!isTotaux) {
      const t = table as HTMLElement;
      t.style.tableLayout = 'fixed';
      t.style.width = '100%';
      t.style.borderCollapse = 'collapse';
    }
  });

  // Corriger les cellules
  clone.querySelectorAll('td, th').forEach(el => {
    const cell = el as HTMLTableCellElement;
    const content = cell.innerHTML.trim();

    // Empêche cellule vide
    if (!content) {
      cell.innerHTML = '&nbsp;';
    }

    // Vrai centrage vertical via flexbox (sauf titres colSpan)
    const isTitre = cell.colSpan && cell.colSpan > 1;

    if (!isTitre) {
      const wrapped = `<div style="display:flex; align-items:center; justify-content:center; height:100%;">${content}</div>`;
      cell.innerHTML = wrapped;
    }

    // Styles de base
    cell.style.padding = '6px 8px';
    cell.style.height = '40px';
    cell.style.minHeight = '40px';
    cell.style.verticalAlign = 'middle';
    cell.style.display = 'table-cell';
    cell.style.lineHeight = '1.3';
    cell.style.fontSize = '14px';

    // Alignement
    cell.style.textAlign = isTitre ? 'left' : 'center';
    if (isTitre) cell.style.fontWeight = 'bold';
  });

  // Fix hauteur des lignes
  clone.querySelectorAll('tr').forEach(el => {
    (el as HTMLElement).style.minHeight = '40px';
  });

  // 📄 Ajouter à un conteneur invisible pour export
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '-9999px';
  container.style.left = '0';
  container.style.zIndex = '-1';
  container.style.width = '794px';
  container.appendChild(clone);
  document.body.appendChild(container);

  await exporterPDF(clone);
  document.body.removeChild(container);
};

export default function Home() {
  const { toast } = useToast();
  // Confirm dialog state
  const [confirmState, setConfirmState] = useState<{
    message: string;
    onConfirm: () => void;
  } | null>(null);
  const askConfirm = (message: string, onConfirm: () => void) =>
    setConfirmState({ message, onConfirm });

  // État général
  const [titre, setTitre] = useState('Devis - Intervention Plomberie');
  const [mentions, setMentions] = useState('');
  const [logo, setLogo] = useState<string | null>(null);
  const {
    userId,
    emetteur, setEmetteur,
    profilArtisan, setProfilArtisan,
    iban, setIban,
    bic, setBic,
    saving: profileSaving,
    saveProfile,
  } = useProfile();

  const { pendingDevis, setPendingDevis, setCalcParams, updateLines, totals } = useCart();

  const [recepteur, setRecepteur] = useState({ nom: '', adresse: '', email: '', tel: '' });
  const [clientsList, setClientsList] = useState<{ id: string; name: string; address: string; email: string; phone: string }[]>([]);
  const [intro, setIntro] = useState('');
  const [conclusion, setConclusion] = useState('');
  const [hauteurLogo, setHauteurLogo] = useState(160);
  const [tvaTaux, setTvaTaux] = useState(20);
  const [remisePourcent, setRemisePourcent] = useState(0);
  const [acomptePourcent, setAcomptePourcent] = useState(30);
  const [secteurs, setSecteurs] = useState<string[]>([]);
  const [secteurActif, setSecteurActif] = useState<string>('');
  const [showSecteurModal, setShowSecteurModal] = useState(false);
  const cleanNumericInput = (val: string): number => {
    const clean = val.replace(/^0+(\d)/, '$1'); // 01 → 1, 003 → 3
    const parsed = parseFloat(clean);
    return isNaN(parsed) ? 0 : Math.round(parsed * 100) / 100; // max 2 décimales
  };
  const [signatureClient, setSignatureClient] = useState<string | null>(null);
  const [lignesMainOeuvre, setLignesMainOeuvre] = useState<LigneMainOeuvre[]>([]);
  const [lignesPieces, setLignesPieces] = useState<LignePiece[]>([]);
  const [nomMainOeuvre, setNomMainOeuvre] = useState("Main d'œuvre");
  const [nomPieces, setNomPieces] = useState('Pièces');
  const [categoriesDynamiques, setCategoriesDynamiques] = useState<CategorieDynamique[]>([]);
  const [nouvelleCategorie, setNouvelleCategorie] = useState('');

  const [signatureEmetteur, setSignatureEmetteur] = useState<string | null>(null);

  const [mode, setMode] = useState<'accueil' | 'devis'>('accueil');
  const [afficherMainOeuvre, setAfficherMainOeuvre] = useState(true);
  const [afficherPieces, setAfficherPieces] = useState(true);
  const lignesPourPDF: { type: 'header' | 'ligne'; contenu?: Ligne }[] = [];
  const [showModal, setShowModal] = useState(false);
  const parseNombreFr = (val: string | number | undefined | null): number =>
    typeof val === 'number' ? val : parseFloat((val || '').toString().replace(',', '.')) || 0;

  const [numeroDevis, setNumeroDevis] = useState('');
  const [exportEnCours, setExportEnCours] = useState(false);

  const [modeModal, setModeModal] = useState<'creation' | 'edition'>('creation');
  const [categorieEdition, setCategorieEdition] = useState<null | {
    nom: string;
    colonnes: ColonneCategorie[];
  }>(null);

  const [colonnesCustom, setColonnesCustom] = useState<
    { nom: string; type: 'texte' | 'quantite' | 'prix' | 'prixAvecMarge' }[]
  >([]);

  const [nouvelleColonne, setNouvelleColonne] = useState('');
  const [typeColonne, setTypeColonne] = useState<'texte' | 'quantite' | 'prix' | 'prixAvecMarge'>(
    'texte'
  );
  const [categoriesSauvegardees, setCategoriesSauvegardees] = useState<CategorieSauvegardee[]>([]);

  const [afficherPDFMobile, setAfficherPDFMobile] = useState(false);
  const [indexCategorieEdition, setIndexCategorieEdition] = useState<number | null>(null);

  // ── BTP compliance fields ────────────────────────────────────────────────
  // emetteur, profilArtisan, iban, bic are now managed by useProfile (Supabase)
  const [sujetTVA, setSujetTVA] = useState(true);
  const [dureeValidite, setDureeValidite] = useState(30);
  const [conditionsReglement, setConditionsReglement] = useState(
    "30 % à la signature du devis, solde à la réception des travaux."
  );
  const [statut, setStatut] = useState<'brouillon' | 'finalise'>('brouillon');
  const [dateFinalisation, setDateFinalisation] = useState<string | null>(null);
  const [quoteId, setQuoteId] = useState<string | null>(null);
  const [savingQuote, setSavingQuote] = useState(false);

  // ── Sync calculation engine in CartContext ───────────────────────────────
  useEffect(() => {
    setCalcParams({ tvaTaux, remisePourcent, acomptePourcent, sujetTVA, afficherMainOeuvre, afficherPieces });
  }, [tvaTaux, remisePourcent, acomptePourcent, sujetTVA, afficherMainOeuvre, afficherPieces]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    updateLines(lignesMainOeuvre, lignesPieces, categoriesDynamiques);
  }, [lignesMainOeuvre, lignesPieces, categoriesDynamiques]); // eslint-disable-line react-hooks/exhaustive-deps

  const aideMentionsEtFisc = `⚖️ Mentions légales
– Ce champ vous permet d'ajouter des conditions ou informations contractuelles visibles en bas du devis PDF.
– Exemples : « Devis valable 15 jours », « Paiement sous 30 jours », « TVA non applicable, art. 293 B du CGI », etc.
– Ce champ accepte les sauts de ligne et sera rendu tel quel dans le PDF.

📊 TVA (%)
– Taux de taxe sur la valeur ajoutée appliqué au montant total HT (hors taxes).
– Le taux saisi sera utilisé pour calculer automatiquement le montant de la TVA et le total TTC.
– Exemples : 20 pour 20%, 0 pour exonération.

💸 Remise (%)
– Réduction appliquée sur le **total HT**, avant le calcul de la TVA.
– Le taux de remise s'applique à l'ensemble des lignes visibles dans le devis.

💰 Acompte (%)
– Pourcentage du montant **TTC** que vous souhaitez demander en avance à votre client.
– Le montant de l'acompte sera affiché dans le tableau des totaux.

ℹ️ Tous les calculs sont mis à jour automatiquement dès que vous modifiez un champ.
`;

  const aideCategorie = `📦 Nom de la catégorie
Vous pouvez librement nommer cette section selon son contenu : Location, Transport, Nettoyage, Repas, etc.
Le nom est automatiquement sauvegardé et sera proposé par défaut lors de la création de futurs devis.

🧱 Structure du tableau
– Vous pouvez ajouter autant de colonnes que nécessaire.
– Chaque colonne doit être associée à un type : Texte, Quantité, Prix ou Prix avec marge.
– Vous pouvez modifier la structure à tout moment via le bouton « ✏️ Modifier la structure ».

🛠️ Remplissage des lignes
– Chaque ligne représente une entrée dans la catégorie (ex : un poste, un produit, une tâche...).
– Cliquez sur « ➕ Ajouter une ligne » pour créer une nouvelle entrée.
– Les champs numériques (quantité, prix...) acceptent les virgules, et les totaux sont recalculés automatiquement.

💰 Calcul automatique des totaux
– Si vous avez défini une colonne de type Quantité et au moins une colonne de type Prix ou Prix avec marge, alors un Total HT est automatiquement affiché pour chaque ligne.
– Pour les colonnes de type « Prix avec marge », le prix unitaire est calculé comme suit :
→ Prix = Prix d'achat × (1 + Marge en % / 100)

💾 Sauvegarde des catégories
– Le bouton « 💾 Enregistrer cette prestation » permet de sauvegarder **l'ensemble de la catégorie** (colonnes + toutes les lignes).
– Contrairement aux prestations principales (Main d'œuvre et Pièces), vous **ne pouvez pas enregistrer une seule ligne isolée** d'une catégorie dynamique.
– En revanche, vous pouvez :
  • Enregistrer une catégorie avec plusieurs prestations,
  • L'ajouter à un devis via le bouton « Ajouter au devis »,
  • Supprimer les lignes non désirées dans ce devis uniquement via le bouton 🗑️ (cela ne modifie pas la version enregistrée).
– Les catégories sauvegardées sont liées au secteur actif, persistent après rechargement, et restent disponibles pour les futurs devis.

📂 Réutilisation et suppression
– Pour ajouter une catégorie enregistrée à un devis, cliquez sur « Ajouter au devis » dans l'encadré *📂 Catégories enregistrées*.
– Pour supprimer définitivement une catégorie enregistrée, utilisez le bouton « Supprimer » dans ce même encadré.

📥 Inclusion dans le PDF
– Utilisez le switch « Afficher dans le PDF » pour décider si cette catégorie doit apparaître dans le rendu PDF final.
– Si désactivée, elle reste visible dans l'interface mais ne sera pas affichée dans le devis généré.
`;

  if (lignesMainOeuvre.length > 0) {
    lignesPourPDF.push({
      type: 'header',
      contenu: { designation: "'", unite: '', quantite: 0, prix: 0 },
    });
    lignesMainOeuvre.forEach(l => {
      const prix = l.mode === 'fixe' ? l.prixFixe : l.prixHoraire * l.heures;
      lignesPourPDF.push({
        type: 'ligne',
        contenu: { designation: l.designation, unite: 'U', quantite: 1, prix },
      });
    });
  }

  if (lignesPieces.length > 0) {
    lignesPourPDF.push({
      type: 'header',
      contenu: { designation: '🔩 Pièces', unite: '', quantite: 0, prix: 0 },
    });
    lignesPieces.forEach(l => {
      const prix = l.prixAchat * (1 + l.margePourcent / 100);
      lignesPourPDF.push({
        type: 'ligne',
        contenu: { designation: l.designation, unite: 'U', quantite: l.quantite, prix },
      });
    });
  }
  useEffect(() => {
    const secteursSauvegardes = localStorage.getItem('secteurs');
    const secteurActifSauvegarde = localStorage.getItem('secteurActif');

    if (secteursSauvegardes) {
      try {
        const parsed = JSON.parse(secteursSauvegardes);
        if (Array.isArray(parsed)) {
          setSecteurs(parsed);

          if (secteurActifSauvegarde && parsed.includes(secteurActifSauvegarde)) {
            setSecteurActif(secteurActifSauvegarde);
            setMode('devis');
            setShowSecteurModal(false);
          } else if (parsed.length > 0) {
            setSecteurActif(parsed[0]);
            setMode('devis');
            setShowSecteurModal(false);
          }
        }
      } catch (e) {
        console.error('Erreur lecture secteurs sauvegardés', e);
      }
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const modeParam = params.get('mode');

    if (modeParam === 'devis') {
      setMode('devis');

      const temp = localStorage.getItem('clientTemp');
      if (temp) {
        try {
          const client = JSON.parse(temp);
          setRecepteur(client);
          setClientTempLoaded(true);
          localStorage.removeItem('clientTemp');
        } catch (e) {
          console.error('Erreur lecture clientTemp :', e);
        }
      }

      // ✅ AJOUTE CE BLOC JUSTE ICI
      const idTemp = localStorage.getItem('client_id_temp');
      if (idTemp) {
        const clientsStr = localStorage.getItem('clients');
        const clients = clientsStr ? JSON.parse(clientsStr) : [];

        const client = clients.find((c: any) => c.client_id === idTemp);
        if (client) {
          setRecepteur(client);
        }

        localStorage.removeItem('client_id_temp');
      }
    }
  }, []);

  useEffect(() => {
    const nomPiecesSauvegarde = localStorage.getItem('nomPieces');
    if (nomPiecesSauvegarde) setNomPieces(nomPiecesSauvegarde);

    const nomMainOeuvreSauvegarde = localStorage.getItem('nomMainOeuvre');
    if (nomMainOeuvreSauvegarde) setNomMainOeuvre(nomMainOeuvreSauvegarde);
  }, []);

  const [deviceScale, setDeviceScale] = useState(1);
  const [hasHydratedFromDevis, setHasHydratedFromDevis] = useState(false);
  const [canSaveEmetteur, setCanSaveEmetteur] = useState(false);
  const [clientTempLoaded, setClientTempLoaded] = useState(false);
  const [clientId, setClientId] = useState(''); // <- pour garder le vrai ID du client

  const buildLignesFinales = () => {
    const lignesMO = lignesMainOeuvre.map(l => {
      const prix =
        l.mode === 'fixe'
          ? parseNombreFr(l.prixFixe)
          : parseNombreFr(l.prixHoraire) * parseNombreFr(l.heures);
      return {
        designation: l.designation,
        quantite: 1,
        prix,
      };
    });

    const lignesPiecesMapped: any[] = lignesPieces.map(l => {
      const prix =
        l.mode === 'manuel'
          ? parseNombreFr(l.prixManuel)
          : parseNombreFr(l.prixAchat) * (1 + parseNombreFr(l.margePourcent) / 100);
      return {
        designation: l.designation,
        quantite: parseNombreFr(l.quantite),
        prix,
      };
    });

    const lignesDynamiques = categoriesDynamiques.flatMap(cat =>
      cat.lignes.map(l => {
        const colonnes = cat.colonnes.filter(c => c.type === 'prix' || c.type === 'prixAvecMarge');
        const prix = colonnes.reduce((s, col) => s + parseNombreFr(l[col.nom]), 0);
        const quantite = parseNombreFr(l['quantite']) || 1;
        return {
          designation: cat.nom,
          quantite,
          prix,
        };
      })
    );

    return [...lignesMO, ...lignesPiecesMapped, ...lignesDynamiques];
  };

  // On conserve les lignes fusionnées si besoin ailleurs
  const lignesFinales = buildLignesFinales();

  /**
   * Persists the current quote to Supabase `quotes` table.
   * On first call: INSERT a new row and store the returned id.
   * On subsequent calls (same quoteId): UPDATE the existing row.
   * Returns the saved row id, or null on error.
   */
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
        recepteur_nom: recepteur.nom || null,
        finalized_at: opts.finaliseAt,
        emetteur,
        recepteur,
        lignesMainOeuvre,
        lignesPieces,
        categoriesDynamiques,
        tvaTaux,
        remisePourcent,
        acomptePourcent,
        sujetTVA,
        dureeValidite,
        conditionsReglement,
        mentions,
        intro,
        conclusion,
      },
    };

    try {
      let id = quoteId;
      if (id) {
        // UPDATE existing row
        const { error } = await supabase
          .from('quotes')
          .update(payload)
          .eq('id', id);
        if (error) throw error;
      } else {
        // INSERT new row
        const { data, error } = await supabase
          .from('quotes')
          .insert(payload)
          .select('id')
          .single();
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

  // ── Totals from CartContext calculation engine ───────────────────────────
  const { totalHTBrut, remise, totalHT, tva, totalTTC, acompte, groupesTVA } = totals;

  // Logo upload
  const handleLogoUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setLogo(reader.result as string);
      reader.readAsDataURL(file);
    }
  };
  useEffect(() => {
    const secteursSauvegardes = localStorage.getItem('secteurs');
    if (secteursSauvegardes) {
      try {
        const parsed = JSON.parse(secteursSauvegardes);
        if (Array.isArray(parsed)) {
          setSecteurs(parsed);

          const secteurSauvegarde = localStorage.getItem('secteurActif');
          if (secteurSauvegarde && parsed.includes(secteurSauvegarde)) {
            setSecteurActif(secteurSauvegarde);
            setShowSecteurModal(false);
            setMode('devis'); // ✅ IMPORTANT
          } else if (parsed.length > 0) {
            setSecteurActif(parsed[0]);
            setShowSecteurModal(false);
            setMode('devis'); // ✅ AUSSI ICI
          }
        }
      } catch (e) {
        console.error('Erreur lecture secteurs sauvegardés', e);
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setDeviceScale(1 / window.devicePixelRatio);
    }
  }, []);
  useEffect(() => {
    localStorage.setItem('secteurs', JSON.stringify(secteurs));
  }, [secteurs]);

  // Logo from localStorage (logo is not yet in Supabase storage)
  useEffect(() => {
    const logoSauvegarde = localStorage.getItem('logo');
    if (logoSauvegarde) setLogo(logoSauvegarde);
  }, []);

  useEffect(() => {
    if (logo) localStorage.setItem('logo', logo);
  }, [logo]);

  // Charger les mentions sauvegardées
  useEffect(() => {
    const mentionsSauvegarde = localStorage.getItem('mentions');
    if (mentionsSauvegarde) setMentions(mentionsSauvegarde);
  }, []);

  // Sauvegarder les mentions à chaque modification
  useEffect(() => {
    localStorage.setItem('mentions', mentions);
  }, [mentions]);

  useEffect(() => {
    if (secteurActif) {
      setTitre(`Devis - Intervention ${secteurActif}`);
    }
  }, [secteurActif]);

  useEffect(() => {
    if (secteurActif) {
      const val = localStorage.getItem(`nomMainOeuvre_${secteurActif}`);
      if (val) setNomMainOeuvre(val);
    }
  }, [secteurActif]);

  useEffect(() => {
    if (secteurActif) {
      const val = localStorage.getItem(`nomPieces_${secteurActif}`);
      if (val) setNomPieces(val);
    }
  }, [secteurActif]);

  useEffect(() => {
    if (secteurActif) {
      localStorage.setItem(`nomMainOeuvre_${secteurActif}`, nomMainOeuvre);
    }
  }, [nomMainOeuvre, secteurActif]);

  useEffect(() => {
    if (secteurActif) {
      localStorage.setItem(`nomPieces_${secteurActif}`, nomPieces);
    }
  }, [nomPieces, secteurActif]);

  useEffect(() => {
    if (secteurActif) {
      setTitre(`Devis - Intervention ${secteurActif}`);
    }
  }, [secteurActif]);
  // Charger les secteurs sauvegardés

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
        setLignesMainOeuvre(data.lignesMainOeuvre || []);
        setLignesPieces(data.lignesPieces || []);
        setCategoriesDynamiques(data.categoriesDynamiques || []);
        if (data.sujetTVA !== undefined) setSujetTVA(data.sujetTVA);
        if (data.dureeValidite !== undefined) setDureeValidite(data.dureeValidite);
        if (data.conditionsReglement !== undefined) setConditionsReglement(data.conditionsReglement);
        if (pendingDevis.locked) setStatut('finalise');
        setQuoteId(pendingDevis.quoteId);
        setCanSaveEmetteur(true);
      } catch (err) {
        console.error('Erreur lors du chargement du devis :', err);
      } finally {
        setPendingDevis(null);
        setHasHydratedFromDevis(true);
      }
    } else {
      setHasHydratedFromDevis(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const fetchClients = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
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

  useEffect(() => {
    const saved = localStorage.getItem('categoriesSauvegardees');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setCategoriesSauvegardees(parsed);
      } catch {}
    }
  }, []);
  useEffect(() => {
    if (secteurActif) {
      localStorage.setItem('secteurActif', secteurActif);
    }
  }, [secteurActif]);

  // profilArtisan is now loaded and saved via useProfile (Supabase)

  // Persist TVA preference + conditions
  useEffect(() => {
    const s = localStorage.getItem('sujetTVA');
    if (s !== null) setSujetTVA(s === 'true');
    const cr = localStorage.getItem('conditionsReglement');
    if (cr) setConditionsReglement(cr);
    const dv = localStorage.getItem('dureeValidite');
    if (dv) setDureeValidite(Number(dv));
  }, []);
  useEffect(() => { localStorage.setItem('sujetTVA', String(sujetTVA)); }, [sujetTVA]);
  useEffect(() => { localStorage.setItem('conditionsReglement', conditionsReglement); }, [conditionsReglement]);
  useEffect(() => { localStorage.setItem('dureeValidite', String(dureeValidite)); }, [dureeValidite]);

  // separation entre home et return

  return (
    <>
      {/* ── DEV ONLY: Quick Login banner ──────────────────────────────────── */}
      {!userId && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
          background: '#1e293b', color: '#94a3b8', fontSize: '12px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
          padding: '6px 16px',
        }}>
          <span>Non connecté — données locales uniquement</span>
          <button
            style={{
              background: '#6366f1', color: '#fff', border: 'none',
              borderRadius: '4px', padding: '3px 10px', cursor: 'pointer', fontSize: '12px',
            }}
            onClick={async () => {
              const supabase = createClient();
              const { error } = await supabase.auth.signInWithPassword({
                email: 'test@test.com',
                password: 'Password123*',
              });
              if (error) {
                toast.error(`Connexion échouée : ${error.message}`);
              } else {
                toast.success('Connecté en tant que test@test.com');
                window.location.reload();
              }
            }}
          >
            Connexion rapide (test)
          </button>
        </div>
      )}
      {mode === 'accueil' && (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
          <div
            style={{
              width: '64px',
              height: '64px',
              backgroundColor: 'var(--accent-light)',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1.5rem',
            }}
          >
            <span style={{ fontSize: '2rem' }}>🧾</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-3" style={{ color: 'var(--fg)' }}>
            Bienvenue sur DevisPro
          </h1>
          <p className="text-lg mb-8 max-w-md" style={{ color: 'var(--fg-muted)' }}>
            Choisissez votre secteur d'activité pour commencer à générer des devis professionnels.
          </p>
          <Button
            variant="primary"
            size="lg"
            onClick={() => {
              setShowSecteurModal(true);
              setMode('devis');
            }}
          >
            Commencer maintenant
          </Button>
        </div>
      )}

      {mode === 'devis' && (
        <main className="min-h-screen p-4 sm:p-6 lg:p-8 font-sans">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-full sm:max-w-screen-md lg:max-w-screen-xl mx-auto">
            <div className="w-full min-w-0 flex flex-col gap-5">
              {/* Colonne gauche : Formulaire */}
              <div className="w-full min-w-0 space-y-5">
                {showSecteurModal && (
                  <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgb(0 0 0 / 0.5)', backdropFilter: 'blur(4px)' }}>
                    <div className="card w-full max-w-md text-center p-6 mx-4">
                      <h2 className="text-xl font-semibold mb-1" style={{ color: 'var(--fg)' }}>
                        Votre secteur d'activité
                      </h2>
                      <p className="text-sm mb-5" style={{ color: 'var(--fg-muted)' }}>
                        Saisissez votre métier pour personnaliser votre devis.
                      </p>

                      <input
                        type="text"
                        placeholder="Ex : Électricien, Peintre, Photographe..."
                        className="form-input mb-3"
                        value={secteurActif}
                        onChange={e => setSecteurActif(e.target.value)}
                      />

                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full mb-4"
                        onClick={() => {
                          const propre = secteurActif.trim();
                          if (propre && !secteurs.includes(propre)) {
                            const updated = [...secteurs, propre];
                            setSecteurs(updated);
                            setSecteurActif(propre);
                            localStorage.setItem('secteurs', JSON.stringify(updated));
                            localStorage.setItem('secteurActif', propre);
                          }
                        }}
                      >
                        + Ajouter ce métier
                      </Button>

                      {secteurs.length > 0 && (
                        <div className="flex flex-wrap justify-center gap-2 mb-5">
                          {secteurs.map(s => (
                            <div
                              key={s}
                              className={`badge ${secteurActif === s ? 'active' : ''}`}
                              onClick={() => setSecteurActif(s)}
                            >
                              <span>{s}</span>
                              <button
                                onClick={e => {
                                  e.stopPropagation();
                                  const updated = secteurs.filter(item => item !== s);
                                  setSecteurs(updated);
                                  localStorage.setItem('secteurs', JSON.stringify(updated));
                                  if (secteurActif === s) setSecteurActif(updated[0] || '');
                                }}
                                style={{ marginLeft: '0.375rem', color: 'inherit', opacity: 0.7 }}
                                title="Supprimer ce métier"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      <Button
                        disabled={secteurs.length === 0 && secteurActif.trim() === ''}
                        variant="primary"
                        size="md"
                        className="w-full"
                        onClick={() => {
                          const propre = secteurActif.trim();
                          let secteurFinal = propre;
                          if (!secteurFinal && secteurs.length > 0) secteurFinal = secteurs[0];
                          if (secteurFinal) {
                            if (!secteurs.includes(secteurFinal)) {
                              const updated = [...secteurs, secteurFinal];
                              setSecteurs(updated);
                              localStorage.setItem('secteurs', JSON.stringify(updated));
                            }
                            setSecteurActif(secteurFinal);
                            localStorage.setItem('secteurActif', secteurFinal);
                            setMode('devis');
                            setShowSecteurModal(false);
                          } else {
                            toast.error('Merci de renseigner un métier valide.');
                          }
                        }}
                      >
                        Valider et continuer
                      </Button>

                      <p className="text-xs mt-4" style={{ color: 'var(--fg-subtle)' }}>
                        Vous pourrez modifier vos métiers à tout moment.
                      </p>
                    </div>
                  </div>
                )}

                {/* ── Page header ──────────────────────────────────── */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h1 className="text-xl font-bold tracking-tight" style={{ color: 'var(--fg)' }}>
                      Nouveau devis
                    </h1>
                    <p className="text-sm mt-0.5 flex items-center gap-1.5" style={{ color: 'var(--fg-muted)' }}>
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
                        style={{ backgroundColor: 'var(--accent-light)', color: 'var(--accent)', border: '1px solid var(--accent-mid)' }}
                      >
                        {secteurActif || 'Aucun secteur'}
                      </span>
                    </p>
                  </div>
                  <button
                    onClick={() => setShowSecteurModal(true)}
                    className="inline-flex items-center gap-1 text-xs font-medium rounded-lg px-2.5 py-1.5 transition-all"
                    style={{ color: 'var(--fg-muted)', border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.color = 'var(--fg-muted)'; }}
                  >
                    <ChevronRight size={12} />
                    Changer de secteur
                  </button>
                </div>

                {/* ── Live totals bar ───────────────────────────────── */}
                <div className="totals-bar">
                  <div className="totals-bar-item" style={{ flex: 1 }}>
                    <span className="totals-bar-label">Total HT</span>
                    <span className="totals-bar-value">{totalHT.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</span>
                  </div>
                  <div style={{ width: '1px', alignSelf: 'stretch', backgroundColor: 'var(--border)' }} />
                  <div className="totals-bar-item" style={{ flex: 1 }}>
                    <span className="totals-bar-label">{sujetTVA ? `TVA (${tvaTaux}%)` : 'TVA (non applicable)'}</span>
                    <span className="totals-bar-value">{sujetTVA ? tva.toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + ' €' : '—'}</span>
                  </div>
                  <div style={{ width: '1px', alignSelf: 'stretch', backgroundColor: 'var(--border)' }} />
                  <div className="totals-bar-item" style={{ flex: 1 }}>
                    <span className="totals-bar-label">Total TTC</span>
                    <span className="totals-bar-value accent">{totalTTC.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</span>
                  </div>
                  <div style={{ width: '1px', alignSelf: 'stretch', backgroundColor: 'var(--border)' }} />
                  <Button
                    onClick={async () => {
                      setExportEnCours(true);
                      try {
                        if (!recepteur.nom.trim() || !recepteur.email.trim()) {
                          toast.error('Merci de renseigner un nom et un email client.');
                          return;
                        }
                        if (!lignesFinales || lignesFinales.length === 0) {
                          toast.error("Ajoutez au moins une ligne avant d'exporter.");
                          return;
                        }
                        const devisElement = document.getElementById('devis-final') as HTMLElement;
                        if (!devisElement) { toast.error('Aperçu introuvable, rechargez la page.'); return; }
                        await exporterPDF(devisElement);
                        toast.success('Devis exporté avec succès !');
                      } catch (e) {
                        toast.error("Erreur lors de l'export. Réessayez.");
                      } finally {
                        setExportEnCours(false);
                      }
                    }}
                    disabled={exportEnCours}
                    variant="primary"
                    size="sm"
                    icon={<Download size={14} />}
                  >
                    {exportEnCours ? 'Export…' : 'Exporter PDF'}
                  </Button>
                </div>

                <div className="w-full flex flex-col space-y-5">
                  <Card title="Logo de l'entreprise" icon={<ImageIcon size={14} />} className="w-full">
                    <div className="flex flex-col gap-4 sm:gap-6">
                      {!logo && (
                        <div className="flex flex-col items-start gap-2">
                          <label htmlFor="logo-upload" className="text-sm font-medium">
                            Uploader un fichier image (jpg...)
                          </label>
                          <input
                            id="logo-upload"
                            type="file"
                            accept="image/*"
                            onChange={handleLogoUpload}
                            className="hidden"
                          />
                          <label
                            htmlFor="logo-upload"
                            className="inline-flex items-center gap-2 cursor-pointer font-medium text-sm py-2 px-4 rounded-lg border transition-all duration-150"
                            style={{ backgroundColor: 'var(--accent-light)', color: 'var(--accent)', borderColor: 'var(--accent)', minHeight: '40px' }}
                          >
                            <ImageIcon size={14} />
                            Choisir un fichier image
                          </label>
                        </div>
                      )}

                      {logo && (
                        <div className="flex flex-col gap-4">
                          <img
                            src={logo}
                            alt="Logo"
                            className="rounded shadow"
                            style={{
                              height: `${hauteurLogo}px`,
                              maxHeight: '300px',
                              objectFit: 'contain',
                              maxWidth: '100%',
                            }}
                          />

                          <div className="w-full">
                            <label className="form-label text-center">
                              Taille du logo :{' '}
                              <span className="font-semibold" style={{ color: 'var(--accent)' }}>{hauteurLogo}px</span>
                            </label>
                            <div className="relative w-full">
                              <input
                                type="range"
                                min="80"
                                max="300"
                                value={hauteurLogo}
                                onChange={e => setHauteurLogo(Number(e.target.value))}
                                className="form-input"
                              />
                            </div>

                            <style jsx>{`
                              input[type='range'].slider-thumb-visible::-webkit-slider-thumb {
                                -webkit-appearance: none;
                                height: 20px;
                                width: 20px;
                                margin-top: -9px; /* centre le thumb */
                                background: white;
                                border: 2px solid #2563eb;
                                border-radius: 50%;
                                cursor: pointer;
                              }

                              input[type='range'].slider-thumb-visible::-moz-range-thumb {
                                height: 20px;
                                width: 20px;
                                background: white;
                                border: 2px solid #2563eb;
                                border-radius: 50%;
                                cursor: pointer;
                              }

                              input[type='range'].slider-thumb-visible::-ms-thumb {
                                height: 20px;
                                width: 20px;
                                background: white;
                                border: 2px solid #2563eb;
                                border-radius: 50%;
                                cursor: pointer;
                              }

                              input[type='range'].slider-thumb-visible::-webkit-slider-runnable-track {
                                height: 2px;
                                background: #e5e7eb;
                                border-radius: 999px;
                              }

                              input[type='range'].slider-thumb-visible::-moz-range-track {
                                height: 2px;
                                background: #e5e7eb;
                                border-radius: 999px;
                              }

                              input[type='range'].slider-thumb-visible::-ms-track {
                                height: 2px;
                                background: #e5e7eb;
                                border-radius: 999px;
                                border-color: transparent;
                                color: transparent;
                              }
                            `}</style>
                          </div>

                          <button
                            onClick={() => {
                              setLogo(null);
                              localStorage.removeItem('logo');
                            }}
                            className="text-sm underline cursor-pointer"
                            style={{ color: 'var(--danger)' }}
                          >
                            Supprimer le logo
                          </button>
                        </div>
                      )}
                    </div>
                  </Card>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    <Card title="Informations de l'émetteur" icon={<Building2 size={14} />} initialOpen={true}>
                      <div className="flex flex-col gap-4">
                        <label className="form-label">Nom de l'entreprise</label>
                        <input
                          className="form-input"
                          type="text"
                          inputMode="text"
                          autoComplete="organization"
                          aria-label="Nom de l'entreprise"
                          placeholder={`Ex : ${
                            secteurActif ? secteurActif + ' Martin' : 'Mon entreprise'
                          }`}
                          value={emetteur.nom}
                          onChange={e => setEmetteur({ ...emetteur, nom: e.target.value })}
                        />

                        <label className="form-label">Adresse</label>
                        <textarea
                          className="form-input"
                          autoComplete="street-address"
                          aria-label="Adresse de l'entreprise"
                          placeholder="Ex : 12 rue des Lilas, 75000 Paris"
                          value={emetteur.adresse}
                          rows={2}
                          onChange={e => setEmetteur({ ...emetteur, adresse: e.target.value })}
                        />

                        <label className="form-label">SIRET</label>
                        <input
                          className="form-input"
                          inputMode="numeric"
                          autoComplete="off"
                          aria-label="Numéro SIRET"
                          placeholder="Ex : 123 456 789 00010"
                          value={emetteur.siret}
                          onChange={e => setEmetteur({ ...emetteur, siret: e.target.value })}
                        />

                        <label className="form-label">Email</label>
                        <input
                          className="form-input"
                          type="email"
                          inputMode="email"
                          autoComplete="email"
                          aria-label="Email de l'entreprise"
                          placeholder={`Ex : contact@${
                            secteurActif
                              ? secteurActif.toLowerCase().replace(/\s/g, '')
                              : 'monentreprise'
                          }.fr`}
                          value={emetteur.email}
                          onChange={e => setEmetteur({ ...emetteur, email: e.target.value })}
                        />

                        <label className="form-label">Téléphone</label>
                        <input
                          className="form-input"
                          type="tel"
                          inputMode="tel"
                          autoComplete="tel"
                          aria-label="Téléphone de l'entreprise"
                          placeholder="Ex : 01 23 45 67 89"
                          value={emetteur.tel}
                          onChange={e => setEmetteur({ ...emetteur, tel: e.target.value })}
                        />
                        <label className="form-label">IBAN</label>
                        <input
                          className="form-input"
                          type="text"
                          placeholder="Ex : FR76 1234 5678 9012 3456 7890 123"
                          value={iban}
                          onChange={e => setIban(e.target.value)}
                        />

                        <label className="form-label">BIC</label>
                        <input
                          className="form-input"
                          type="text"
                          placeholder="Ex : AGRIFRPP"
                          value={bic}
                          onChange={e => setBic(e.target.value)}
                        />

                        <div className="flex gap-2 mt-2">
                          <Button
                            onClick={async () => {
                              const ok = await saveProfile(emetteur, profilArtisan, iban, bic);
                              if (ok) toast.success('Profil sauvegardé.');
                              else toast.error('Erreur lors de la sauvegarde.');
                            }}
                            variant="primary"
                            size="sm"
                            disabled={profileSaving}
                          >
                            {profileSaving ? 'Enregistrement…' : 'Sauvegarder le profil'}
                          </Button>
                          <Button
                            onClick={() => {
                              localStorage.removeItem('logo');
                              setEmetteur({ nom: '', adresse: '', siret: '', email: '', tel: '' });
                              setLogo(null);
                            }}
                            variant="ghost"
                            size="sm"
                          >
                            Réinitialiser
                          </Button>
                        </div>
                      </div>
                    </Card>

                    {/* ── Identité professionnelle BTP ──────────────── */}
                    <Card title="Identité professionnelle" icon={<ShieldCheck size={14} />}>
                      <div className="flex flex-col gap-4">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="field-group">
                            <label className="form-label">Forme juridique</label>
                            <select
                              className="form-select"
                              value={profilArtisan.formeJuridique}
                              onChange={e => setProfilArtisan({ ...profilArtisan, formeJuridique: e.target.value })}
                            >
                              <option value="">— Choisir —</option>
                              {['EI', 'EIRL', 'EURL', 'SARL', 'SAS', 'SASU', 'SA', 'SNC', 'Micro-entreprise'].map(f => (
                                <option key={f} value={f}>{f}</option>
                              ))}
                            </select>
                          </div>
                          <div className="field-group">
                            <label className="form-label">Capital social (€)</label>
                            <input
                              className="form-input"
                              placeholder="Ex : 10 000"
                              value={profilArtisan.capital}
                              onChange={e => setProfilArtisan({ ...profilArtisan, capital: e.target.value })}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="field-group">
                            <label className="form-label">Registre</label>
                            <div className="segment-control">
                              {(['RCS', 'RM'] as const).map(r => (
                                <button
                                  key={r}
                                  type="button"
                                  className={`segment-btn${profilArtisan.typeRegistre === r ? ' active' : ''}`}
                                  onClick={() => setProfilArtisan({ ...profilArtisan, typeRegistre: r })}
                                >
                                  {r}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="field-group">
                            <label className="form-label">Ville du registre</label>
                            <input
                              className="form-input"
                              placeholder="Ex : Paris"
                              value={profilArtisan.villeRCS}
                              onChange={e => setProfilArtisan({ ...profilArtisan, villeRCS: e.target.value })}
                            />
                          </div>
                        </div>

                        <div className="field-group">
                          <label className="form-label">N° TVA intracommunautaire</label>
                          <input
                            className="form-input"
                            placeholder="Ex : FR12 123 456 789"
                            value={profilArtisan.tvaIntra}
                            onChange={e => setProfilArtisan({ ...profilArtisan, tvaIntra: e.target.value })}
                          />
                        </div>

                        {/* Assurance décennale */}
                        <div
                          className="flex flex-col gap-3 p-3 rounded-lg"
                          style={{ border: '1.5px solid var(--accent-mid)', backgroundColor: 'var(--accent-light)' }}
                        >
                          <p className="text-xs font-bold uppercase tracking-widest flex items-center gap-1.5" style={{ color: 'var(--accent)' }}>
                            <ShieldCheck size={12} />
                            Assurance Décennale (obligatoire BTP)
                          </p>
                          <div className="field-group">
                            <label className="form-label">Nom de l'assureur</label>
                            <input
                              className="form-input"
                              placeholder="Ex : MAAF Assurances"
                              value={profilArtisan.assuranceNom}
                              onChange={e => setProfilArtisan({ ...profilArtisan, assuranceNom: e.target.value })}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="field-group">
                              <label className="form-label">Numéro de police</label>
                              <input
                                className="form-input"
                                placeholder="Ex : 1234567890"
                                value={profilArtisan.assuranceNumero}
                                onChange={e => setProfilArtisan({ ...profilArtisan, assuranceNumero: e.target.value })}
                              />
                            </div>
                            <div className="field-group">
                              <label className="form-label">Zone de couverture</label>
                              <input
                                className="form-input"
                                placeholder="Ex : France métropolitaine"
                                value={profilArtisan.assuranceZone}
                                onChange={e => setProfilArtisan({ ...profilArtisan, assuranceZone: e.target.value })}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>

                    <Card title="Informations du client" icon={<User size={14} />} initialOpen={true}>
                      <div className="flex flex-col gap-4">
                        {clientsList.length > 0 && (
                          <>
                            <label className="form-label">Sélectionner un client existant</label>
                            <select
                              className="form-input"
                              defaultValue=""
                              onChange={e => {
                                const found = clientsList.find(c => c.id === e.target.value);
                                if (found) {
                                  setRecepteur({ nom: found.name, adresse: found.address, email: found.email, tel: found.phone });
                                  setClientId(found.id);
                                }
                              }}
                            >
                              <option value="" disabled>Choisir un client…</option>
                              {clientsList.map(c => (
                                <option key={c.id} value={c.id}>{c.name}{c.email ? ` — ${c.email}` : ''}</option>
                              ))}
                            </select>
                            <div className="flex items-center gap-2 my-1">
                              <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                              <span className="text-xs text-slate-400">ou saisir manuellement</span>
                              <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                            </div>
                          </>
                        )}
                        <label className="form-label">Nom du client</label>
                        <input
                          className="form-input"
                          type="text"
                          inputMode="text"
                          autoComplete="name"
                          aria-label="Nom du client"
                          placeholder="Ex : Jean Dupont"
                          value={recepteur.nom}
                          onChange={e => setRecepteur({ ...recepteur, nom: e.target.value })}
                        />

                        <label className="form-label">Adresse du client</label>
                        <textarea
                          className="form-input"
                          autoComplete="street-address"
                          aria-label="Adresse du client"
                          placeholder="Ex : 7 avenue de la République, 75011 Paris"
                          value={recepteur.adresse}
                          rows={2}
                          onChange={e => setRecepteur({ ...recepteur, adresse: e.target.value })}
                        />

                        <label className="form-label">Email du client</label>
                        <input
                          className="form-input"
                          type="email"
                          inputMode="email"
                          autoComplete="email"
                          aria-label="Email du client"
                          placeholder="Ex : jean.dupont@email.com"
                          value={recepteur.email}
                          onChange={e => setRecepteur({ ...recepteur, email: e.target.value })}
                        />

                        <label className="form-label">Téléphone du client</label>
                        <input
                          className="form-input"
                          type="tel"
                          inputMode="tel"
                          autoComplete="tel"
                          aria-label="Téléphone du client"
                          placeholder="Ex : 06 78 90 12 34"
                          value={recepteur.tel}
                          onChange={e => setRecepteur({ ...recepteur, tel: e.target.value })}
                        />
                      </div>
                      <Button
                        onClick={async () => {
                          try {
                            if (!recepteur.nom.trim() || !recepteur.email.trim()) {
                              toast.error('Merci de renseigner un nom et un email pour le client.');
                              return;
                            }
                            const supabase = createClient();
                            const { data: { user } } = await supabase.auth.getUser();
                            if (!user) { toast.error('Vous devez être connecté.'); return; }
                            const existant = clientsList.find(
                              c => c.name.trim() === recepteur.nom.trim() && c.email.trim() === recepteur.email.trim()
                            );
                            if (existant) {
                              toast.info('Ce client est déjà enregistré.');
                              return;
                            }
                            const { data, error } = await supabase
                              .from('clients')
                              .insert({ name: recepteur.nom, address: recepteur.adresse, email: recepteur.email, phone: recepteur.tel, user_id: user.id })
                              .select()
                              .single();
                            if (error) {
                              toast.error("Erreur lors de l'enregistrement du client.");
                            } else if (data) {
                              setClientsList(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
                              toast.success('Client enregistré avec succès.');
                            }
                          } catch (e) {
                            toast.error("Erreur lors de l'enregistrement du client.");
                          }
                        }}
                        variant="primary"
                        size="md"
                        className="full-w"
                      >
                        Enregistrer le client
                      </Button>

                      <Button
                        onClick={() => { window.location.href = '/clients'; }}
                        variant="ghost"
                        size="sm"
                      >
                        Voir les clients enregistrés
                      </Button>
                    </Card>
                  </div>

                  <Card title="Titre & secteur d'activité" icon={<FileText size={14} />} initialOpen={true}>
                    <div className="flex flex-col gap-4">
                      {/* Titre personnalisable */}
                      <input
                        className="form-input"
                        value={titre}
                        onChange={e => setTitre(e.target.value)}
                        placeholder="Titre du devis"
                      />

                      {/* Menu déroulant de sélection */}
                      <label className="form-label">Secteur sélectionné</label>
                      <select
                        className="form-select"
                        value={secteurActif}
                        onChange={e => setSecteurActif(e.target.value)}
                      >
                        {secteurs.map(s => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>

                      <div className="flex flex-wrap gap-2">
                        {secteurs.map(s => (
                          <div
                            key={s}
                            className={`badge ${secteurActif === s ? 'active' : ''}`}
                            onClick={() => setSecteurActif(s)}
                          >
                            <span>{s}</span>
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                const updated = secteurs.filter(item => item !== s);
                                setSecteurs(updated);
                                localStorage.setItem('secteurs', JSON.stringify(updated));
                                if (secteurActif === s) setSecteurActif(updated[0] || '');
                              }}
                              style={{ marginLeft: '0.375rem', color: 'inherit', opacity: 0.7 }}
                              title="Supprimer ce métier"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>

                    </div>
                  </Card>
                  <Card title="Numéro de devis" icon={<Hash size={14} />}>
                    <div className="flex flex-col gap-4">
                      <div className="flex gap-2 items-center">
                        <input
                          className="form-input"
                          style={{ flex: 1, opacity: statut === 'finalise' ? 0.6 : 1 }}
                          value={numeroDevis}
                          readOnly={statut === 'finalise'}
                          onChange={e => setNumeroDevis(e.target.value)}
                          placeholder="Ex : D2025-001"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setNumeroDevis(previsualiserNumeroDevis())}
                          disabled={statut === 'finalise'}
                          title="Générer un numéro séquentiel automatique"
                        >
                          Générer
                        </Button>
                      </div>

                      {statut === 'brouillon' ? (
                        <div
                          className="flex flex-col gap-2 p-3 rounded-lg"
                          style={{ border: '1.5px solid var(--accent-mid)', backgroundColor: 'var(--accent-light)' }}
                        >
                          <p className="text-xs" style={{ color: 'var(--accent)', fontWeight: '600' }}>
                            Finalisation du devis
                          </p>
                          <p className="text-xs" style={{ color: 'var(--fg-muted)' }}>
                            Un numéro définitif sera assigné. Le devis deviendra en lecture seule.
                          </p>
                          <Button
                            variant="primary"
                            size="sm"
                            icon={<BadgeCheck size={14} />}
                            disabled={savingQuote}
                            onClick={() => {
                              askConfirm(
                                'Finaliser ce devis ? Il deviendra en lecture seule et recevra un numéro définitif.',
                                async () => {
                                  const supabase = createClient();
                                  const num = userId
                                    ? await genererNumeroDevisSupabase(supabase)
                                    : genererNumeroDevis();
                                  const now = new Date().toISOString();
                                  setNumeroDevis(num);
                                  setStatut('finalise');
                                  setDateFinalisation(now);

                                  const saved = await saveQuote({
                                    numero: num,
                                    statutFinal: 'finalise',
                                    finaliseAt: now,
                                    ht: totalHT,
                                    ttc: totalTTC,
                                  });

                                  if (saved) {
                                    toast.success(`Devis finalisé et sauvegardé — N° ${num}`);
                                  } else {
                                    toast.success(`Devis finalisé — N° ${num}`);
                                    if (userId) toast.error('Sauvegarde cloud échouée. Le devis est verrouillé localement.');
                                  }
                                }
                              );
                            }}
                          >
                            {savingQuote ? 'Enregistrement…' : 'Finaliser le devis'}
                          </Button>
                        </div>
                      ) : (
                        <div
                          className="flex items-center gap-2 p-3 rounded-lg"
                          style={{ border: '1px solid var(--border)', backgroundColor: 'var(--surface-2)' }}
                        >
                          <Lock size={14} style={{ color: 'var(--fg-muted)', flexShrink: 0 }} />
                          <div>
                            <p className="text-sm font-semibold" style={{ color: 'var(--fg)' }}>Devis finalisé</p>
                            <p className="text-xs" style={{ color: 'var(--fg-muted)' }}>
                              {dateFinalisation ? new Date(dateFinalisation).toLocaleDateString('fr-FR') : ''} — lecture seule
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => askConfirm('Repasser ce devis en brouillon ?', () => {
                              setStatut('brouillon');
                              setDateFinalisation(null);
                              toast.info('Devis repassé en brouillon.');
                            })}
                            style={{ marginLeft: 'auto' }}
                          >
                            Débloquer
                          </Button>
                        </div>
                      )}
                    </div>
                  </Card>

                  <div className="flex flex-col gap-4 sm:gap-6">
                      {/* 🟩 Bloc classique : main d'œuvre + pièces */}
                      <Card title="Prestations principales" icon={<Wrench size={14} />} initialOpen={true}>
                        <BlocMainOeuvre
                          lignes={lignesMainOeuvre}
                          setLignes={setLignesMainOeuvre}
                          afficher={afficherMainOeuvre}
                          setAfficher={setAfficherMainOeuvre}
                          nomCategorie={nomMainOeuvre}
                          setNomCategorie={setNomMainOeuvre}
                          secteurActif={secteurActif}
                          globalTvaTaux={tvaTaux}
                        />

                        <div className="section-divider" />

                        <BlocPieces
                          lignes={lignesPieces}
                          setLignes={setLignesPieces}
                          afficher={afficherPieces}
                          setAfficher={setAfficherPieces}
                          nomCategorie={nomPieces}
                          setNomCategorie={setNomPieces}
                          secteurActif={secteurActif}
                          globalTvaTaux={tvaTaux}
                        />
                      </Card>

                      {/* 🟦 Bloc séparé : catégories dynamiques */}
                      <Card title="Catégories personnalisées" icon={<LayoutGrid size={14} />}>
                        {/* 🔁 Catégories dynamiques en cours */}
                        {/* Bouton Aide accessible même sans catégorie */}
                        <div className="flex justify-end">
                          <Aide titre="Aide catégories dynamiques" contenu={aideCategorie} />
                        </div>
                        {categoriesDynamiques.map((cat, index) => (
                          <div key={index} className="mb-4 sm:mb-6">
                            <BlocCategorie
                              key={index}
                              categorie={cat}
                              onUpdate={updatedCat => {
                                const copie = [...categoriesDynamiques];
                                copie[index] = updatedCat;
                                setCategoriesDynamiques(copie);
                              }}
                              onDelete={() => {
                                const copie = [...categoriesDynamiques];
                                copie.splice(index, 1);
                                setCategoriesDynamiques(copie);
                              }}
                              onDemanderEdition={cat => {
                                setIndexCategorieEdition(index); // ✅ ajoute bien cette ligne
                                setModeModal('edition');
                                setCategorieEdition(cat); // cat = { nom, colonnes }
                                setShowModal(true);
                              }}
                            />

                            <Button
                              variant="ghost"
                              size="sm"
                              className="mt-4"
                              onClick={() => {
                                const cat = categoriesDynamiques[index];
                                if (!cat.nom || cat.colonnes.length === 0) {
                                  toast.error('Le nom ou les colonnes sont vides.');
                                  return;
                                }

                                const copie = [...categoriesSauvegardees];
                                const indexExistante = copie.findIndex(c => c.nom === cat.nom);

                                 const doSaveCategorie = () => {
                                   if (indexExistante !== -1) {
                                     copie[indexExistante] = { nom: cat.nom, colonnes: [...cat.colonnes], lignes: [...cat.lignes], emoji: cat.emoji };
                                   } else {
                                     copie.push({ nom: cat.nom, colonnes: [...cat.colonnes], lignes: [...cat.lignes], emoji: cat.emoji });
                                   }
                                   setCategoriesSauvegardees(copie);
                                   localStorage.setItem('categoriesSauvegardees', JSON.stringify(copie));
                                   toast.success('Catégorie enregistrée.');
                                 };
                                 if (indexExistante !== -1) {
                                   askConfirm(`La catégorie "${cat.nom}" existe déjà. La remplacer ?`, doSaveCategorie);
                                 } else {
                                   doSaveCategorie();
                                 }
                              }}
                            >
                              Sauvegarder cette catégorie
                            </Button>

                            {index < categoriesDynamiques.length - 1 && (
                              <div className="section-divider" />
                            )}
                          </div>
                        ))}

                        {/* ➕ Ajout d'une nouvelle catégorie */}
                        <div className="mt-10">
                          <Button
                            onClick={() => {
                              setModeModal('creation'); // ✅ on passe en mode création
                              setCategorieEdition(null); // ✅ pas de catégorie existante à éditer
                              setShowModal(true); // ✅ ouvre le modal
                            }}
                            variant="primary"
                            size="md"
                          >
                            Créer une catégorie
                          </Button>

                          {showModal && (
                            <ModalNouvelleCategorie
                              mode={modeModal}
                              initialCategorie={categorieEdition || undefined}
                              onClose={() => setShowModal(false)}
                              onCreate={cat => {
                                if (modeModal === 'creation') {
                                  setCategoriesDynamiques([...categoriesDynamiques, cat]);
                                } else if (indexCategorieEdition !== null) {
                                  const copie = [...categoriesDynamiques];
                                  copie[indexCategorieEdition] = {
                                    ...copie[indexCategorieEdition],
                                    colonnes: cat.colonnes,
                                    nom: cat.nom, // ✅ mise à jour du nom
                                  };
                                  setCategoriesDynamiques(copie);
                                }
                                setShowModal(false);
                                setIndexCategorieEdition(null);
                              }}
                            />
                          )}
                        </div>

                        {/* Catégories enregistrées */}
                        <div className="mt-6 sm:mt-10">
                          <h3
                            className="text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-1.5"
                            style={{ color: 'var(--fg-subtle)' }}
                          >
                            <LayoutGrid size={12} />
                            Catégories enregistrées
                          </h3>

                          {categoriesSauvegardees.length === 0 ? (
                            <div className="empty-state">
                              <p>Aucune catégorie enregistrée pour l'instant.</p>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-2">
                              {categoriesSauvegardees.map((cat, index) => (
                                <div
                                  key={index}
                                  className="flex justify-between items-center p-3 rounded-lg"
                                  style={{ border: '1px solid var(--border)', backgroundColor: 'var(--surface)' }}
                                >
                                  <span>
                                    {cat.emoji} {cat.nom}
                                  </span>
                                  <div className="flex gap-2">
                                    <Button
                                      variant="primary"
                                      size="md"
                                      onClick={() =>
                                        setCategoriesDynamiques([
                                          ...categoriesDynamiques,
                                          {
                                            nom: cat.nom,
                                            colonnes: [...cat.colonnes],
                                            lignes: cat.lignes
                                              ? cat.lignes.map(l => ({ ...l }))
                                              : [],
                                            afficher: true,
                                            emoji: cat.emoji,
                                          },
                                        ])
                                      }
                                    >
                                      Ajouter au devis
                                    </Button>
                                    <Button
                                      variant="danger"
                                      size="md"
                                      onClick={() => {
                                        askConfirm(`Supprimer la catégorie "${cat.nom}" ?`, () => {
                                          const copie = [...categoriesSauvegardees];
                                          copie.splice(index, 1);
                                          setCategoriesSauvegardees(copie);
                                          localStorage.setItem('categoriesSauvegardees', JSON.stringify(copie));
                                          toast.success('Catégorie supprimée.');
                                        });
                                      }}
                                    >
                                      Supprimer
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </Card>
                  </div>

                  <Card title="Fiscal & mentions légales" icon={<Scale size={14} />}>
                    <div className="flex flex-col gap-4">
                      <Aide titre="Aide" contenu={aideMentionsEtFisc} />

                      {/* Assujettissement TVA */}
                      <div
                        className="flex items-center justify-between p-3 rounded-lg"
                        style={{ border: '1px solid var(--border)', backgroundColor: 'var(--surface-2)' }}
                      >
                        <div>
                          <p className="text-sm font-semibold" style={{ color: 'var(--fg)' }}>Assujetti à la TVA</p>
                          <p className="text-xs" style={{ color: 'var(--fg-muted)' }}>
                            {sujetTVA ? 'TVA calculée et affichée dans le devis.' : 'Mention légale auto : art. 293 B du CGI'}
                          </p>
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input type="checkbox" checked={sujetTVA} onChange={e => setSujetTVA(e.target.checked)} className="sr-only" />
                          <div className={`toggle-track${sujetTVA ? ' on' : ''}`} onClick={() => setSujetTVA(!sujetTVA)}>
                            <div className="toggle-thumb" />
                          </div>
                        </label>
                      </div>

                      <label className="form-label">Mentions légales</label>
                      <textarea
                        className="form-input"
                        placeholder="Ex : Devis valable 15 jours..."
                        value={mentions}
                        onChange={e => setMentions(e.target.value)}
                      />
                      {!sujetTVA && (
                        <p className="text-xs px-2 py-1.5 rounded" style={{ backgroundColor: 'var(--accent-light)', color: 'var(--accent)', border: '1px solid var(--accent-mid)' }}>
                          Mention ajoutée automatiquement au PDF : « TVA non applicable, art. 293 B du CGI »
                        </p>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="field-group">
                          <label className="form-label" title="Taux de TVA global par défaut (par ligne si différent)">TVA par défaut (%)</label>
                          <input
                            type="number"
                            onWheel={e => e.currentTarget.blur()}
                            className="form-input"
                            disabled={!sujetTVA}
                            style={{ opacity: sujetTVA ? 1 : 0.4 }}
                            value={tvaTaux.toString()}
                            onChange={e => setTvaTaux(cleanNumericInput(e.target.value))}
                          />
                        </div>
                        <div className="field-group">
                          <label className="form-label" title="Réduction appliquée sur le montant HT avant TVA">Remise (%)</label>
                          <input
                            type="number"
                            onWheel={e => e.currentTarget.blur()}
                            className="form-input"
                            value={remisePourcent.toString()}
                            onChange={e => setRemisePourcent(cleanNumericInput(e.target.value))}
                          />
                        </div>
                        <div className="field-group">
                          <label className="form-label" title="Pourcentage demandé en avance sur le total TTC">Acompte (%)</label>
                          <input
                            type="number"
                            onWheel={e => e.currentTarget.blur()}
                            className="form-input"
                            value={acomptePourcent.toString()}
                            onChange={e => setAcomptePourcent(cleanNumericInput(e.target.value))}
                          />
                        </div>
                      </div>
                    </div>
                  </Card>

                  {/* ── Conditions commerciales ───────────────────────── */}
                  <Card title="Conditions commerciales" icon={<CalendarClock size={14} />}>
                    <div className="flex flex-col gap-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="field-group">
                          <label className="form-label">Durée de validité (jours)</label>
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
                        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                          <p className="text-xs" style={{ color: 'var(--fg-muted)' }}>
                            Le devis expire {dureeValidite} jours après sa date d'émission.
                          </p>
                        </div>
                      </div>

                      <div className="field-group">
                        <label className="form-label">Conditions de règlement</label>
                        <div className="flex flex-wrap gap-2 mb-2">
                          {[
                            '30 % à la signature, solde à réception.',
                            'Paiement comptant à la livraison.',
                            '50 % à la commande, 50 % à la réception.',
                            'Paiement à 30 jours date de facture.',
                          ].map(preset => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => setConditionsReglement(preset)}
                              className="text-xs px-2 py-1 rounded-md transition-all"
                              style={{
                                border: '1px solid var(--border)',
                                backgroundColor: conditionsReglement === preset ? 'var(--accent-light)' : 'var(--surface-2)',
                                color: conditionsReglement === preset ? 'var(--accent)' : 'var(--fg-muted)',
                                cursor: 'pointer',
                              }}
                            >
                              {preset.length > 30 ? preset.slice(0, 30) + '…' : preset}
                            </button>
                          ))}
                        </div>
                        <textarea
                          className="form-input"
                          rows={3}
                          placeholder="Ex : 30 % à la signature du devis, solde à la réception des travaux."
                          value={conditionsReglement}
                          onChange={e => setConditionsReglement(e.target.value)}
                        />
                      </div>
                    </div>
                  </Card>

                  {/* Paragraphe d'introduction */}
                  <Card title="Introduction & conclusion" icon={<AlignLeft size={14} />}>
                    <div className="flex flex-col gap-4">
                      <label className="form-label">
                        Texte d'introduction (facultatif)
                      </label>
                      <textarea
                        className="form-input"
                        placeholder="Ex : Merci pour votre confiance, voici le détail de notre proposition..."
                        value={intro}
                        onChange={e => setIntro(e.target.value)}
                      />

                      {/* Paragraphe de conclusion */}
                      <label className="form-label">
                        Remarques ou informations complémentaires (facultatif)
                      </label>
                      <textarea
                        className="form-input"
                        placeholder="Ex : N'hésitez pas à nous contacter pour toute question complémentaire."
                        value={conclusion}
                        onChange={e => setConclusion(e.target.value)}
                      />
                    </div>
                  </Card>

                  <Card title="Signature numérique" icon={<PenLine size={14} />}>
                    <div className="flex flex-col gap-4 sm:gap-6">
                      <SignatureBlock
                        label="✍️ Signature de l'émetteur"
                        value={signatureEmetteur}
                        onChange={setSignatureEmetteur}
                      />
                    </div>
                  </Card>


                  {/* Résumé des totaux */}

                  {/* Bouton d'export PDF */}

                  <Card title="Export & historique" icon={<Download size={14} />} initialOpen={true}>
                    <div className="flex flex-col gap-4">
                      <Button
                        onClick={async () => {
                          setExportEnCours(true);
                          try {
                            // ✅ Vérifs de base
                            if (!recepteur.nom.trim() || !recepteur.email.trim()) {
                              toast.error('Merci de renseigner un nom et un email client.');
                              return;
                            }

                            if (!lignesFinales || lignesFinales.length === 0) {
                              toast.error("Ajoutez au moins une ligne avant d'exporter.");
                              return;
                            }

                            const devisElement = document.getElementById('devis-final') as HTMLElement;
                            if (!devisElement) {
                              toast.error('Aperçu introuvable, rechargez la page.');
                              return;
                            }
                            await exporterPDF(devisElement);
                            toast.success('Devis exporté avec succès !');
                          } catch (e) {
                            toast.error("Erreur lors de l'export. Réessayez.");
                            console.error(e);
                          } finally {
                            setExportEnCours(false);
                          }
                        }}
                        disabled={exportEnCours}
                        variant="success"
                        size="lg"
                      >
                        {exportEnCours ? 'Génération en cours…' : 'Exporter le devis en PDF'}
                      </Button>
                      <div className="flex justify-center mt-3">
                        <Link href="/historique">
                          <Button variant="ghost" size="sm">
                            Voir l'historique des devis
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </Card>
                </div>
              </div>
            </div>
            {/* Aperçu PDF visible sur grand écran */}
            <div className="hidden lg:block">
              <div className="mx-auto w-[794px] sticky top-8">
                <p
                  className="text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-1.5"
                  style={{ color: 'var(--fg-subtle)' }}
                >
                  <FileText size={12} />
                  Aperçu du document
                </p>
                <PreviewDevis
                  logo={logo}
                  hauteurLogo={hauteurLogo}
                  numeroDevis={numeroDevis}
                  emetteur={emetteur}
                  recepteur={recepteur}
                  titre={titre}
                  intro={intro}
                  lignesMainOeuvre={lignesMainOeuvre}
                  lignesPieces={lignesPieces}
                  afficherMainOeuvre={afficherMainOeuvre}
                  afficherPieces={afficherPieces}
                  nomMainOeuvre={nomMainOeuvre}
                  nomPieces={nomPieces}
                  categoriesDynamiques={categoriesDynamiques}
                  totalHTBrut={totalHTBrut}
                  remise={remise}
                  remisePourcent={remisePourcent}
                  totalHT={totalHT}
                  tvaTaux={tvaTaux}
                  tva={tva}
                  totalTTC={totalTTC}
                  acompte={acompte}
                  acomptePourcent={acomptePourcent}
                  mentions={mentions}
                  conclusion={conclusion}
                  signatureClient={signatureClient}
                  signatureEmetteur={signatureEmetteur}
                  iban={iban}
                  bic={bic}
                  profilArtisan={profilArtisan}
                  sujetTVA={sujetTVA}
                  dureeValidite={dureeValidite}
                  conditionsReglement={conditionsReglement}
                  statut={statut}
                  dateFinalisation={dateFinalisation}
                  groupesTVA={groupesTVA}
                />
              </div>
            </div>

            {/* Aperçu PDF visible uniquement sur mobile avec scroll horizontal */}
            <div className="lg:hidden overflow-x-auto">
              <div className="min-w-[794px]">
                <PreviewDevis
                  logo={logo}
                  hauteurLogo={hauteurLogo}
                  numeroDevis={numeroDevis}
                  emetteur={emetteur}
                  recepteur={recepteur}
                  titre={titre}
                  intro={intro}
                  lignesMainOeuvre={lignesMainOeuvre}
                  lignesPieces={lignesPieces}
                  afficherMainOeuvre={afficherMainOeuvre}
                  afficherPieces={afficherPieces}
                  nomMainOeuvre={nomMainOeuvre}
                  nomPieces={nomPieces}
                  categoriesDynamiques={categoriesDynamiques}
                  totalHTBrut={totalHTBrut}
                  remise={remise}
                  remisePourcent={remisePourcent}
                  totalHT={totalHT}
                  tvaTaux={tvaTaux}
                  tva={tva}
                  totalTTC={totalTTC}
                  acompte={acompte}
                  acomptePourcent={acomptePourcent}
                  mentions={mentions}
                  conclusion={conclusion}
                  signatureClient={signatureClient}
                  signatureEmetteur={signatureEmetteur}
                  iban={iban}
                  bic={bic}
                  profilArtisan={profilArtisan}
                  sujetTVA={sujetTVA}
                  dureeValidite={dureeValidite}
                  conditionsReglement={conditionsReglement}
                  statut={statut}
                  dateFinalisation={dateFinalisation}
                  groupesTVA={groupesTVA}
                />
              </div>
            </div>
          </div>

          {mode === 'devis' && (
            <div className="fixed bottom-4 right-4 z-50 lg:hidden">
              <Button
                onClick={() => setAfficherPDFMobile(prev => !prev)}
                variant="primary"
                size="sm"
              >
                {afficherPDFMobile ? 'Fermer PDF' : "Voir l'aperçu PDF"}
              </Button>
            </div>
          )}

          {afficherPDFMobile && (
            <div className="fixed inset-0 overflow-auto z-40 p-4 lg:hidden" style={{ backgroundColor: 'var(--bg)' }}>
              <div className="flex justify-end mb-4">
                <Button onClick={() => setAfficherPDFMobile(false)} variant="primary" size="sm">
                  ✖ Fermer l'aperçu
                </Button>
              </div>

              <div className="overflow-x-auto">
                <PreviewDevis
                  logo={logo}
                  hauteurLogo={hauteurLogo}
                  numeroDevis={numeroDevis}
                  emetteur={emetteur}
                  recepteur={recepteur}
                  titre={titre}
                  intro={intro}
                  lignesMainOeuvre={lignesMainOeuvre}
                  lignesPieces={lignesPieces}
                  afficherMainOeuvre={afficherMainOeuvre}
                  afficherPieces={afficherPieces}
                  nomMainOeuvre={nomMainOeuvre}
                  nomPieces={nomPieces}
                  categoriesDynamiques={categoriesDynamiques}
                  totalHTBrut={totalHTBrut}
                  remise={remise}
                  remisePourcent={remisePourcent}
                  totalHT={totalHT}
                  tvaTaux={tvaTaux}
                  tva={tva}
                  totalTTC={totalTTC}
                  acompte={acompte}
                  acomptePourcent={acomptePourcent}
                  mentions={mentions}
                  conclusion={conclusion}
                  signatureClient={signatureClient}
                  signatureEmetteur={signatureEmetteur}
                  iban={iban}
                  bic={bic}
                  profilArtisan={profilArtisan}
                  sujetTVA={sujetTVA}
                  dureeValidite={dureeValidite}
                  conditionsReglement={conditionsReglement}
                  statut={statut}
                  dateFinalisation={dateFinalisation}
                  groupesTVA={groupesTVA}
                />
              </div>
            </div>
          )}
        </main>
      )}

      {/* Confirm dialog */}
      {confirmState && (
        <ConfirmDialog
          message={confirmState.message}
          onConfirm={() => { confirmState.onConfirm(); setConfirmState(null); }}
          onCancel={() => setConfirmState(null)}
        />
      )}
    </>
  );
}
