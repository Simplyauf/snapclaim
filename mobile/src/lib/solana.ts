import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  clusterApiUrl,
} from '@solana/web3.js';
import { buildMemo, parseMemo } from './canonical';

/** Hackathon build is devnet-only (project.md, Network). Nothing here may
 *  reach mainnet without a deliberate change to this constant. */
export const CLUSTER = 'devnet' as const;

export const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

export function getConnection(endpoint?: string): Connection {
  return new Connection(endpoint ?? clusterApiUrl(CLUSTER), 'confirmed');
}

export function explorerTxUrl(signature: string): string {
  return `https://explorer.solana.com/tx/${signature}?cluster=${CLUSTER}`;
}

/**
 * The seal transaction: a single memo instruction carrying the fingerprint.
 * No custom program, no value transfer — the fee payer signs, and the memo
 * program requires the payer as a signer so the memo is attributable.
 */
export function buildMemoInstruction(payer: PublicKey, memo: string): TransactionInstruction {
  return new TransactionInstruction({
    keys: [{ pubkey: payer, isSigner: true, isWritable: false }],
    programId: MEMO_PROGRAM_ID,
    data: Buffer.from(memo, 'utf8'),
  });
}

export async function buildSealTransaction(
  connection: Connection,
  payer: PublicKey,
  fingerprint: string,
  month: string,
): Promise<{ transaction: Transaction; memo: string }> {
  const memo = buildMemo(fingerprint, month);
  const { blockhash } = await connection.getLatestBlockhash('confirmed');
  const transaction = new Transaction({ feePayer: payer, recentBlockhash: blockhash }).add(
    buildMemoInstruction(payer, memo),
  );
  return { transaction, memo };
}

/**
 * Read the SnapClaim memo back out of a confirmed transaction.
 *
 * Two routes, because RPC providers differ in what they return: the parsed
 * instruction is the clean path, and the `Program log: Memo (len N): "..."`
 * line is the fallback for nodes that hand back an unparsed memo. Returns
 * null if the transaction exists but carries no SnapClaim memo.
 */
export async function readSealMemo(
  connection: Connection,
  signature: string,
): Promise<{ memo: string; slot: number; blockTime: number | null; signer: string } | null> {
  const tx = await connection.getParsedTransaction(signature, {
    commitment: 'confirmed',
    maxSupportedTransactionVersion: 0,
  });
  if (!tx) return null;

  const signer = tx.transaction.message.accountKeys.find((k) => k.signer)?.pubkey.toBase58() ?? '';
  const meta = { slot: tx.slot, blockTime: tx.blockTime ?? null, signer };

  for (const ix of tx.transaction.message.instructions) {
    if (!ix.programId.equals(MEMO_PROGRAM_ID)) continue;
    const parsed = (ix as { parsed?: unknown }).parsed;
    if (typeof parsed === 'string' && parseMemo(parsed)) return { memo: parsed, ...meta };
  }

  for (const line of tx.meta?.logMessages ?? []) {
    const m = /^Program log: Memo \(len \d+\): "(.*)"$/.exec(line);
    if (m && parseMemo(m[1])) return { memo: m[1], ...meta };
  }
  return null;
}

export type VerifyResult =
  | { status: 'match'; signer: string; blockTime: number | null; slot: number }
  | { status: 'nomatch'; reason: string; onChain?: string; expected: string }
  | { status: 'notfound'; reason: string };

/**
 * Compare a locally rebuilt fingerprint against what was sealed on devnet.
 *
 * Deliberately strict and deliberately narrow: a match proves the report is
 * byte-identical to the one sealed at that transaction. It proves nothing
 * about whether the receipts were genuine or complete (project.md, Risks).
 */
export async function verifySeal(
  connection: Connection,
  signature: string,
  expectedFingerprint: string,
  expectedMonth?: string,
): Promise<VerifyResult> {
  let found;
  try {
    found = await readSealMemo(connection, signature);
  } catch (e) {
    return { status: 'notfound', reason: `Could not reach the network: ${String(e)}` };
  }
  if (!found) {
    return { status: 'notfound', reason: 'No SnapClaim seal found in that transaction.' };
  }

  const onChain = parseMemo(found.memo);
  if (!onChain) {
    return { status: 'nomatch', reason: 'The memo is not a SnapClaim seal.', expected: expectedFingerprint };
  }
  if (expectedMonth && onChain.month !== expectedMonth) {
    return {
      status: 'nomatch',
      reason: `That seal is for ${onChain.month}, not ${expectedMonth}.`,
      onChain: onChain.fingerprint,
      expected: expectedFingerprint,
    };
  }
  if (onChain.fingerprint !== expectedFingerprint.toLowerCase()) {
    return {
      status: 'nomatch',
      reason: 'The report has changed since it was sealed.',
      onChain: onChain.fingerprint,
      expected: expectedFingerprint,
    };
  }
  return { status: 'match', signer: found.signer, blockTime: found.blockTime, slot: found.slot };
}

/**
 * Look for a seal this wallet has already written for a given fingerprint.
 *
 * Sealing is two steps that can come apart: the wallet signs and the network
 * accepts the transaction, then the app records it. If the app dies, loses the
 * network, or the confirmation times out in between, the fee has been paid and
 * the memo is on chain while the report still looks like a draft — and tapping
 * Seal again would pay a second time for an identical memo.
 *
 * So before sending anything, check whether the work is already done.
 * Satisfies "sealing is safe to retry and cannot seal the same report version
 * twice" (project.md, Reliability).
 */
export async function findExistingSeal(
  connection: Connection,
  owner: PublicKey,
  fingerprint: string,
  month: string,
  lookback = 25,
): Promise<{ signature: string; blockTime: number | null } | null> {
  let signatures;
  try {
    signatures = await connection.getSignaturesForAddress(owner, { limit: lookback });
  } catch {
    // Offline or RPC failure: report nothing found rather than blocking a
    // seal the user asked for.
    return null;
  }

  const wanted = buildMemo(fingerprint.toLowerCase(), month);
  for (const entry of signatures) {
    if (entry.err) continue;
    try {
      const found = await readSealMemo(connection, entry.signature);
      if (found?.memo === wanted) {
        return { signature: entry.signature, blockTime: found.blockTime };
      }
    } catch {
      // Skip transactions we cannot read; keep scanning.
    }
  }
  return null;
}
