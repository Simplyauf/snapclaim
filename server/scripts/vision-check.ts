import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { readReceipt } from '../src/vision.js';
import { normalizeReceipt } from '../../mobile/src/lib/parse.js';

/**
 * Smoke-tests whichever vision provider .env selects, against a receipt with
 * known values, and scores the result field by field.
 *
 * Use this before trusting a new provider or model: accuracy on small printed
 * amounts varies enormously between vision models, and the 80%-correct-fields
 * target in project.md is measured on exactly this kind of output.
 *
 *   npm run vision:check -- path/to/receipt.png
 */
const DEFAULT_IMAGE = new URL('../fixtures/receipt.png', import.meta.url).pathname;

/** Ground truth for the bundled fixture only. */
const TRUTH = {
  vendor: /shoprite/i,
  date: '2026-10-06',
  subtotal: 1200000,
  tax: 90000,
  total: 1290000,
  currency: 'NGN',
};

async function main() {
  const path = process.argv[2] ?? DEFAULT_IMAGE;
  const scored = path === DEFAULT_IMAGE;
  const media = path.endsWith('.png') ? 'image/png' : 'image/jpeg';

  const img = readFileSync(path).toString('base64');
  console.log(`provider: ${process.env.VISION_PROVIDER ?? 'claude'}   model: ${process.env.VISION_MODEL ?? '(default)'}`);

  const t0 = Date.now();
  const raw = await readReceipt(img, media as 'image/png');
  const ms = Date.now() - t0;

  console.log(`latency : ${ms}ms`);
  console.log('raw     :', JSON.stringify(raw));

  const n = normalizeReceipt(raw);
  const { lowConfidence, ...fields } = n;
  console.log('fields  :', JSON.stringify(fields));
  console.log('flagged :', lowConfidence.join(', ') || '(none)');

  if (!scored) return;

  const checks: Array<[string, boolean]> = [
    ['vendor', TRUTH.vendor.test(n.vendor)],
    ['date', n.date === TRUTH.date],
    ['subtotal', n.subtotal === TRUTH.subtotal],
    ['tax', n.tax === TRUTH.tax],
    ['total', n.total === TRUTH.total],
    ['currency', n.currency === TRUTH.currency],
  ];
  console.log('\nvs ground truth:');
  for (const [f, ok] of checks) console.log(`  ${ok ? 'ok   ' : 'WRONG'} ${f}`);
  const got = checks.filter((c) => c[1]).length;
  console.log(`\n${got}/6 fields correct`);
  // The total is the field a wrong value corrupts a whole report with.
  if (!checks.find((c) => c[0] === 'total')?.[1]) {
    console.log('WARNING: the total was wrong. That field decides the report.');
  }
}

main().catch((e) => {
  console.error('FAILED:', e instanceof Error ? e.message : e);
  process.exit(1);
});
