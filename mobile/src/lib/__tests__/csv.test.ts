/**
 * The report file a reviewer receives.
 *
 * The property everything rests on: a CSV must rebuild into byte-identical
 * canonical text, so the reviewer's own SHA-256 equals the one sealed on
 * chain. If this drifts, honest reports start failing verification — or, far
 * worse, the reviewer's check silently stops meaning anything.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import type { CanonicalReport } from '../canonical';
import { canonicalize } from '../canonical';
import { fromCsv, toCsv } from '../csv';

const h = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');
const fp = (r: CanonicalReport) => h(canonicalize(r));

const report: CanonicalReport = {
  month: '2026-10',
  owner: 'uYD9FdvSn9viErkEYmgmnQECZvfH41Ma9SfLDqx4dcz',
  expenses: [
    { date: '2026-10-06', vendor: 'SHOPRITE', subtotal: 1200000, tax: 90000, total: 1290000, currency: 'NGN' },
  ],
};

test('reproduces the fingerprint that was actually sealed on devnet', () => {
  // This is the real seal from the on-device run:
  // snapclaim:v1:2026-10:1df7213f...c101, transaction 4wSfsWUeEMDc...
  assert.equal(fp(report), '1df7213fb91f64aa96f9de644e8f5db4f48237d13c325cf1e361bd3f72b8c101');
});

test('a CSV round-trip rebuilds the identical fingerprint', () => {
  const csv = toCsv(report, { fingerprint: fp(report), signature: 'sig', cluster: 'devnet', version: 1 });
  const back = fromCsv(csv);
  assert.equal(fp(back.report), fp(report));
  assert.equal(canonicalize(back.report), canonicalize(report));
});

test('carries the fingerprint and transaction so a reviewer needs nothing else', () => {
  const csv = toCsv(report, { fingerprint: fp(report), signature: 'abc123', cluster: 'devnet', version: 2 });
  const back = fromCsv(csv);
  assert.equal(back.meta.fingerprint, fp(report));
  assert.equal(back.meta.signature, 'abc123');
  assert.equal(back.meta.month, '2026-10');
  assert.equal(back.meta.owner, report.owner);
  assert.equal(back.meta.version, 2);
});

test('survives vendor names containing commas, quotes and newlines', () => {
  const awkward: CanonicalReport = {
    ...report,
    expenses: [
      { date: '2026-10-01', vendor: 'Smith, Jones & Co', subtotal: null, tax: null, total: 100, currency: 'NGN' },
      { date: '2026-10-02', vendor: 'The "Best" Shop', subtotal: null, tax: null, total: 200, currency: 'NGN' },
      { date: '2026-10-03', vendor: 'Line\nBreak Ltd', subtotal: null, tax: null, total: 300, currency: 'NGN' },
    ],
  };
  const back = fromCsv(toCsv(awkward, { fingerprint: fp(awkward) }));
  assert.equal(fp(back.report), fp(awkward));
});

test('a single edited amount in the CSV changes the fingerprint', () => {
  const csv = toCsv(report, { fingerprint: fp(report) });
  const tampered = csv.replace('12900.00', '12900.01');
  assert.notEqual(fp(fromCsv(tampered).report), fp(report));
});

test('an edited vendor name in the CSV changes the fingerprint', () => {
  const csv = toCsv(report, { fingerprint: fp(report) });
  assert.notEqual(fp(fromCsv(csv.replace('SHOPRITE', 'SHOPRITF')).report), fp(report));
});

test('preserves empty subtotal and tax rather than inventing zeros', () => {
  const sparse: CanonicalReport = {
    ...report,
    expenses: [{ date: '2026-10-05', vendor: 'Uber', subtotal: null, tax: null, total: 345000, currency: 'NGN' }],
  };
  const back = fromCsv(toCsv(sparse, { fingerprint: fp(sparse) }));
  assert.equal(back.report.expenses[0].subtotal, null);
  assert.equal(back.report.expenses[0].tax, null);
  assert.equal(fp(back.report), fp(sparse));
});

test('rejects a file that is not a SnapClaim report, with a readable message', () => {
  assert.throws(() => fromCsv('name,age\nalice,30\n'), /missing its column header/);
  assert.throws(
    () =>
      fromCsv('# snapclaim/csv/v1\n# month,2026-10\n# owner,abc\ndate,vendor,subtotal,tax,total,currency\n'),
    /no expense rows/,
  );
  assert.throws(() => fromCsv('date,vendor,subtotal,tax,total,currency\n2026-10-01,x,,,1.00,NGN\n'), /which month/);
});

test('reports a malformed amount by line number', () => {
  const csv = toCsv(report, { fingerprint: fp(report) }).replace('12900.00', 'twelve');
  assert.throws(() => fromCsv(csv), /is not a number/);
});
