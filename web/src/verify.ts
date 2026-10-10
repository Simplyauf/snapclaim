/**
 * Browser verification for a reviewer.
 *
 * Imports canonical.ts and csv.ts straight from the app's source and bundles
 * them, rather than reimplementing the format here. A second implementation
 * that drifted by one byte would not fail loudly — it would quietly start
 * telling reviewers that honest reports do not match, or that tampered ones
 * do. One implementation, one source of truth.
 */
import { canonicalize, parseMemo, totalsByCurrency } from '../../mobile/src/lib/canonical';
import { fromCsv } from '../../mobile/src/lib/csv';

const RPC = 'https://api.devnet.solana.com';
const MEMO_PROGRAM = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';

async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

type ChainSeal = { memo: string; signer: string; blockTime: number | null; slot: number };

/** Read the SnapClaim memo back off devnet with a plain JSON-RPC call. */
async function fetchSeal(signature: string): Promise<ChainSeal | null> {
  const res = await fetch(RPC, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getTransaction',
      params: [signature, { encoding: 'jsonParsed', commitment: 'confirmed', maxSupportedTransactionVersion: 0 }],
    }),
  });
  if (!res.ok) throw new Error(`The Solana node replied ${res.status}.`);
  const json = await res.json();
  if (json.error) throw new Error(json.error.message ?? 'The Solana node rejected that signature.');
  const tx = json.result;
  if (!tx) return null;

  const keys = tx.transaction?.message?.accountKeys ?? [];
  const signer = keys.find((k: { signer?: boolean }) => k.signer)?.pubkey ?? '';
  const meta = { signer, blockTime: tx.blockTime ?? null, slot: tx.slot ?? 0 };

  for (const ix of tx.transaction?.message?.instructions ?? []) {
    if (ix.programId === MEMO_PROGRAM && typeof ix.parsed === 'string' && parseMemo(ix.parsed)) {
      return { memo: ix.parsed, ...meta };
    }
  }
  // Some nodes return the memo only in the logs.
  for (const line of tx.meta?.logMessages ?? []) {
    const m = /^Program log: Memo \(len \d+\): "(.*)"$/.exec(line);
    if (m && parseMemo(m[1])) return { memo: m[1], ...meta };
  }
  return null;
}

export type Outcome =
  | { status: 'match'; fingerprint: string; signer: string; blockTime: number | null; month: string; rows: number; totals: Record<string, number> }
  | { status: 'nomatch'; reason: string; computed: string; onChain?: string }
  | { status: 'error'; reason: string };

/**
 * The whole reviewer check: rebuild the report from the file, hash it here in
 * the browser, read what was sealed, compare. Nothing the claimant wrote is
 * taken on trust — not even the fingerprint line in their own file.
 */
export async function verifyCsv(csvText: string, signatureOverride?: string): Promise<Outcome> {
  let parsed;
  try {
    parsed = fromCsv(csvText);
  } catch (e) {
    return { status: 'error', reason: e instanceof Error ? e.message : String(e) };
  }

  const canonical = canonicalize(parsed.report);
  const computed = await sha256Hex(canonical);
  const signature = (signatureOverride || parsed.meta.signature || '').trim();

  if (!signature) {
    return {
      status: 'error',
      reason: 'This report has no transaction signature, so there is nothing on chain to check it against. It may never have been sealed.',
    };
  }

  let seal: ChainSeal | null;
  try {
    seal = await fetchSeal(signature);
  } catch (e) {
    return { status: 'error', reason: e instanceof Error ? e.message : String(e) };
  }
  if (!seal) {
    return { status: 'error', reason: 'No SnapClaim seal was found in that transaction.' };
  }

  const onChain = parseMemo(seal.memo);
  if (!onChain) return { status: 'error', reason: 'That transaction does not carry a SnapClaim seal.' };

  if (onChain.month !== parsed.report.month) {
    return {
      status: 'nomatch',
      reason: `The sealed transaction covers ${onChain.month}, but this file is for ${parsed.report.month}.`,
      computed,
      onChain: onChain.fingerprint,
    };
  }
  if (onChain.fingerprint !== computed) {
    return {
      status: 'nomatch',
      reason: 'This report does not match what was sealed. It has been changed since.',
      computed,
      onChain: onChain.fingerprint,
    };
  }

  return {
    status: 'match',
    fingerprint: computed,
    signer: seal.signer,
    blockTime: seal.blockTime,
    month: parsed.report.month,
    rows: parsed.report.expenses.length,
    totals: totalsByCurrency(parsed.report.expenses),
  };
}

// Exposed for the page's inline script.
(globalThis as Record<string, unknown>).SnapClaimVerify = { verifyCsv };
