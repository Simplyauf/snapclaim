import assert from 'node:assert/strict';
import test from 'node:test';
import { currencyCode, displayAmount, formatAmount, monthName, tapeDate } from '../money';

test('groups thousands and keeps two decimals', () => {
  assert.equal(formatAmount(0), '0.00');
  assert.equal(formatAmount(5), '0.05');
  assert.equal(formatAmount(100000), '1,000.00');
  assert.equal(formatAmount(123456789), '1,234,567.89');
});

test('groups a negative amount without stranding the minus sign', () => {
  assert.equal(formatAmount(-123456789), '-1,234,567.89');
  assert.equal(formatAmount(-100000), '-1,000.00');
});

test('never emits a currency symbol, only an ISO code', () => {
  const out = displayAmount(1290000, 'ngn');
  assert.equal(out, '12,900.00 NGN');
  assert.ok(!/[₦$€£]/.test(out), 'a symbol would fall back to a system font');
  assert.equal(currencyCode(' usd '), 'USD');
});

test('formats months and tape dates in UTC regardless of device zone', () => {
  assert.equal(monthName('2026-10'), 'October 2026');
  assert.equal(tapeDate('2026-10-05'), '05 OCT');
  assert.equal(tapeDate('2026-01-01'), '01 JAN');
});
