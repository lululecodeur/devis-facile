'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface Emetteur {
  nom: string;
  adresse: string;
  siret: string;
  email: string;
  tel: string;
}

export interface ProfilArtisan {
  formeJuridique: string;
  villeRCS: string;
  typeRegistre: 'RCS' | 'RM';
  assuranceNom: string;
  assuranceNumero: string;
  assuranceZone: string;
  capital: string;
  tvaIntra: string;
}

const EMETTEUR_DEFAULT: Emetteur = { nom: '', adresse: '', siret: '', email: '', tel: '' };
const PROFIL_DEFAULT: ProfilArtisan = {
  formeJuridique: '',
  villeRCS: '',
  typeRegistre: 'RCS',
  assuranceNom: '',
  assuranceNumero: '',
  assuranceZone: '',
  capital: '',
  tvaIntra: '',
};

export function useProfile() {
  const [userId, setUserId] = useState<string | null>(null);
  const [emetteur, setEmetteur] = useState<Emetteur>(EMETTEUR_DEFAULT);
  const [profilArtisan, setProfilArtisan] = useState<ProfilArtisan>(PROFIL_DEFAULT);
  const [iban, setIban] = useState('');
  const [bic, setBic] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        // Fallback to localStorage when unauthenticated
        try {
          const e = localStorage.getItem('emetteur');
          const p = localStorage.getItem('profilArtisan');
          if (e) setEmetteur(JSON.parse(e));
          if (p) setProfilArtisan(JSON.parse(p));
        } catch {}
        setLoading(false);
        return;
      }

      setUserId(user.id);

      supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          if (data) {
            setEmetteur({
              nom: data.company_name ?? '',
              adresse: data.address ?? '',
              siret: data.siret ?? '',
              email: data.email ?? '',
              tel: data.phone ?? '',
            });
            setProfilArtisan({
              formeJuridique: data.legal_form ?? '',
              villeRCS: data.rcs_city ?? '',
              typeRegistre: data.registry_type ?? 'RCS',
              assuranceNom: data.insurance_name ?? '',
              assuranceNumero: data.insurance_number ?? '',
              assuranceZone: data.insurance_zone ?? '',
              capital: data.capital ?? '',
              tvaIntra: data.vat_number ?? '',
            });
            setIban(data.iban ?? '');
            setBic(data.bic ?? '');
          }
          setLoading(false);
        });
    });
  }, []);

  const saveProfile = useCallback(async (
    e: Emetteur,
    p: ProfilArtisan,
    ibanVal: string,
    bicVal: string,
  ): Promise<boolean> => {
    if (!userId) return false;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from('profiles').upsert(
      {
        user_id: userId,
        company_name: e.nom,
        address: e.adresse,
        siret: e.siret,
        email: e.email,
        phone: e.tel,
        legal_form: p.formeJuridique,
        rcs_city: p.villeRCS,
        registry_type: p.typeRegistre,
        insurance_name: p.assuranceNom,
        insurance_number: p.assuranceNumero,
        insurance_zone: p.assuranceZone,
        capital: p.capital,
        vat_number: p.tvaIntra,
        iban: ibanVal,
        bic: bicVal,
      },
      { onConflict: 'user_id' }
    );
    setSaving(false);
    return !error;
  }, [userId]);

  return {
    userId,
    emetteur, setEmetteur,
    profilArtisan, setProfilArtisan,
    iban, setIban,
    bic, setBic,
    loading,
    saving,
    saveProfile,
  };
}
