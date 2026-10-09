import { PublicKey } from '@solana/web3.js';

/**
 * Mobile Wallet Adapter hands back `Account.address` as BASE64 (MWA 2.0), but
 * every Solana surface a user sees — explorers, RPC, the memo signer field —
 * speaks base58. Converting in the wrong direction silently yields a valid
 * but WRONG PublicKey, so this is isolated and tested rather than inlined.
 *
 * Accepts either encoding: some wallets still return base58.
 */
export function accountAddressToPublicKey(address: string): PublicKey {
  // base58 never contains these; their presence proves base64.
  const looksBase64 = /[+/=]/.test(address);

  if (!looksBase64) {
    try {
      const pk = new PublicKey(address);
      if (pk.toBytes().length === 32) return pk;
    } catch {
      // fall through to base64
    }
  }

  const bytes = Buffer.from(address, 'base64');
  if (bytes.length !== 32) {
    throw new Error(`Wallet returned an address that is not 32 bytes: "${address}"`);
  }
  return new PublicKey(bytes);
}

/** Shortened for display: FR-1 asks for a shortened address, not the full key. */
export function shortAddress(base58: string, lead = 4, tail = 4): string {
  return base58.length <= lead + tail + 1 ? base58 : `${base58.slice(0, lead)}…${base58.slice(-tail)}`;
}
