import { Keypair, LAMPORTS_PER_SOL, sendAndConfirmTransaction } from '@solana/web3.js';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { canonicalize } from '../src/lib/canonical';
import { getConnection, buildSealTransaction, verifySeal, explorerTxUrl } from '../src/lib/solana';

/**
 * Proves the whole seal -> chain -> verify loop against real devnet.
 *
 * The keypair is PERSISTED to .devnet-keypair.json so you fund one address
 * once and reuse it. The public faucet allows only a couple of requests every
 * eight hours, so generating a fresh keypair per run — as this script first
 * did — makes it unusable.
 *
 * This is a throwaway devnet test key. It is gitignored, holds no real value,
 * and must never be used on mainnet.
 */
const KEYPAIR_PATH = new URL('../.devnet-keypair.json', import.meta.url).pathname;

function loadOrCreateKeypair(): Keypair {
  if (existsSync(KEYPAIR_PATH)) {
    const secret = JSON.parse(readFileSync(KEYPAIR_PATH, 'utf8')) as number[];
    return Keypair.fromSecretKey(Uint8Array.from(secret));
  }
  const kp = Keypair.generate();
  mkdirSync(dirname(KEYPAIR_PATH), { recursive: true });
  writeFileSync(KEYPAIR_PATH, JSON.stringify([...kp.secretKey]));
  console.log('created a new devnet test keypair at .devnet-keypair.json');
  return kp;
}

async function main() {
  const h = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');
  const conn = getConnection();
  const payer = loadOrCreateKeypair();
  const address = payer.publicKey.toBase58();
  console.log('payer', address);

  // Fund this address once, then re-run. Airdrop is only attempted when the
  // balance is actually too low, so a funded key never touches the faucet.
  const startingBalance = await conn.getBalance(payer.publicKey);
  console.log('balance', startingBalance / LAMPORTS_PER_SOL, 'SOL');
  if (startingBalance < 5_000_000) {
    console.log(`\nThis address needs devnet SOL. Fund it at:`);
    console.log(`  https://faucet.solana.com   (paste: ${address})`);
    console.log(`  or: solana airdrop 1 ${address} --url devnet\n`);
  }

  const report = {
    month: '2026-10',
    owner: payer.publicKey.toBase58(),
    expenses: [
      { date: '2026-10-06', vendor: 'Shoprite Ikeja', subtotal: 1200000, tax: 90000, total: 1290000, currency: 'NGN' },
      { date: '2026-10-05', vendor: 'Uber', subtotal: null, tax: null, total: 345000, currency: 'NGN' },
    ],
  };
  const canonical = canonicalize(report);
  const fingerprint = h(canonical);
  console.log('fingerprint', fingerprint);

  // The public devnet faucet rate-limits hard and returns a bare "Internal
  // error" when it does, so retry rather than treating the first refusal as
  // a failure of the seal path.
  let funded = startingBalance >= 5_000_000;
  if (!funded) console.log('requesting airdrop…');
  for (let attempt = 1; attempt <= 3 && !funded; attempt++) {
    try {
      const sig = await conn.requestAirdrop(payer.publicKey, LAMPORTS_PER_SOL / 100);
      const bh = await conn.getLatestBlockhash('confirmed');
      await conn.confirmTransaction({ signature: sig, ...bh }, 'confirmed');
      funded = true;
    } catch (e) {
      console.log(`  attempt ${attempt} refused (${(e as Error).message.slice(0, 60)}…)`);
      if (attempt < 3) await new Promise((r) => setTimeout(r, attempt * 4000));
    }
  }
  if (!funded) {
    console.log('\nFAUCET REFUSED and the address is unfunded — nothing was sealed.');
    console.log(`Fund ${address} by hand (links above), then run this again.`);
    process.exit(2);
  }

  const { transaction, memo } = await buildSealTransaction(conn, payer.publicKey, fingerprint, report.month);
  console.log('memo', memo);
  const txsig = await sendAndConfirmTransaction(conn, transaction, [payer], { commitment: 'confirmed' });
  console.log('SEALED', txsig);
  console.log(explorerTxUrl(txsig));

  await new Promise(r => setTimeout(r, 2500));
  console.log('\n--- verify, untouched report');
  console.log(await verifySeal(conn, txsig, fingerprint, '2026-10'));

  console.log('\n--- verify, one character of a vendor changed');
  const tampered = { ...report, expenses: report.expenses.map((e, i) => i === 1 ? { ...e, vendor: 'Ubet' } : e) };
  console.log(await verifySeal(conn, txsig, h(canonicalize(tampered)), '2026-10'));

  console.log('\n--- verify, wrong month claimed');
  console.log(await verifySeal(conn, txsig, fingerprint, '2026-09'));

  console.log('\n--- verify, transaction that carries no seal');
  console.log(await verifySeal(conn, '4'.repeat(87), fingerprint, '2026-10'));
}

main().catch((e) => { console.error(e); process.exit(1); });
