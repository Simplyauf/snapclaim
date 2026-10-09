/**
 * Turning a vision model's loose output into an expense.
 *
 * PURE AND PORTABLE: no React Native, no network. The model returns strings
 * written by whoever printed the receipt, and nearly every field is
 * ambiguous — "1.234,56" vs "1,234.56", "05/10/2026" vs "10/05/2026". Each
 * guess this file makes is recorded in `lowConfidence` so the review screen
 * can mark it for checking (FR-9) rather than letting a wrong number sail
 * into a sealed report.
 */

/** Exactly what the backend promises to return. All strings, all optional. */
export type RawReceipt = {
  vendor?: string | null;
  date?: string | null;
  subtotal?: string | null;
  tax?: string | null;
  total?: string | null;
  currency?: string | null;
};

export type NormalizedReceipt = {
  vendor: string;
  date: string; // YYYY-MM-DD
  subtotal: number | null; // minor units
  tax: number | null;
  total: number; // minor units
  currency: string;
  /** Field names the user should check before saving. */
  lowConfidence: string[];
};

/**
 * Parse an amount into integer minor units.
 *
 * Handles grouping in either convention by treating the LAST separator as the
 * decimal point when it is followed by exactly two digits, and as a thousands
 * separator otherwise ("1.234" is one thousand two hundred, not 1.23).
 * Returns null rather than guessing when there is no digit at all.
 */
export function parseAmountToMinor(input: string | null | undefined): number | null {
  if (input == null) return null;
  const cleaned = String(input).replace(/[^\d.,-]/g, '').trim();
  if (!cleaned || !/\d/.test(cleaned)) return null;

  const negative = /^-/.test(cleaned);
  const digitsOnly = cleaned.replace(/-/g, '');

  const lastComma = digitsOnly.lastIndexOf(',');
  const lastDot = digitsOnly.lastIndexOf('.');
  const lastSep = Math.max(lastComma, lastDot);

  let whole: string;
  let frac: string;

  if (lastSep === -1) {
    whole = digitsOnly;
    frac = '';
  } else {
    const after = digitsOnly.slice(lastSep + 1);
    if (/^\d{2}$/.test(after)) {
      whole = digitsOnly.slice(0, lastSep).replace(/[.,]/g, '');
      frac = after;
    } else {
      // Not a decimal point — it was grouping ("1,234", "1.234", "12,345,678").
      whole = digitsOnly.replace(/[.,]/g, '');
      frac = '';
    }
  }

  const w = whole.replace(/\D/g, '') || '0';
  const minor = Number(w) * 100 + Number((frac + '00').slice(0, 2));
  if (!Number.isFinite(minor)) return null;
  return negative ? -minor : minor;
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

function validYmd(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/**
 * Normalise a printed date to YYYY-MM-DD.
 *
 * `ambiguous` is true for numeric dates where both readings are valid dates
 * (03/04/2026). This build reads those as DAY FIRST — the convention in
 * Nigeria and the UK — and flags them, because silently picking the US
 * reading would move an expense into the wrong month and change a report's
 * fingerprint for reasons the claimant cannot see.
 */
export function normalizeDate(
  input: string | null | undefined,
  today = new Date(),
): { date: string | null; ambiguous: boolean } {
  if (!input) return { date: null, ambiguous: false };
  const s = String(input).trim();

  const isoMatch = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(s);
  if (isoMatch) {
    const [, y, m, d] = isoMatch.map(Number) as unknown as [string, number, number, number];
    return validYmd(y, m, d) ? { date: iso(y, m, d), ambiguous: false } : { date: null, ambiguous: false };
  }

  // "5 Oct 2026", "Oct 5, 2026", "5 October 26"
  const named = /^(?:(\d{1,2})\s*[-/ ]\s*)?([A-Za-z]{3,})\.?\s*[-/ ,]?\s*(\d{1,2})?(?:st|nd|rd|th)?\s*[-/ ,]\s*(\d{2,4})$/.exec(s);
  if (named) {
    const mon = MONTHS[named[2].slice(0, 3).toLowerCase()];
    const day = Number(named[1] ?? named[3]);
    let year = Number(named[4]);
    if (year < 100) year += 2000;
    if (mon && day && validYmd(year, mon, day)) {
      return { date: iso(year, mon, day), ambiguous: false };
    }
  }

  const numeric = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/.exec(s);
  if (numeric) {
    const a = Number(numeric[1]);
    const b = Number(numeric[2]);
    let year = Number(numeric[3]);
    if (year < 100) year += 2000;

    const dayFirst = validYmd(year, b, a);
    const monthFirst = validYmd(year, a, b);

    if (dayFirst && monthFirst) {
      const asDayFirst = iso(year, b, a);
      const asMonthFirst = iso(year, a, b);
      const todayStr = todayIso(today);

      // A receipt is almost never dated in the future. If only one reading is
      // in the past, it is the only sensible one — take it without flagging.
      // This matters: flagging every date whose day is 12 or under would mark
      // roughly 40% of receipts for review and blow the 30-second scan target.
      const dayFirstPast = asDayFirst <= todayStr;
      const monthFirstPast = asMonthFirst <= todayStr;
      if (dayFirstPast && !monthFirstPast) return { date: asDayFirst, ambiguous: false };
      if (monthFirstPast && !dayFirstPast) return { date: asMonthFirst, ambiguous: false };

      // Both readings are plausible — genuinely ambiguous, so day-first (the
      // Nigerian and UK convention) and flagged for the user to confirm.
      return { date: asDayFirst, ambiguous: a !== b };
    }
    if (dayFirst) return { date: iso(year, b, a), ambiguous: false };
    if (monthFirst) return { date: iso(year, a, b), ambiguous: false };
  }

  return { date: null, ambiguous: false };
}

const CURRENCY_HINTS: Array<[RegExp, string]> = [
  [/₦|NGN|naira/i, 'NGN'],
  [/€|EUR/i, 'EUR'],
  [/£|GBP/i, 'GBP'],
  [/\$|USD/i, 'USD'],
];

export function normalizeCurrency(input: string | null | undefined, fallback = 'NGN'): {
  currency: string;
  guessed: boolean;
} {
  const s = (input ?? '').trim();
  if (/^[A-Za-z]{3}$/.test(s)) return { currency: s.toUpperCase(), guessed: false };
  for (const [re, code] of CURRENCY_HINTS) {
    if (re.test(s)) return { currency: code, guessed: false };
  }
  return { currency: fallback, guessed: true };
}

/** Today in UTC as YYYY-MM-DD — the fallback when no date could be read. */
export function todayIso(now = new Date()): string {
  return iso(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate());
}

/**
 * Normalise a model response into something saveable, flagging every field
 * that was guessed, missing, or internally inconsistent.
 */
export function normalizeReceipt(
  raw: RawReceipt,
  opts: { defaultCurrency?: string; now?: Date } = {},
): NormalizedReceipt {
  const now = opts.now ?? new Date();
  const lowConfidence = new Set<string>();

  const vendor = (raw.vendor ?? '').replace(/\s+/g, ' ').trim();
  if (!vendor) lowConfidence.add('vendor');

  const { date, ambiguous } = normalizeDate(raw.date, now);
  if (!date) lowConfidence.add('date');
  if (ambiguous) lowConfidence.add('date');

  const { currency, guessed } = normalizeCurrency(raw.currency, opts.defaultCurrency ?? 'NGN');
  if (guessed) lowConfidence.add('currency');

  const subtotal = parseAmountToMinor(raw.subtotal);
  const tax = parseAmountToMinor(raw.tax);
  let total = parseAmountToMinor(raw.total);

  if (total == null) {
    // No total read. Reconstruct from the parts if we can, but never silently:
    // the user must look at it.
    if (subtotal != null) total = subtotal + (tax ?? 0);
    else total = 0;
    lowConfidence.add('total');
  }

  // A total that does not equal subtotal + tax usually means one of the three
  // was misread (a discount line, or a dropped digit).
  if (subtotal != null && total !== subtotal + (tax ?? 0)) {
    lowConfidence.add('total');
    lowConfidence.add('subtotal');
    if (tax != null) lowConfidence.add('tax');
  }

  if (total <= 0) lowConfidence.add('total');

  // A receipt dated in the future is a misread year far more often than a
  // real pre-dated receipt.
  if (date && date > todayIso(now)) lowConfidence.add('date');

  return {
    vendor: vendor || 'Unknown vendor',
    date: date ?? todayIso(now),
    subtotal,
    tax,
    total: total ?? 0,
    currency,
    lowConfidence: [...lowConfidence].sort(),
  };
}
