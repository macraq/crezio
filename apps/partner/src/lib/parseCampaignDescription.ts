/**
 * Rozbija zapisany w DB opis kampanii z formatu CreateCampaignForm z powrotem na pola formularza.
 */
export function parseStoredCampaignDescription(stored: string | null): {
  productLead: string;
  suggestedRetailPrice: string;
  htmlDescription: string;
} {
  if (!stored?.trim()) {
    return { productLead: '', suggestedRetailPrice: '', htmlDescription: '' };
  }

  const htmlMarker = '\n\nDokładny opis (HTML):\n';
  const mi = stored.indexOf(htmlMarker);
  if (mi === -1) {
    const stripped = stored.replace(/^Lead produktu:\n?/i, '').trim();
    return { productLead: stripped, suggestedRetailPrice: '', htmlDescription: '' };
  }

  let head = stored.slice(0, mi).replace(/^Lead produktu:\n?/i, '');
  const htmlDescription = stored.slice(mi + htmlMarker.length);

  let suggestedRetailPrice = '';
  const srpPattern = /\n\nSugerowana cena detaliczna:\s*([\s\S]+)$/;
  const srpMatch = head.match(srpPattern);
  if (srpMatch && srpMatch.index !== undefined) {
    suggestedRetailPrice = srpMatch[1].trim();
    head = head.slice(0, srpMatch.index).trim();
  }

  return {
    productLead: head.trim(),
    suggestedRetailPrice,
    htmlDescription,
  };
}

/** ISO z bazy → wartość dla input type="date" */
export function isoDateToInput(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
