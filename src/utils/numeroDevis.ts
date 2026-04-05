/**
 * Sequential quote numbering — format D{YEAR}-{NNN}
 * e.g.  D2026-001, D2026-002 …
 *
 * localStorage-based (unauthenticated fallback):
 *   Counter is stored per-year so it resets each calendar year.
 *
 * Supabase-based (authenticated):
 *   Queries the `quotes` table for the highest existing number this year,
 *   then returns the next one. Atomic enough for single-user usage.
 */
export function genererNumeroDevis(): string {
  const year = new Date().getFullYear();
  const key = `devisCounter_${year}`;
  const current = parseInt(localStorage.getItem(key) ?? '0', 10);
  const next = current + 1;
  localStorage.setItem(key, String(next));
  return `D${year}-${String(next).padStart(3, '0')}`;
}

/**
 * Peek at the next number without incrementing (localStorage).
 */
export function previsualiserNumeroDevis(): string {
  const year = new Date().getFullYear();
  const key = `devisCounter_${year}`;
  const current = parseInt(localStorage.getItem(key) ?? '0', 10);
  return `D${year}-${String(current + 1).padStart(3, '0')}`;
}

/**
 * Fetch the next sequential quote number from Supabase.
 * Looks at all `quotes` rows for the current year matching "D{YEAR}-NNN",
 * finds the max sequence, and returns the next one.
 *
 * Falls back to the localStorage-based generator if the query fails.
 */
export async function genererNumeroDevisSupabase(
  // Accept any Supabase client that has a `.from()` method
  supabase: { from: (table: string) => any }
): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `D${year}-`;

  try {
    const { data, error } = await supabase
      .from('quotes')
      .select('quote_number')
      .like('quote_number', `${prefix}%`)
      .order('quote_number', { ascending: false })
      .limit(1);

    if (error) throw error;

    let next = 1;
    if (data && data.length > 0) {
      const last = data[0].quote_number as string;
      const seq = parseInt(last.replace(prefix, ''), 10);
      if (!isNaN(seq)) next = seq + 1;
    }

    // Keep localStorage counter in sync so the fallback stays accurate
    const key = `devisCounter_${year}`;
    localStorage.setItem(key, String(next));

    return `${prefix}${String(next).padStart(3, '0')}`;
  } catch {
    // Fallback to localStorage if Supabase unreachable
    return genererNumeroDevis();
  }
}
