import { formatMinor, normCurrency } from './canonical';

/**
 * Amounts are shown WITHOUT a currency symbol, as an ISO code instead.
 *
 * Not a style preference: none of the three bundled faces contains ₦ (U+20A6),
 * so a symbol forces a silent fallback to a system font — Roboto glyphs inside
 * an Instrument Serif headline — in the currency this app is built for. ISO
 * codes are also what an expense document is expected to use, and they keep
 * multi-currency months unambiguous.
 */
export function formatAmount(minor: number): string {
  const [whole, frac] = formatMinor(minor).split('.');
  const neg = whole.startsWith('-');
  const digits = neg ? whole.slice(1) : whole;
  return `${neg ? '-' : ''}${digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${frac}`;
}

/** With the code appended — for lists that mix currencies and for totals. */
export function displayAmount(minor: number, currency: string): string {
  return `${formatAmount(minor)} ${normCurrency(currency)}`;
}

export const currencyCode = (currency: string): string => normCurrency(currency);

/** "2026-10" -> "October 2026" */
export function monthName(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** "2026-10-05" -> "05 OCT" for the tape column. */
export function tapeDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d))
    .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' })
    .toUpperCase();
}
