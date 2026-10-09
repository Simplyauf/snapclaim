/**
 * Canonical-form guarantees. Run: npm run test:canonical
 *
 * These are the properties verification depends on. If one of them breaks, a
 * sealed report can stop verifying (or a tampered one can start), so treat a
 * failure here as release-blocking rather than as a flaky test.
 *
 * Node's own SHA-256 stands in for expo-crypto; canonicalize() is the part
 * under test and the digest is the same algorithm on both sides.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import type { CanonicalReport } from '../canonical.ts';
import {
  buildMemo,
  canonicalize,
  formatMinor,
  parseMemo,
  totalsByCurrency,
} from '../canonical.ts';

const h = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');
const fp = (r: CanonicalReport) => h(canonicalize(r));

const base: CanonicalReport = {
  month: '2026-10',
  owner: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
  expenses: [
    { date: '2026-10-05', vendor: 'Shoprite  Ikeja', subtotal: 1200000, tax: 90000, total: 1290000, currency: 'ngn' },
    { date: '2026-10-02', vendor: 'Uber', subtotal: null, tax: null, total: 345000, currency: 'NGN' },
    { date: '2026-10-05', vendor: 'AWS', subtotal: 2000, tax: 0, total: 2000, currency: 'USD' },
  ],
};
const map = (r: CanonicalReport, f: (e: CanonicalReport['expenses'][0], i: number) => any) => ({
  ...r,
  expenses: r.expenses.map(f),
});

test('is independent of the order expenses were entered in', () => {
  const shuffled = { ...base, expenses: [base.expenses[2], base.expenses[0], base.expenses[1]] };
  assert.equal(fp(shuffled), fp(base));
});

test('is stable under whitespace runs and currency case', () => {
  assert.equal(fp(map(base, (e) => ({ ...e, vendor: e.vendor.replace(/ +/g, '   ') }))), fp(base));
  assert.equal(fp(map(base, (e) => ({ ...e, currency: e.currency.toUpperCase() }))), fp(base));
});

test('breaks on a single edited character in a vendor name', () => {
  assert.notEqual(fp(map(base, (e, i) => (i === 1 ? { ...e, vendor: 'Ubet' } : e))), fp(base));
});

test('breaks on a single minor unit of difference in a total', () => {
  assert.notEqual(fp(map(base, (e, i) => (i === 1 ? { ...e, total: e.total + 1 } : e))), fp(base));
});

test('escapes tabs and newlines so a vendor name cannot forge a row', () => {
  const inject = map(base, (e, i) =>
    i === 1 ? { ...e, vendor: 'Uber\t999999\n2026-10-09\tGhost' } : e,
  );
  assert.equal(canonicalize(inject).split('\n').length, canonicalize(base).split('\n').length);
});

test('sums per normalised currency without mixing them', () => {
  assert.deepEqual(totalsByCurrency(base.expenses), { NGN: 1635000, USD: 2000 });
});

test('formats minor units without floating point', () => {
  assert.equal(formatMinor(0), '0.00');
  assert.equal(formatMinor(5), '0.05');
  assert.equal(formatMinor(1290000), '12900.00');
  assert.equal(formatMinor(-2500), '-25.00');
});

test('round-trips a memo and rejects a malformed one', () => {
  const f = fp(base);
  assert.deepEqual(parseMemo(buildMemo(f, '2026-10')), { month: '2026-10', fingerprint: f });
  assert.equal(parseMemo('snapclaim:v1:2026-10:zzzz'), null);
  assert.equal(parseMemo('some other memo'), null);
});
