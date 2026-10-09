import { CanonicalExpense, CanonicalReport, canonicalize, totalsByCurrency } from './canonical';

export type Expense = CanonicalExpense & {
  id: string;
  imageUri?: string;
  /** Fields the parser was unsure about (FR-9), by field name. */
  lowConfidence?: string[];
  parseStatus: 'parsed' | 'manual' | 'failed';
  createdAt: string;
  updatedAt: string;
};

export type Report = {
  id: string;
  month: string;
  owner: string;
  /** 1-based; a new draft is cut each time a sealed month changes (FR-21). */
  version: number;
  /** Frozen copy of the expenses as they were when this version was made. */
  snapshot: CanonicalExpense[];
  canonical: string;
  fingerprint: string;
  status: 'draft' | 'sealed';
  signature?: string;
  sealedAt?: string;
  cluster: string;
};

export type Db = { expenses: Expense[]; reports: Report[] };

export const emptyDb = (): Db => ({ expenses: [], reports: [] });

/** Minimal async key-value surface — AsyncStorage in the app, a Map in tests. */
export interface Storage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

const KEY = 'snapclaim.db.v1';

export async function loadDb(storage: Storage): Promise<Db> {
  const raw = await storage.getItem(KEY);
  if (!raw) return emptyDb();
  try {
    const parsed = JSON.parse(raw) as Partial<Db>;
    return { expenses: parsed.expenses ?? [], reports: parsed.reports ?? [] };
  } catch {
    // A corrupt blob must not brick the app; the user keeps an empty ledger
    // rather than a crash loop on every launch.
    return emptyDb();
  }
}

export async function saveDb(storage: Storage, db: Db): Promise<void> {
  await storage.setItem(KEY, JSON.stringify(db));
}

export const monthOf = (isoDate: string): string => isoDate.slice(0, 7);

export function expensesForMonth(db: Db, month: string): Expense[] {
  return db.expenses
    .filter((e) => monthOf(e.date) === month)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

export function monthTotals(db: Db, month: string): Record<string, number> {
  return totalsByCurrency(expensesForMonth(db, month));
}

/** Strip store-only fields so the hash never depends on ids or timestamps. */
export function toCanonicalExpense(e: Expense): CanonicalExpense {
  return {
    date: e.date,
    vendor: e.vendor,
    subtotal: e.subtotal,
    tax: e.tax,
    total: e.total,
    currency: e.currency,
  };
}

export function buildCanonicalReport(db: Db, month: string, owner: string): CanonicalReport {
  return { month, owner, expenses: expensesForMonth(db, month).map(toCanonicalExpense) };
}

export const reportsForMonth = (db: Db, month: string): Report[] =>
  db.reports.filter((r) => r.month === month).sort((a, b) => a.version - b.version);

export const latestReport = (db: Db, month: string): Report | undefined =>
  reportsForMonth(db, month).at(-1);

export const sealedReports = (db: Db, month: string): Report[] =>
  reportsForMonth(db, month).filter((r) => r.status === 'sealed');

/**
 * Get the working draft for a month, creating or refreshing it as needed.
 *
 * FR-21: a sealed version is never mutated. If the month's expenses have
 * changed since the last seal, this cuts a NEW draft version and leaves every
 * sealed version untouched, so an old report keeps verifying forever.
 *
 * Pure: returns the next Db rather than writing, so the caller controls
 * persistence and the rule is testable without storage.
 */
export function ensureDraft(
  db: Db,
  month: string,
  owner: string,
  fingerprint: string,
  canonical: string,
  cluster: string,
  newId: () => string,
): { db: Db; report: Report } {
  const existing = latestReport(db, month);
  const snapshot = buildCanonicalReport(db, month, owner).expenses;

  // An unsealed draft is just refreshed in place — editing expenses before
  // sealing should not pile up versions.
  if (existing && existing.status === 'draft') {
    // Return the SAME db reference when nothing actually changed.
    //
    // Callers re-run this whenever `db` changes and persist the result when
    // it differs. Handing back a fresh object every time made that a loop:
    // effect -> new db -> effect, pinning a core, hammering storage, and
    // leaving the screen too busy to respond to the Seal button.
    if (
      existing.owner === owner &&
      existing.fingerprint === fingerprint &&
      existing.canonical === canonical
    ) {
      return { db, report: existing };
    }
    const report: Report = { ...existing, snapshot, canonical, fingerprint, owner };
    return { db: { ...db, reports: db.reports.map((r) => (r.id === report.id ? report : r)) }, report };
  }

  // Nothing sealed yet, or the month changed after a seal: cut a new version.
  if (existing?.status === 'sealed' && existing.fingerprint === fingerprint) {
    return { db, report: existing };
  }

  const report: Report = {
    id: newId(),
    month,
    owner,
    version: (existing?.version ?? 0) + 1,
    snapshot,
    canonical,
    fingerprint,
    status: 'draft',
    cluster,
  };
  return { db: { ...db, reports: [...db.reports, report] }, report };
}

/** Mark a draft sealed. Sealing twice is refused rather than silently re-sealed. */
export function markSealed(db: Db, reportId: string, signature: string, at: string): Db {
  return {
    ...db,
    reports: db.reports.map((r) => {
      if (r.id !== reportId) return r;
      if (r.status === 'sealed') throw new Error('That report version is already sealed.');
      return { ...r, status: 'sealed' as const, signature, sealedAt: at };
    }),
  };
}

export function upsertExpense(db: Db, expense: Expense): Db {
  const exists = db.expenses.some((e) => e.id === expense.id);
  return {
    ...db,
    expenses: exists
      ? db.expenses.map((e) => (e.id === expense.id ? expense : e))
      : [...db.expenses, expense],
  };
}

export const deleteExpense = (db: Db, id: string): Db => ({
  ...db,
  expenses: db.expenses.filter((e) => e.id !== id),
});
