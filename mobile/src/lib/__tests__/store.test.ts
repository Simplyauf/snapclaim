/**
 * Report versioning (FR-21) and sealing safety (NFR Reliability).
 *
 * The rule under test: a sealed report version is immutable. Editing a month
 * after it was sealed must cut a NEW draft and leave every sealed version
 * byte-identical, or a reviewer's old report stops verifying.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import type { Db, Expense } from '../store';
import {
  buildCanonicalReport,
  deleteExpense,
  emptyDb,
  ensureDraft,
  expensesForMonth,
  latestReport,
  loadDb,
  markSealed,
  monthTotals,
  reportsForMonth,
  saveDb,
  sealedReports,
  upsertExpense,
} from '../store';
import { canonicalize } from '../canonical';

const OWNER = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';
const h = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');

let seq = 0;
const newId = () => `id-${++seq}`;

const expense = (over: Partial<Expense> = {}): Expense => ({
  id: newId(),
  date: '2026-10-05',
  vendor: 'Uber',
  subtotal: null,
  tax: null,
  total: 345000,
  currency: 'NGN',
  parseStatus: 'parsed',
  createdAt: '2026-10-05T10:00:00Z',
  updatedAt: '2026-10-05T10:00:00Z',
  ...over,
});

/** Draft the current state of a month, the way the Reports screen does. */
function draft(db: Db, month = '2026-10') {
  const canonical = canonicalize(buildCanonicalReport(db, month, OWNER));
  return ensureDraft(db, month, OWNER, h(canonical), canonical, 'devnet', newId);
}

test('groups expenses by month and totals them', () => {
  let db = emptyDb();
  db = upsertExpense(db, expense());
  db = upsertExpense(db, expense({ date: '2026-09-30', total: 100000 }));
  assert.equal(expensesForMonth(db, '2026-10').length, 1);
  assert.deepEqual(monthTotals(db, '2026-10'), { NGN: 345000 });
  assert.deepEqual(monthTotals(db, '2026-09'), { NGN: 100000 });
});

test('refreshes an unsealed draft in place instead of piling up versions', () => {
  let db = upsertExpense(emptyDb(), expense());
  db = draft(db).db;
  db = upsertExpense(db, expense({ vendor: 'Bolt', total: 50000 }));
  const { db: after, report } = draft(db);
  assert.equal(reportsForMonth(after, '2026-10').length, 1);
  assert.equal(report.version, 1);
  assert.equal(report.snapshot.length, 2);
});

test('keeps a sealed version untouched when the month is edited afterwards', () => {
  let db = upsertExpense(emptyDb(), expense());
  const first = draft(db);
  db = markSealed(first.db, first.report.id, 'sig-1', '2026-10-31T12:00:00Z');
  const sealedBefore = structuredClone(sealedReports(db, '2026-10')[0]);

  // The claimant remembers one more receipt after sealing.
  db = upsertExpense(db, expense({ vendor: 'Chicken Republic', total: 559000 }));
  const second = draft(db);
  db = second.db;

  const sealedAfter = sealedReports(db, '2026-10')[0];
  assert.deepEqual(sealedAfter, sealedBefore, 'the sealed version must not change');
  assert.equal(second.report.version, 2);
  assert.equal(second.report.status, 'draft');
  assert.notEqual(second.report.fingerprint, sealedBefore.fingerprint);
  assert.equal(reportsForMonth(db, '2026-10').length, 2);
});

test('does not cut a new version when a sealed month is unchanged', () => {
  let db = upsertExpense(emptyDb(), expense());
  const first = draft(db);
  db = markSealed(first.db, first.report.id, 'sig-1', '2026-10-31T12:00:00Z');
  const again = draft(db);
  assert.equal(reportsForMonth(again.db, '2026-10').length, 1);
  assert.equal(again.report.status, 'sealed');
});

test('cuts a new draft when an edit is reverted and then re-applied', () => {
  let db = upsertExpense(emptyDb(), expense({ id: 'keep' }));
  const first = draft(db);
  db = markSealed(first.db, first.report.id, 'sig-1', '2026-10-31T12:00:00Z');

  db = upsertExpense(db, expense({ id: 'extra', vendor: 'Bolt', total: 1 }));
  db = draft(db).db;
  assert.equal(latestReport(db, '2026-10')?.version, 2);

  // Reverting back to the sealed contents reuses the sealed fingerprint, but
  // the draft row stays — it is refreshed, not deleted.
  db = deleteExpense(db, 'extra');
  const reverted = draft(db);
  assert.equal(reverted.report.fingerprint, first.report.fingerprint);
  assert.equal(sealedReports(reverted.db, '2026-10').length, 1);
});

test('refuses to seal the same report version twice', () => {
  let db = upsertExpense(emptyDb(), expense());
  const first = draft(db);
  db = markSealed(first.db, first.report.id, 'sig-1', '2026-10-31T12:00:00Z');
  assert.throws(() => markSealed(db, first.report.id, 'sig-2', '2026-11-01T12:00:00Z'), /already sealed/);
});

test('the fingerprint ignores ids, images and timestamps', () => {
  const a = upsertExpense(emptyDb(), expense({ id: 'a', createdAt: '2026-10-05T10:00:00Z' }));
  const b = upsertExpense(emptyDb(), expense({
    id: 'b',
    createdAt: '2026-10-06T23:59:00Z',
    updatedAt: '2026-10-07T01:00:00Z',
    imageUri: 'file:///somewhere/else.jpg',
    parseStatus: 'manual',
  }));
  assert.equal(
    h(canonicalize(buildCanonicalReport(a, '2026-10', OWNER))),
    h(canonicalize(buildCanonicalReport(b, '2026-10', OWNER))),
  );
});

test('survives a corrupt stored blob instead of crashing on launch', async () => {
  const mem = new Map<string, string>();
  const storage = {
    getItem: async (k: string) => mem.get(k) ?? null,
    setItem: async (k: string, v: string) => void mem.set(k, v),
  };
  mem.set('snapclaim.db.v1', '{not json');
  assert.deepEqual(await loadDb(storage), emptyDb());

  const db = upsertExpense(emptyDb(), expense());
  await saveDb(storage, db);
  assert.equal((await loadDb(storage)).expenses.length, 1);
});

/**
 * Re-drafting an unchanged month must be referentially stable.
 *
 * The Reports screen re-runs ensureDraft whenever the stored db changes and
 * persists the result when it differs. Returning a fresh object every time
 * turned that into an infinite effect loop that pinned a CPU core and left
 * the Seal button unresponsive on device.
 */
test('returns the same db reference when the draft has not changed', () => {
  let db = upsertExpense(emptyDb(), expense());
  const first = draft(db);
  const second = draft(first.db);
  assert.equal(second.db, first.db, 'db identity must be preserved');
  assert.equal(second.report, first.report, 'report identity must be preserved');
});

test('still returns a new db when the month actually changed', () => {
  let db = upsertExpense(emptyDb(), expense());
  const first = draft(db);
  const changed = upsertExpense(first.db, expense({ vendor: 'Bolt', total: 777 }));
  const second = draft(changed);
  assert.notEqual(second.db, changed);
  assert.notEqual(second.report.fingerprint, first.report.fingerprint);
});
