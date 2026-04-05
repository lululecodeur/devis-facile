import React from 'react';

type LigneMainOeuvre = {
  designation: string;
  unite: string;
  mode: 'fixe' | 'horaire';
  prixFixe: number | string;
  prixHoraire: number | string;
  heures: number | string;
  tvaTaux?: number;
};

type LignePiece = {
  designation: string;
  unite: string;
  mode: 'manuel' | 'calculé';
  prixManuel?: number | string;
  prixAchat: number | string;
  margePourcent: number | string;
  quantite: number | string;
  tvaTaux?: number;
};

type ColonneCategorie = {
  nom: string;
  type: 'texte' | 'quantite' | 'prix' | 'prixAvecMarge';
};

type CategorieDynamique = {
  nom: string;
  colonnes: ColonneCategorie[];
  lignes: { [key: string]: any }[];
  afficher: boolean;
  emoji?: string;
};

type GroupeTVA = {
  taux: number;
  baseHT: number;
  montantTVA: number;
};

type ProfilArtisan = {
  formeJuridique: string;
  villeRCS: string;
  typeRegistre: 'RCS' | 'RM';
  assuranceNom: string;
  assuranceNumero: string;
  assuranceZone: string;
  capital: string;
  tvaIntra: string;
};

type PreviewDevisProps = {
  logo?: string | null;
  hauteurLogo: number;
  numeroDevis?: string;
  emetteur: {
    nom: string;
    adresse?: string;
    siret?: string;
    email?: string;
    tel?: string;
  };
  recepteur: {
    nom: string;
    adresse?: string;
    email?: string;
    tel?: string;
  };
  titre: string;
  intro?: string;
  lignesMainOeuvre: LigneMainOeuvre[];
  lignesPieces: LignePiece[];
  afficherMainOeuvre: boolean;
  afficherPieces: boolean;
  nomMainOeuvre: string;
  nomPieces: string;
  categoriesDynamiques: CategorieDynamique[];
  totalHTBrut: number;
  remise: number;
  remisePourcent: number;
  totalHT: number;
  tvaTaux: number;
  tva: number;
  totalTTC: number;
  acompte: number;
  acomptePourcent: number;
  mentions: string;
  conclusion: string;
  signatureClient?: string | null;
  signatureEmetteur?: string | null;
  iban?: string;
  bic?: string;
  // BTP compliance
  profilArtisan?: ProfilArtisan;
  sujetTVA?: boolean;
  dureeValidite?: number;
  conditionsReglement?: string;
  statut?: 'brouillon' | 'finalise';
  dateFinalisation?: string | null;
  groupesTVA?: GroupeTVA[];
};

// ─── Colour palette (all print-safe) ───────────────────────────────────────
const C = {
  navy:        '#1a3557',
  navyMid:     '#2d5080',
  navyLight:   '#e8edf5',
  border:      '#d1d9e6',
  rowAlt:      '#f7f9fc',
  textPrimary: '#1a1f2e',
  textSecond:  '#4a5568',
  textMuted:   '#718096',
  surface:     '#f9fafc',
  white:       '#ffffff',
  ttcBg:       '#1a3557',
  ttcText:     '#ffffff',
  accentGreen: '#166534',
  accentGreenBg: '#dcfce7',
  footerBg:    '#f0f4f8',
};

export default function PreviewDevis(props: PreviewDevisProps) {
  const {
    logo, hauteurLogo, numeroDevis, emetteur, recepteur,
    titre, intro, lignesMainOeuvre, lignesPieces,
    afficherMainOeuvre, afficherPieces, nomMainOeuvre, nomPieces,
    categoriesDynamiques, totalHTBrut, remise, remisePourcent,
    totalHT, tvaTaux, tva, totalTTC, acompte, acomptePourcent,
    mentions, conclusion, signatureClient, signatureEmetteur, iban, bic,
    profilArtisan,
    sujetTVA = true,
    dureeValidite = 30,
    conditionsReglement = '',
    statut = 'brouillon',
    dateFinalisation,
    groupesTVA = [],
  } = props;

  // ── helpers ──────────────────────────────────────────────────────────────
  const EI_FORMES = ['Auto-entrepreneur', 'Entreprise Individuelle'];
  const nomEmetteur = profilArtisan && EI_FORMES.includes(profilArtisan.formeJuridique)
    ? `${emetteur.nom} EI`
    : emetteur.nom;

  const fmt = (val: any): string => {
    const n = typeof val === 'string' ? parseFloat(val.replace(',', '.')) : Number(val);
    return isNaN(n)
      ? '0,00'
      : new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  };

  const parse = (val: string | number | undefined | null): number =>
    typeof val === 'number' ? val : parseFloat((val?.toString() ?? '').replace(',', '.')) || 0;

  const toFloat = (val: string | number): number =>
    typeof val === 'number' ? val : parseFloat(val.replace(',', '.')) || 0;

  const colWidth = (idx: number, total: number) =>
    idx === 0 ? '42%' : `${58 / total}%`;

  const today = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  // Expiry date
  const expiryDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() + dureeValidite);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  })();

  // ── sub-components ───────────────────────────────────────────────────────

  const SectionHeader = ({ label, colSpan = 5 }: { label: string; colSpan?: number }) => (
    <tr>
      <td
        colSpan={colSpan}
        style={{
          backgroundColor: C.navy,
          color: C.white,
          fontWeight: '700',
          fontSize: '12px',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          padding: '9px 12px',
          WebkitPrintColorAdjust: 'exact',
          printColorAdjust: 'exact',
        }}
      >
        {label}
      </td>
    </tr>
  );

  const ColHeader = ({ cols }: { cols: string[] }) => (
    <tr style={{ backgroundColor: C.navyLight, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' } as any}>
      {cols.map((c, i) => (
        <th
          key={i}
          style={{
            padding: '7px 10px',
            fontWeight: '600',
            fontSize: '11px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: C.navyMid,
            textAlign: i === 0 ? 'left' : 'center',
            borderBottom: `2px solid ${C.border}`,
            whiteSpace: 'nowrap',
          }}
        >
          {c}
        </th>
      ))}
    </tr>
  );

  const Td = ({
    children, first = false, bold = false, rowIdx = 0,
  }: { children: React.ReactNode; first?: boolean; last?: boolean; bold?: boolean; rowIdx?: number }) => (
    <td
      style={{
        padding: '8px 10px',
        fontSize: '13px',
        color: C.textPrimary,
        fontWeight: bold ? '600' : '400',
        textAlign: first ? 'left' : 'center',
        verticalAlign: 'middle',
        borderBottom: `1px solid ${C.border}`,
        backgroundColor: rowIdx % 2 === 0 ? C.white : C.rowAlt,
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact',
        wordBreak: 'break-word',
      }}
    >
      {children}
    </td>
  );

  // Build legal footer string
  const legalParts: string[] = [];
  if (nomEmetteur) legalParts.push(nomEmetteur);
  if (profilArtisan?.formeJuridique) {
    let fjPart = profilArtisan.formeJuridique;
    if (profilArtisan.capital) fjPart += ` — Capital : ${profilArtisan.capital} €`;
    legalParts.push(fjPart);
  }
  if (emetteur.siret) legalParts.push(`SIRET : ${emetteur.siret}`);
  if (profilArtisan?.villeRCS) legalParts.push(`${profilArtisan.typeRegistre} ${profilArtisan.villeRCS}`);
  if (profilArtisan?.tvaIntra) legalParts.push(`TVA intracommunautaire : ${profilArtisan.tvaIntra}`);
  if (!sujetTVA) legalParts.push('TVA non applicable, art. 293 B du CGI');

  const assuranceParts: string[] = [];
  if (profilArtisan?.assuranceNom) {
    assuranceParts.push(`Assurance décennale : ${profilArtisan.assuranceNom}`);
    if (profilArtisan.assuranceNumero) assuranceParts.push(`N° ${profilArtisan.assuranceNumero}`);
    if (profilArtisan.assuranceZone) assuranceParts.push(`Zone : ${profilArtisan.assuranceZone}`);
  }

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div
      id="devis-final"
      style={{
        width: '794px',
        minHeight: '1123px',
        backgroundColor: C.white,
        color: C.textPrimary,
        fontFamily: '"Helvetica Neue", Arial, sans-serif',
        fontSize: '13px',
        lineHeight: '1.55',
        boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
        borderRadius: '4px',
        overflow: 'hidden',
        margin: '0 auto',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* ── TOP ACCENT BAR ─────────────────────────────────────────────── */}
      <div style={{ height: '5px', backgroundColor: C.navy, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' } as any} />

      {/* ── FINALISE BANNER ─────────────────────────────────────────────── */}
      {statut === 'finalise' && (
        <div style={{
          backgroundColor: C.accentGreenBg,
          borderBottom: `1px solid #86efac`,
          padding: '6px 40px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          WebkitPrintColorAdjust: 'exact',
          printColorAdjust: 'exact',
        } as any}>
          <span style={{ fontSize: '11px', fontWeight: '700', color: C.accentGreen, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            ✓ Devis finalisé
          </span>
          {dateFinalisation && (
            <span style={{ fontSize: '11px', color: C.accentGreen }}>
              — émis le {new Date(dateFinalisation).toLocaleDateString('fr-FR')}
            </span>
          )}
        </div>
      )}

      {/* ── HEADER: Logo + DEVIS stamp ──────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          padding: '28px 40px 20px',
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        {/* Logo or company name */}
        <div style={{ flex: 1 }}>
          {logo ? (
            <img
              src={logo}
              alt="Logo"
              style={{ height: `${Math.min(hauteurLogo, 100)}px`, maxHeight: '100px', objectFit: 'contain', maxWidth: '240px' }}
            />
          ) : (
            nomEmetteur ? (
              <div style={{ fontSize: '20px', fontWeight: '800', color: C.navy, letterSpacing: '-0.01em' }}>
                {nomEmetteur}
              </div>
            ) : (
              <div style={{ width: '120px', height: '40px', backgroundColor: C.navyLight, borderRadius: '4px' }} />
            )
          )}
        </div>

        {/* DEVIS stamp */}
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div
            style={{
              display: 'inline-block',
              backgroundColor: C.navy,
              color: C.white,
              fontSize: '22px',
              fontWeight: '800',
              letterSpacing: '0.12em',
              padding: '6px 20px',
              borderRadius: '3px',
              marginBottom: '8px',
              WebkitPrintColorAdjust: 'exact',
              printColorAdjust: 'exact',
            }}
          >
            DEVIS
          </div>
          <div style={{ fontSize: '12px', color: C.textMuted, lineHeight: '1.8' }}>
            {numeroDevis && (
              <div style={{ fontWeight: '700', color: C.textPrimary, fontSize: '13px' }}>
                N° {numeroDevis}
              </div>
            )}
            <div>Date d'émission : {today}</div>
            <div>Valable jusqu'au : <strong>{expiryDate}</strong></div>
          </div>
        </div>
      </div>

      {/* ── EMETTEUR / CLIENT ───────────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '0',
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        {/* Emetteur */}
        <div style={{ padding: '20px 24px 20px 40px', borderRight: `1px solid ${C.border}` }}>
          <div style={{ fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', color: C.textMuted, marginBottom: '8px' }}>
            Émis par
          </div>
          {nomEmetteur && (
            <div style={{ fontWeight: '700', fontSize: '14px', color: C.textPrimary, marginBottom: '4px' }}>{nomEmetteur}</div>
          )}
          {emetteur.adresse && (
            <div style={{ fontSize: '12px', color: C.textSecond, whiteSpace: 'pre-line', marginBottom: '3px' }}>{emetteur.adresse}</div>
          )}
          {emetteur.siret && (
            <div style={{ fontSize: '11px', color: C.textMuted, marginBottom: '2px' }}>SIRET : {emetteur.siret}</div>
          )}
          {emetteur.email && (
            <div style={{ fontSize: '12px', color: C.textSecond, marginBottom: '2px' }}>{emetteur.email}</div>
          )}
          {emetteur.tel && (
            <div style={{ fontSize: '12px', color: C.textSecond, marginBottom: '2px' }}>{emetteur.tel}</div>
          )}
          {(iban || bic) && (
            <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: `1px solid ${C.border}` }}>
              {iban && <div style={{ fontSize: '11px', color: C.textMuted }}>IBAN : {iban}</div>}
              {bic && <div style={{ fontSize: '11px', color: C.textMuted }}>BIC : {bic}</div>}
            </div>
          )}
        </div>

        {/* Client */}
        <div style={{ padding: '20px 40px 20px 24px', backgroundColor: C.surface }}>
          <div style={{ fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', color: C.textMuted, marginBottom: '8px' }}>
            Destinataire
          </div>
          {recepteur.nom ? (
            <div style={{ fontWeight: '700', fontSize: '14px', color: C.textPrimary, marginBottom: '4px' }}>{recepteur.nom}</div>
          ) : (
            <div style={{ fontSize: '13px', color: C.textMuted, fontStyle: 'italic' }}>Client non renseigné</div>
          )}
          {recepteur.adresse && (
            <div style={{ fontSize: '12px', color: C.textSecond, whiteSpace: 'pre-line', marginBottom: '3px' }}>{recepteur.adresse}</div>
          )}
          {recepteur.email && (
            <div style={{ fontSize: '12px', color: C.textSecond, marginBottom: '2px' }}>{recepteur.email}</div>
          )}
          {recepteur.tel && (
            <div style={{ fontSize: '12px', color: C.textSecond }}>{recepteur.tel}</div>
          )}
        </div>
      </div>

      {/* ── OBJET + INTRO ──────────────────────────────────────────────── */}
      <div style={{ padding: '20px 40px', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: intro ? '10px' : '0' }}>
          <span style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: C.textMuted, flexShrink: 0 }}>
            Objet
          </span>
          <span style={{ fontWeight: '700', fontSize: '15px', color: C.textPrimary }}>
            {titre || 'Devis'}
          </span>
        </div>
        {intro && (
          <p style={{ fontSize: '12px', color: C.textSecond, fontStyle: 'italic', lineHeight: '1.6', margin: '0', whiteSpace: 'pre-wrap' }}>
            {intro}
          </p>
        )}
      </div>

      {/* ── LINE ITEMS TABLE ────────────────────────────────────────────── */}
      <div style={{ padding: '0 40px' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            marginTop: '20px',
            tableLayout: 'fixed',
            border: `1px solid ${C.border}`,
            borderRadius: '4px',
            overflow: 'hidden',
          }}
        >
          <tbody>
            {/* ── MAIN D'ŒUVRE ────────────────────────────────────────── */}
            {lignesMainOeuvre.length > 0 && afficherMainOeuvre && (
              <>
                <SectionHeader label={nomMainOeuvre} />
                <ColHeader cols={['Désignation', 'Unité', 'Qté', 'PU HT', 'Total HT']} />
                {lignesMainOeuvre.map((ligne, idx) => {
                  const pu = ligne.mode === 'fixe' ? toFloat(ligne.prixFixe) : toFloat(ligne.prixHoraire);
                  const qte = ligne.mode === 'fixe' ? 1 : toFloat(ligne.heures);
                  return (
                    <tr key={`mo-${idx}`} style={{ backgroundColor: idx % 2 === 0 ? C.white : C.rowAlt } as any}>
                      <Td first rowIdx={idx}>{ligne.designation || <em style={{ color: C.textMuted }}>—</em>}</Td>
                      <Td rowIdx={idx}>{ligne.unite || '—'}</Td>
                      <Td rowIdx={idx}>{qte}</Td>
                      <Td rowIdx={idx}>{fmt(pu)} €</Td>
                      <Td rowIdx={idx} bold>{fmt(pu * qte)} €</Td>
                    </tr>
                  );
                })}
              </>
            )}

            {/* ── PIÈCES ─────────────────────────────────────────────── */}
            {lignesPieces.length > 0 && afficherPieces && (
              <>
                <SectionHeader label={nomPieces} />
                <ColHeader cols={['Désignation', 'Unité', 'Qté', 'PU HT', 'Total HT']} />
                {lignesPieces.map((ligne, idx) => {
                  const prix = ligne.mode === 'manuel'
                    ? parse(ligne.prixManuel)
                    : parse(ligne.prixAchat) * (1 + parse(ligne.margePourcent) / 100);
                  const qte = parse(ligne.quantite) || 1;
                  return (
                    <tr key={`p-${idx}`} style={{ backgroundColor: idx % 2 === 0 ? C.white : C.rowAlt } as any}>
                      <Td first rowIdx={idx}>{ligne.designation || <em style={{ color: C.textMuted }}>—</em>}</Td>
                      <Td rowIdx={idx}>{ligne.unite || '—'}</Td>
                      <Td rowIdx={idx}>{qte}</Td>
                      <Td rowIdx={idx}>{fmt(prix)} €</Td>
                      <Td rowIdx={idx} bold>{fmt(prix * qte)} €</Td>
                    </tr>
                  );
                })}
              </>
            )}
          </tbody>
        </table>

        {/* ── DYNAMIC CATEGORIES ──────────────────────────────────────── */}
        {categoriesDynamiques.map((cat, i) =>
          cat.afficher && cat.lignes.length > 0 ? (
            <table
              key={i}
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                tableLayout: 'fixed',
                marginTop: '16px',
                border: `1px solid ${C.border}`,
                fontSize: '13px',
                wordBreak: 'break-word',
              }}
            >
              <colgroup>
                {cat.colonnes.map((_, idx) => (
                  <col key={idx} style={{ width: colWidth(idx, cat.colonnes.length) }} />
                ))}
                <col style={{ width: colWidth(cat.colonnes.length, cat.colonnes.length) }} />
              </colgroup>
              <thead>
                <SectionHeader label={`${cat.emoji ? cat.emoji + ' ' : ''}${cat.nom}`} colSpan={cat.colonnes.length + 1} />
                <tr style={{ backgroundColor: C.navyLight, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' } as any}>
                  {cat.colonnes.map((col, idx) => (
                    <th
                      key={idx}
                      style={{
                        padding: '7px 10px',
                        fontWeight: '600',
                        fontSize: '11px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: C.navyMid,
                        textAlign: idx === 0 ? 'left' : 'center',
                        borderBottom: `2px solid ${C.border}`,
                      }}
                    >
                      {col.nom}
                    </th>
                  ))}
                  <th
                    style={{
                      padding: '7px 10px',
                      fontWeight: '600',
                      fontSize: '11px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: C.navyMid,
                      textAlign: 'center',
                      borderBottom: `2px solid ${C.border}`,
                    }}
                  >
                    Total HT
                  </th>
                </tr>
              </thead>
              <tbody>
                {cat.lignes.map((ligne, j) => (
                  <tr key={j} style={{ backgroundColor: j % 2 === 0 ? C.white : C.rowAlt } as any}>
                    {cat.colonnes.map((col, idx) => {
                      let val = ligne[col.nom];
                      if (col.type === 'prixAvecMarge') {
                        const achat = Number(ligne[col.nom + '_achat'] ?? 0);
                        const marge = Number(ligne[col.nom + '_marge'] ?? 0);
                        val = fmt(achat * (1 + marge / 100));
                      } else if (col.type === 'prix') {
                        val = fmt(val);
                      }
                      return (
                        <td
                          key={idx}
                          style={{
                            padding: '8px 10px',
                            fontSize: '13px',
                            color: C.textPrimary,
                            textAlign: idx === 0 ? 'left' : 'center',
                            verticalAlign: 'middle',
                            borderBottom: `1px solid ${C.border}`,
                            WebkitPrintColorAdjust: 'exact',
                            printColorAdjust: 'exact',
                          }}
                        >
                          {val ?? '\u00A0'}
                        </td>
                      );
                    })}
                    <td
                      style={{
                        padding: '8px 10px',
                        fontSize: '13px',
                        fontWeight: '600',
                        color: C.textPrimary,
                        textAlign: 'center',
                        verticalAlign: 'middle',
                        borderBottom: `1px solid ${C.border}`,
                        WebkitPrintColorAdjust: 'exact',
                        printColorAdjust: 'exact',
                      }}
                    >
                      {(() => {
                        let pu = 0;
                        const qCol = cat.colonnes.find(c => c.type === 'quantite');
                        const qte = qCol ? Number(ligne[qCol.nom]) || 0 : 1;
                        for (const col of cat.colonnes) {
                          if (col.type === 'prix') pu += Number(ligne[col.nom] ?? 0);
                          else if (col.type === 'prixAvecMarge') {
                            pu += Number(ligne[col.nom + '_achat'] ?? 0) * (1 + Number(ligne[col.nom + '_marge'] ?? 0) / 100);
                          }
                        }
                        return `${fmt(pu * qte)} €`;
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null
        )}
      </div>

      {/* ── TOTAUX + MENTIONS ───────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: '32px',
          padding: '24px 40px',
          marginTop: '8px',
          borderTop: `1px solid ${C.border}`,
        }}
      >
        {/* Left: mentions + conditions */}
        <div style={{ flex: 1.5, display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {conditionsReglement && (
            <div>
              <div style={{ fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', color: C.textMuted, marginBottom: '4px' }}>
                Conditions de règlement
              </div>
              <p style={{ fontSize: '11px', color: C.textSecond, margin: 0, lineHeight: '1.6' }}>{conditionsReglement}</p>
            </div>
          )}
          {mentions.trim() && (
            <div>
              <div style={{ fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', color: C.textMuted, marginBottom: '4px' }}>
                Mentions légales
              </div>
              <p style={{ fontSize: '11px', color: C.textSecond, whiteSpace: 'pre-wrap', lineHeight: '1.6', margin: 0 }}>
                {mentions}
              </p>
            </div>
          )}
          {!sujetTVA && (
            <p style={{ fontSize: '11px', color: C.textSecond, fontStyle: 'italic', margin: 0 }}>
              TVA non applicable, art. 293 B du CGI
            </p>
          )}
        </div>

        {/* Right: totals table */}
        <div style={{ flexShrink: 0, minWidth: '240px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', border: `1px solid ${C.border}` }}>
            <tbody>
              {remise > 0 && (
                <>
                  <tr>
                    <td style={{ padding: '8px 12px', fontSize: '12px', color: C.textSecond, fontWeight: '500', borderBottom: `1px solid ${C.border}`, borderRight: `1px solid ${C.border}` }}>
                      Total HT brut
                    </td>
                    <td style={{ padding: '8px 12px', fontSize: '12px', color: C.textPrimary, textAlign: 'right', borderBottom: `1px solid ${C.border}` }}>
                      {fmt(totalHTBrut)} €
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '8px 12px', fontSize: '12px', color: C.textSecond, fontWeight: '500', borderBottom: `1px solid ${C.border}`, borderRight: `1px solid ${C.border}` }}>
                      Remise ({remisePourcent}%)
                    </td>
                    <td style={{ padding: '8px 12px', fontSize: '12px', color: C.textPrimary, textAlign: 'right', borderBottom: `1px solid ${C.border}` }}>
                      −{fmt(remise)} €
                    </td>
                  </tr>
                </>
              )}
              <tr>
                <td style={{ padding: '8px 12px', fontSize: '12px', color: C.textSecond, fontWeight: '500', borderBottom: `1px solid ${C.border}`, borderRight: `1px solid ${C.border}` }}>
                  Total HT
                </td>
                <td style={{ padding: '8px 12px', fontSize: '12px', color: C.textPrimary, textAlign: 'right', borderBottom: `1px solid ${C.border}` }}>
                  {fmt(totalHT)} €
                </td>
              </tr>

              {/* Multi-rate TVA breakdown */}
              {sujetTVA && groupesTVA.length > 0 ? (
                groupesTVA.map((g, i) => (
                  <tr key={i}>
                    <td style={{ padding: '8px 12px', fontSize: '12px', color: C.textSecond, fontWeight: '500', borderBottom: `1px solid ${C.border}`, borderRight: `1px solid ${C.border}` }}>
                      {g.taux === 0
                        ? 'Autoliquidation (Art. 242 nonies A)'
                        : <>{`TVA ${g.taux}%`} <span style={{ fontSize: '10px', color: C.textMuted }}>(base {fmt(g.baseHT)} €)</span></>
                      }
                    </td>
                    <td style={{ padding: '8px 12px', fontSize: '12px', color: C.textPrimary, textAlign: 'right', borderBottom: `1px solid ${C.border}` }}>
                      {fmt(g.montantTVA)} €
                    </td>
                  </tr>
                ))
              ) : sujetTVA ? (
                <tr>
                  <td style={{ padding: '8px 12px', fontSize: '12px', color: C.textSecond, fontWeight: '500', borderBottom: `1px solid ${C.border}`, borderRight: `1px solid ${C.border}` }}>
                    TVA ({tvaTaux}%)
                  </td>
                  <td style={{ padding: '8px 12px', fontSize: '12px', color: C.textPrimary, textAlign: 'right', borderBottom: `1px solid ${C.border}` }}>
                    {fmt(tva)} €
                  </td>
                </tr>
              ) : (
                <tr>
                  <td style={{ padding: '8px 12px', fontSize: '12px', color: C.textSecond, fontStyle: 'italic', borderBottom: `1px solid ${C.border}`, borderRight: `1px solid ${C.border}` }}>
                    TVA non applicable
                  </td>
                  <td style={{ padding: '8px 12px', fontSize: '12px', color: C.textMuted, textAlign: 'right', borderBottom: `1px solid ${C.border}` }}>
                    —
                  </td>
                </tr>
              )}

              <tr style={{ backgroundColor: C.ttcBg, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' } as any}>
                <td style={{ padding: '10px 12px', fontSize: '13px', color: C.white, fontWeight: '700', borderRight: `1px solid rgba(255,255,255,0.2)` }}>
                  Total TTC
                </td>
                <td style={{ padding: '10px 12px', fontSize: '14px', color: C.white, fontWeight: '800', textAlign: 'right' }}>
                  {fmt(totalTTC)} €
                </td>
              </tr>
              {acompte > 0 && (
                <tr>
                  <td style={{ padding: '8px 12px', fontSize: '12px', color: C.textSecond, fontWeight: '500', borderTop: `1px solid ${C.border}`, borderRight: `1px solid ${C.border}` }}>
                    Acompte ({acomptePourcent}%)
                  </td>
                  <td style={{ padding: '8px 12px', fontSize: '12px', color: C.textPrimary, textAlign: 'right', borderTop: `1px solid ${C.border}` }}>
                    {fmt(acompte)} €
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── CONCLUSION ─────────────────────────────────────────────────── */}
      {conclusion && (
        <div style={{ padding: '0 40px 20px', borderTop: `1px solid ${C.border}` }}>
          <p style={{ fontSize: '12px', color: C.textSecond, whiteSpace: 'pre-wrap', lineHeight: '1.6', margin: '16px 0 0' }}>
            {conclusion}
          </p>
        </div>
      )}

      {/* ── BON POUR ACCORD ────────────────────────────────────────────── */}
      <div
        style={{
          margin: '0 40px 0',
          padding: '20px',
          border: `1.5px solid ${C.border}`,
          borderRadius: '4px',
          backgroundColor: C.surface,
          WebkitPrintColorAdjust: 'exact',
          printColorAdjust: 'exact',
        } as any}
      >
        <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: C.textMuted, marginBottom: '10px' }}>
          Bon pour accord
        </div>
        <p style={{ fontSize: '11px', color: C.textSecond, margin: '0 0 16px', lineHeight: '1.6' }}>
          Je soussigné(e) <strong>{recepteur.nom || '………………………………'}</strong>, certifie avoir pris connaissance et accepter sans réserve les conditions du présent devis d'un montant total de <strong>{fmt(totalTTC)} € TTC</strong>, valable jusqu'au {expiryDate}.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          {[
            { label: 'Signature du client (précédée de « Bon pour accord »)', sig: signatureClient },
            { label: "Signature et cachet de l'entreprise", sig: signatureEmetteur },
          ].map(({ label, sig }) => (
            <div key={label}>
              <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', color: C.textMuted, marginBottom: '8px' }}>
                {label}
              </div>
              <div style={{ fontSize: '10px', color: C.textMuted, marginBottom: '6px' }}>
                Date : ___________
              </div>
              {sig ? (
                <img src={sig} alt={label} style={{ height: '70px', maxWidth: '100%' }} />
              ) : (
                <div style={{ height: '60px', borderBottom: `1.5px solid ${C.border}`, width: '100%' }} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── LEGAL FOOTER ───────────────────────────────────────────────── */}
      <div style={{ marginTop: 'auto' }}>
        <div
          style={{
            backgroundColor: C.footerBg,
            borderTop: `1px solid ${C.border}`,
            padding: '14px 40px',
            WebkitPrintColorAdjust: 'exact',
            printColorAdjust: 'exact',
          } as any}
        >
          <p style={{ fontSize: '9.5px', color: C.textMuted, margin: '0 0 4px', lineHeight: '1.7' }}>
            {legalParts.join(' · ')}
          </p>
          {assuranceParts.length > 0 && (
            <p style={{ fontSize: '9.5px', color: C.textMuted, margin: '0', lineHeight: '1.7' }}>
              {assuranceParts.join(' · ')}
            </p>
          )}
        </div>

        {/* ── BOTTOM ACCENT BAR ─────────────────────────────────────── */}
        <div style={{ height: '4px', backgroundColor: C.navy, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' } as any} />
      </div>
    </div>
  );
}
