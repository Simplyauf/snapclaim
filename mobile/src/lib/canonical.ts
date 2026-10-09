/**
 * Canonical report form, v1.
 *
 * PURE AND PORTABLE ON PURPOSE. No React Native, no expo, no node imports —
 * the phone, the backend and the browser verify page must all be able to
 * rebuild byte-identical text from the same report, or verification is
 * meaningless. Copy this file, do not fork its logic.
 *
 * Any change to the output format is a NEW VERSION STRING. An old sealed
 * report must keep verifying forever, so `v1` is frozen once a report is
 * sealed on devnet.
 */

export const CANONICAL_VERSION = 'snapclaim/report/v1';

/** Money is integer minor units everywhere. No floats touch a total. */
export type Money = { minor: number; currency: string };

export type CanonicalExpense = {
  /** ISO date, day precision: YYYY-MM-DD. */
  date: string;
  vendor: string;
  subtotal: number | null;
  tax: number | null;
  total: number;
  currency: string;
};

export type CanonicalReport = {
  /** YYYY-MM */
  month: string;
  /** base58 wallet address of the claimant */
  owner: string;
  expenses: CanonicalExpense[];
};

/** Minor units -> fixed decimal string. Integer maths only. */
export function formatMinor(minor: number, digits = 2): string {
  const neg = minor < 0;
  const abs = Math.abs(Math.trunc(minor));
  const s = String(abs).padStart(digits + 1, '0');
  const whole = s.slice(0, s.length - digits);
  const frac = digits > 0 ? '.' + s.slice(s.length - digits) : '';
  return (neg ? '-' : '') + whole + frac;
}

/**
 * Field text normalisation: Unicode NFC, collapse runs of whitespace, trim.
 * Case and spelling are preserved — editing one character of a vendor name
 * must break the fingerprint, which is the whole point.
 */
function normText(v: string): string {
  return v.normalize('NFC').replace(/\s+/g, ' ').trim();
}

/** Tab and newline would corrupt the record layout below. */
function escapeField(v: string): string {
  return normText(v).replace(/\\/g, '\\\\').replace(/\t/g, '\\t').replace(/\n/g, '\\n');
}

/**
 * Deterministic ordering. Date first, then vendor, then total, then currency
 * — enough to make the sequence total even when a claimant files two
 * identical-looking receipts on the same day.
 */
function compareExpenses(a: CanonicalExpense, b: CanonicalExpense): number {
  return (
    a.date.localeCompare(b.date) ||
    normText(a.vendor).localeCompare(normText(b.vendor), 'en') ||
    a.total - b.total ||
    normCurrency(a.currency).localeCompare(normCurrency(b.currency))
  );
}

/** Currency is a code, not prose: always compared and stored upper-cased. */
export function normCurrency(v: string): string {
  return normText(v).toUpperCase();
}

/**
 * Sum per currency. Mixed-currency months are reported side by side, never
 * silently added together.
 *
 * Buckets on the NORMALISED code. Doing this on the raw string splits `ngn`
 * and `NGN` into two totals while the expense rows above upper-case theirs,
 * so one lower-case receipt would change a month's fingerprint without
 * changing its meaning.
 */
export function totalsByCurrency(expenses: CanonicalExpense[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of expenses) {
    const cur = normCurrency(e.currency);
    out[cur] = (out[cur] ?? 0) + e.total;
  }
  return out;
}

/**
 * Build the canonical text. LF line endings, no trailing newline, fixed key
 * order, fixed field order. This exact string is what gets hashed.
 */
export function canonicalize(report: CanonicalReport): string {
  const rows = [...report.expenses].sort(compareExpenses);

  const lines: string[] = [
    CANONICAL_VERSION,
    `month\t${report.month}`,
    `owner\t${normText(report.owner)}`,
    `count\t${rows.length}`,
    '--',
  ];

  for (const e of rows) {
    lines.push(
      [
        e.date,
        escapeField(e.vendor),
        e.subtotal === null ? '' : formatMinor(e.subtotal),
        e.tax === null ? '' : formatMinor(e.tax),
        formatMinor(e.total),
        normCurrency(e.currency),
      ].join('\t'),
    );
  }

  lines.push('--');
  const totals = totalsByCurrency(rows);
  for (const cur of Object.keys(totals).sort()) {
    lines.push(`total\t${cur}\t${formatMinor(totals[cur])}`);
  }

  return lines.join('\n');
}

/**
 * The memo written on-chain. Kept short and prefixed so the verify page can
 * tell a SnapClaim memo from any other memo in the transaction.
 */
export function buildMemo(fingerprintHex: string, month: string): string {
  return `snapclaim:v1:${month}:${fingerprintHex}`;
}

export function parseMemo(memo: string): { month: string; fingerprint: string } | null {
  const m = /^snapclaim:v1:(\d{4}-\d{2}):([0-9a-f]{64})$/.exec(memo.trim());
  return m ? { month: m[1], fingerprint: m[2] } : null;
}
