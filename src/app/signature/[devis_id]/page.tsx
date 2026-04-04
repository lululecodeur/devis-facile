'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Button from '@/components/ui/bouton';

export default function PageSignature() {
  const { devis_id } = useParams() as { devis_id: string };
  const [devis, setDevis] = useState<any>(null);
  const [nomSignataire, setNomSignataire] = useState('');
  const [signatureEnregistree, setSignatureEnregistree] = useState(false);

  useEffect(() => {
    if (!devis_id) return;
    const historique = JSON.parse(localStorage.getItem('devisHistorique') || '[]');
    const found = historique.find((d: any) => d.numeroDevis === devis_id);
    if (found) setDevis(found);
  }, [devis_id]);

  const handleSignature = () => {
    if (!nomSignataire.trim()) return;
    const historique = JSON.parse(localStorage.getItem('devisHistorique') || '[]');
    const updated = historique.map((d: any) =>
      d.numeroDevis === devis_id
        ? { ...d, signataire: nomSignataire, date_signature: new Date().toISOString() }
        : d
    );
    localStorage.setItem('devisHistorique', JSON.stringify(updated));
    setSignatureEnregistree(true);
  };

  if (!devis) return <p className="p-4">Devis introuvable ou chargement en cours…</p>;
  if (signatureEnregistree)
    return <p className="p-4 text-green-600">Merci, votre signature a bien été enregistrée.</p>;

  return (
    <div className="max-w-3xl mx-auto p-6 bg-white shadow rounded-xl mt-8">
      <h1 className="text-2xl font-semibold mb-4">Signature du devis</h1>

      <div className="mb-6 text-sm text-gray-700">
        <p>
          <strong>Date :</strong> {new Date(devis.date).toLocaleDateString()}
        </p>
        <p>
          <strong>Client :</strong> {devis.recepteur?.nom}
        </p>
        <p>
          <strong>Émetteur :</strong> {devis.emetteur?.nom}
        </p>
        <p>
          <strong>Titre :</strong> {devis.titre}
        </p>
        <p>
          <strong>Total TTC :</strong> {devis.total_ttc} €
        </p>
      </div>

      <hr className="my-4" />

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Nom du signataire</label>
        <input
          type="text"
          value={nomSignataire}
          onChange={e => setNomSignataire(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2"
          placeholder="Votre nom complet"
        />
      </div>

      <Button disabled={!nomSignataire} onClick={handleSignature}>
        Signer ce devis
      </Button>
    </div>
  );
}
