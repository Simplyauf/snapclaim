import assert from 'node:assert/strict';
import test from 'node:test';
import { Keypair, PublicKey } from '@solana/web3.js';
import { accountAddressToPublicKey, shortAddress } from '../address';

const kp = Keypair.generate();
const base58 = kp.publicKey.toBase58();
const base64 = Buffer.from(kp.publicKey.toBytes()).toString('base64');

test('decodes the base64 address MWA actually returns', () => {
  assert.equal(accountAddressToPublicKey(base64).toBase58(), base58);
});

test('still accepts a base58 address from wallets that send one', () => {
  assert.equal(accountAddressToPublicKey(base58).toBase58(), base58);
});

test('round-trips every encoding to the same key', () => {
  for (let i = 0; i < 50; i++) {
    const k = Keypair.generate().publicKey;
    const b64 = Buffer.from(k.toBytes()).toString('base64');
    assert.equal(accountAddressToPublicKey(b64).toBase58(), k.toBase58());
    assert.equal(accountAddressToPublicKey(k.toBase58()).toBase58(), k.toBase58());
  }
});

test('rejects an address that is not 32 bytes instead of inventing a key', () => {
  assert.throws(() => accountAddressToPublicKey(Buffer.from('short').toString('base64')), /not 32 bytes/);
});

test('shortens for display without mangling a short string', () => {
  assert.equal(shortAddress(base58), `${base58.slice(0, 4)}…${base58.slice(-4)}`);
  assert.equal(shortAddress('abc'), 'abc');
});

test('a base64 address is never mistaken for base58', () => {
  // Regression guard: base64 strings containing +, / or = must not be fed to
  // `new PublicKey(string)`, which would throw or decode to a different key.
  let sawPadded = false;
  for (let i = 0; i < 200 && !sawPadded; i++) {
    const k = Keypair.generate().publicKey;
    const b64 = Buffer.from(k.toBytes()).toString('base64');
    if (/[+/=]/.test(b64)) {
      sawPadded = true;
      assert.equal(accountAddressToPublicKey(b64).toBase58(), k.toBase58());
    }
  }
  assert.ok(sawPadded, 'expected at least one base64 address with +, / or =');
});
