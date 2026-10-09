/**
 * Normalising vision-model output. These cases are the ones that silently
 * corrupt a report: a misread decimal separator changes a total by 100x, and
 * a day/month swap moves an expense into the wrong month entirely.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeCurrency, normalizeDate, normalizeReceipt, parseAmountToMinor } from '../parse';

const NOW = new Date('2026-10-08T12:00:00Z');

test('reads amounts in either grouping convention', () => {
  assert.equal(parseAmountToMinor('12,900.00'), 1290000);
  assert.equal(parseAmountToMinor('12.900,00'), 1290000);
  assert.equal(parseAmountToMinor('1,234,567.89'), 123456789);
  assert.equal(parseAmountToMinor('1.234.567,89'), 123456789);
});

test('treats a lone separator with three digits after it as grouping', () => {
  assert.equal(parseAmountToMinor('1,234'), 123400);
  assert.equal(parseAmountToMinor('1.234'), 123400);
});

test('treats a lone separator with two digits after it as a decimal point', () => {
  assert.equal(parseAmountToMinor('12.90'), 1290);
  assert.equal(parseAmountToMinor('12,90'), 1290);
});

test('strips currency symbols and stray text', () => {
  assert.equal(parseAmountToMinor('₦12,900.00'), 1290000);
  assert.equal(parseAmountToMinor('NGN 12,900'), 1290000);
  assert.equal(parseAmountToMinor('  $5.05  '), 505);
});

test('handles whole numbers and negatives', () => {
  assert.equal(parseAmountToMinor('12900'), 1290000);
  assert.equal(parseAmountToMinor('-25.00'), -2500);
  assert.equal(parseAmountToMinor('0'), 0);
});

test('returns null rather than guessing at unreadable input', () => {
  assert.equal(parseAmountToMinor(null), null);
  assert.equal(parseAmountToMinor(''), null);
  assert.equal(parseAmountToMinor('N/A'), null);
  assert.equal(parseAmountToMinor('—'), null);
});

test('reads unambiguous date formats', () => {
  assert.deepEqual(normalizeDate('2026-10-05', NOW), { date: '2026-10-05', ambiguous: false });
  assert.deepEqual(normalizeDate('25/12/2026', NOW), { date: '2026-12-25', ambiguous: false });
  assert.deepEqual(normalizeDate('5 Oct 2026', NOW), { date: '2026-10-05', ambiguous: false });
  assert.deepEqual(normalizeDate('Oct 5, 2026', NOW), { date: '2026-10-05', ambiguous: false });
});

test('reads an ambiguous numeric date day-first and flags it', () => {
  // 03/04/2026 is 3 April here, not 4 March — but the user must confirm.
  assert.deepEqual(normalizeDate('03/04/2026', NOW), { date: '2026-04-03', ambiguous: true });
});

test('picks the only non-future reading without flagging it', () => {
  // 05/11/2026 read day-first is 5 Nov, still in the future on 8 Oct. The
  // month-first reading (11 May) is the only plausible one.
  assert.deepEqual(normalizeDate('05/11/2026', NOW), { date: '2026-05-11', ambiguous: false });
});

test('flags a numeric date when both readings are plausibly in the past', () => {
  assert.deepEqual(normalizeDate('06/10/2026', NOW), { date: '2026-10-06', ambiguous: true });
});

test('does not flag a date where both readings agree', () => {
  assert.deepEqual(normalizeDate('05/05/2026', NOW), { date: '2026-05-05', ambiguous: false });
});

test('rejects an impossible date instead of rolling it over', () => {
  assert.equal(normalizeDate('31/02/2026', NOW).date, null);
  assert.equal(normalizeDate('not a date', NOW).date, null);
});

test('detects currency from a code or a symbol, and admits a guess', () => {
  assert.deepEqual(normalizeCurrency('NGN'), { currency: 'NGN', guessed: false });
  assert.deepEqual(normalizeCurrency('₦'), { currency: 'NGN', guessed: false });
  assert.deepEqual(normalizeCurrency('$'), { currency: 'USD', guessed: false });
  assert.deepEqual(normalizeCurrency(null), { currency: 'NGN', guessed: true });
});

test('normalises a clean receipt with nothing flagged', () => {
  const r = normalizeReceipt(
    { vendor: 'Shoprite  Ikeja', date: '2026-10-06', subtotal: '12,000.00', tax: '900.00', total: '12,900.00', currency: 'NGN' },
    { now: NOW },
  );
  assert.equal(r.vendor, 'Shoprite Ikeja');
  assert.equal(r.date, '2026-10-06');
  assert.deepEqual([r.subtotal, r.tax, r.total], [1200000, 90000, 1290000]);
  assert.deepEqual(r.lowConfidence, []);
});

test('flags a total that does not equal subtotal plus tax', () => {
  const r = normalizeReceipt(
    { vendor: 'X', date: '2026-10-06', subtotal: '1000.00', tax: '100.00', total: '9999.00', currency: 'NGN' },
    { now: NOW },
  );
  assert.deepEqual(r.lowConfidence, ['subtotal', 'tax', 'total']);
});

test('reconstructs a missing total from the parts and flags it', () => {
  const r = normalizeReceipt(
    { vendor: 'X', date: '2026-10-06', subtotal: '1000.00', tax: '100.00', total: null, currency: 'NGN' },
    { now: NOW },
  );
  assert.equal(r.total, 110000);
  assert.ok(r.lowConfidence.includes('total'));
});

test('flags a future-dated receipt as a likely misread year', () => {
  const r = normalizeReceipt({ vendor: 'X', date: '2027-01-01', total: '100', currency: 'NGN' }, { now: NOW });
  assert.ok(r.lowConfidence.includes('date'));
});

test('always returns something saveable, even from an empty parse', () => {
  const r = normalizeReceipt({}, { now: NOW });
  assert.equal(r.vendor, 'Unknown vendor');
  assert.equal(r.date, '2026-10-08');
  assert.equal(r.total, 0);
  assert.equal(r.currency, 'NGN');
  // Everything was guessed, so everything is flagged for checking.
  assert.deepEqual(r.lowConfidence, ['currency', 'date', 'total', 'vendor']);
});
