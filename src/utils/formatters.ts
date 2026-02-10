const LOCALE_MAP: Record<string, string> = {
  es: 'es-ES',
  ca: 'ca-ES',
  gl: 'gl-ES',
  eu: 'eu-ES',
  pt: 'pt-PT',
  fr: 'fr-FR',
  en: 'en-GB',
  it: 'it-IT',
  de: 'de-DE',
};

function getLocale(langCode: string): string {
  return LOCALE_MAP[langCode] || 'es-ES';
}

export function formatDate(date: Date | string, langCode: string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString(getLocale(langCode), {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function formatDateTime(date: Date | string, langCode: string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString(getLocale(langCode), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatNumber(num: number, langCode: string): string {
  return num.toLocaleString(getLocale(langCode));
}

export function formatCurrency(amount: number, langCode: string, currency = 'EUR'): string {
  return amount.toLocaleString(getLocale(langCode), {
    style: 'currency',
    currency,
  });
}
