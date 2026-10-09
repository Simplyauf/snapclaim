/**
 * Seal/verify behaviour. Run: npm run test
 *
 * verifySeal is the one piece a reviewer leans on, so every branch is pinned
 * here with a stubbed RPC. The transaction shapes below are copied from real
 * devnet memo transactions (parsed-as-string, plus the log fallback), probed
 * via scripts/devnet-seal-check.ts.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { Connection, PublicKey } from '@solana/web3.js';
import { MEMO_PROGRAM_ID, findExistingSeal, verifySeal } from '../solana';
import { buildMemo } from '../canonical';

const FP = 'a'.repeat(64);
const OTHER_FP = 'b'.repeat(64);
const SIGNER = new PublicKey('Ey1nJAvk9UkEEc3DcgNrzQ1a9qaoq82KgaAGVVZ7EnYm');

/** Minimal stand-in for the slice of Connection that readSealMemo touches. */
function stubConn(tx: unknown): Connection {
  return { getParsedTransaction: async () => tx } as unknown as Connection;
}

function txWithParsedMemo(memo: string) {
  return {
    slot: 42,
    blockTime: 1760000000,
    transaction: {
      message: {
        accountKeys: [{ pubkey: SIGNER, signer: true, writable: true }],
        instructions: [{ programId: MEMO_PROGRAM_ID, parsed: memo }],
      },
    },
    meta: { logMessages: [] },
  };
}

function txWithOnlyLogMemo(memo: string) {
  return {
    slot: 43,
    blockTime: null,
    transaction: {
      message: {
        accountKeys: [{ pubkey: SIGNER, signer: true, writable: true }],
        instructions: [{ programId: MEMO_PROGRAM_ID }],
      },
    },
    meta: { logMessages: [`Program log: Memo (len ${memo.length}): "${memo}"`] },
  };
}

test('matches a report that has not changed since sealing', async () => {
  const r = await verifySeal(stubConn(txWithParsedMemo(buildMemo(FP, '2026-10'))), 'sig', FP, '2026-10');
  assert.equal(r.status, 'match');
  assert.equal(r.status === 'match' && r.signer, SIGNER.toBase58());
});

test('reads the memo from logs when the RPC does not parse it', async () => {
  const r = await verifySeal(stubConn(txWithOnlyLogMemo(buildMemo(FP, '2026-10'))), 'sig', FP, '2026-10');
  assert.equal(r.status, 'match');
});

test('reports no match when the report has been edited', async () => {
  const r = await verifySeal(stubConn(txWithParsedMemo(buildMemo(FP, '2026-10'))), 'sig', OTHER_FP, '2026-10');
  assert.equal(r.status, 'nomatch');
  assert.match(r.status === 'nomatch' ? r.reason : '', /changed since it was sealed/);
});

test('refuses a seal belonging to a different month', async () => {
  const r = await verifySeal(stubConn(txWithParsedMemo(buildMemo(FP, '2026-09'))), 'sig', FP, '2026-10');
  assert.equal(r.status, 'nomatch');
  assert.match(r.status === 'nomatch' ? r.reason : '', /2026-09/);
});

test('accepts an upper-cased fingerprint from a pasted field', async () => {
  const r = await verifySeal(stubConn(txWithParsedMemo(buildMemo(FP, '2026-10'))), 'sig', FP.toUpperCase(), '2026-10');
  assert.equal(r.status, 'match');
});

test('ignores a memo that is not a SnapClaim seal', async () => {
  const r = await verifySeal(stubConn(txWithParsedMemo('d15b770c61ae43bf91f96c179ed4d2c4')), 'sig', FP);
  assert.equal(r.status, 'notfound');
});

test('skips instructions from other programs', async () => {
  const tx = txWithParsedMemo(buildMemo(FP, '2026-10'));
  tx.transaction.message.instructions.unshift({
    programId: new PublicKey('11111111111111111111111111111111'),
    parsed: 'not a memo',
  } as never);
  assert.equal((await verifySeal(stubConn(tx), 'sig', FP, '2026-10')).status, 'match');
});

test('reports not found for an unknown transaction', async () => {
  assert.equal((await verifySeal(stubConn(null), 'sig', FP)).status, 'notfound');
});

test('surfaces a network failure instead of claiming no match', async () => {
  const conn = {
    getParsedTransaction: async () => {
      throw new Error('fetch failed');
    },
  } as unknown as Connection;
  const r = await verifySeal(conn, 'sig', FP);
  assert.equal(r.status, 'notfound');
  assert.match(r.status === 'notfound' ? r.reason : '', /Could not reach the network/);
});

/**
 * Seal recovery. This is the case where the fee was already paid: the memo is
 * on chain but the app still shows a draft, so a retry must adopt the existing
 * seal rather than send and pay for an identical one.
 */
test('finds a seal this wallet already wrote for the same report', async () => {
  const memo = buildMemo(FP, '2026-10');
  const conn = {
    getSignaturesForAddress: async () => [{ signature: 'sigA', err: null }],
    getParsedTransaction: async () => txWithParsedMemo(memo),
  } as unknown as Connection;
  const found = await findExistingSeal(conn, SIGNER, FP, '2026-10');
  assert.equal(found?.signature, 'sigA');
});

test('ignores a seal for a different month or fingerprint', async () => {
  const conn = (memo: string) =>
    ({
      getSignaturesForAddress: async () => [{ signature: 'sigA', err: null }],
      getParsedTransaction: async () => txWithParsedMemo(memo),
    }) as unknown as Connection;
  assert.equal(await findExistingSeal(conn(buildMemo(FP, '2026-09')), SIGNER, FP, '2026-10'), null);
  assert.equal(await findExistingSeal(conn(buildMemo(OTHER_FP, '2026-10')), SIGNER, FP, '2026-10'), null);
});

test('skips failed transactions when looking for an existing seal', async () => {
  const conn = {
    getSignaturesForAddress: async () => [{ signature: 'sigFailed', err: { InstructionError: [0, 'X'] } }],
    getParsedTransaction: async () => txWithParsedMemo(buildMemo(FP, '2026-10')),
  } as unknown as Connection;
  assert.equal(await findExistingSeal(conn, SIGNER, FP, '2026-10'), null);
});

test('returns null when the RPC is unreachable instead of blocking a seal', async () => {
  const conn = {
    getSignaturesForAddress: async () => {
      throw new Error('fetch failed');
    },
  } as unknown as Connection;
  assert.equal(await findExistingSeal(conn, SIGNER, FP, '2026-10'), null);
});
