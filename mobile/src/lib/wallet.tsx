import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PublicKey, Transaction } from '@solana/web3.js';
import { transact, Web3MobileWallet } from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import type { AuthToken } from '@solana-mobile/mobile-wallet-adapter-protocol';
import { accountAddressToPublicKey } from './address';
import { CLUSTER, getConnection } from './solana';

/** Shown in the wallet's approval sheet, so it must name the real app. */
const APP_IDENTITY = {
  name: 'SnapClaim',
  uri: 'https://snapclaim.app',
  icon: 'favicon.ico',
};

const CHAIN = `solana:${CLUSTER}` as const;
const STORE_KEY = 'snapclaim.auth.v1';

export type WalletAccount = { address: string; label?: string; publicKey: PublicKey };

/**
 * The sign-in-with-Solana result, in the shape the backend verifies: the
 * message as plain text and the signature as base64. MWA returns both
 * base64-encoded, so the message is decoded here rather than at the call site.
 */
export type SignInProof = { address: string; message: string; signature: string };

type Stored = { authToken: AuthToken; address: string; label?: string; proof?: SignInProof };

type WalletState = {
  account: WalletAccount | null;
  /** Present once the wallet has signed in; exchanged for a backend session. */
  proof: SignInProof | null;
  connecting: boolean;
  restoring: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  signAndSend: (tx: Transaction) => Promise<string>;
};

const WalletContext = createContext<WalletState | null>(null);

/**
 * Turns the adapter's errors into something a claimant can act on. A declined
 * signature and a missing wallet app are ordinary outcomes here, not crashes:
 * FR-20 requires the report to stay a draft and remain retryable.
 */
export class WalletError extends Error {
  constructor(message: string, readonly kind: 'declined' | 'no-wallet' | 'unsupported' | 'failed') {
    super(message);
    this.name = 'WalletError';
  }
}

function toWalletError(e: unknown): WalletError {
  if (e instanceof WalletError) return e;
  const msg = e instanceof Error ? e.message : String(e);
  if (/declin|reject|cancel|user.?denied/i.test(msg)) {
    return new WalletError('You declined the request in your wallet.', 'declined');
  }
  if (/no.?(installed|available|compatible).?wallet|could not find|ERR_WALLET_NOT_FOUND|activity/i.test(msg)) {
    return new WalletError(
      'No compatible wallet app found. Install a Solana wallet that supports Mobile Wallet Adapter, then try again.',
      'no-wallet',
    );
  }
  return new WalletError(msg || 'The wallet request failed.', 'failed');
}

/** MWA is an Android-only transport; fail loudly rather than hanging. */
function assertSupported() {
  if (Platform.OS !== 'android') {
    throw new WalletError(
      'Wallet signing needs the Android app. This build cannot reach a wallet here.',
      'unsupported',
    );
  }
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [account, setAccount] = useState<WalletAccount | null>(null);
  const [proof, setProof] = useState<SignInProof | null>(null);
  const [authToken, setAuthToken] = useState<AuthToken | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [restoring, setRestoring] = useState(true);

  // Restore the previous session's address so Home can render immediately.
  // The auth token is only proven good on the next wallet round trip.
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORE_KEY);
        if (raw) {
          const s: Stored = JSON.parse(raw);
          setAuthToken(s.authToken);
          setAccount({
            address: s.address,
            label: s.label,
            publicKey: new PublicKey(s.address),
          });
          setProof(s.proof ?? null);
        }
      } catch {
        await AsyncStorage.removeItem(STORE_KEY);
      } finally {
        setRestoring(false);
      }
    })();
  }, []);

  const persist = useCallback(async (s: Stored | null) => {
    if (s) await AsyncStorage.setItem(STORE_KEY, JSON.stringify(s));
    else await AsyncStorage.removeItem(STORE_KEY);
  }, []);

  const connect = useCallback(async () => {
    assertSupported();
    setConnecting(true);
    try {
      const result = await transact(async (wallet: Web3MobileWallet) =>
        wallet.authorize({
          chain: CHAIN,
          identity: APP_IDENTITY,
          auth_token: authToken ?? undefined,
          // FR-2: sign-in with a signed message, in the same round trip as
          // authorization so the user approves once instead of twice.
          sign_in_payload: {
            domain: 'snapclaim.app',
            statement:
              'Sign in to SnapClaim. This proves you control this wallet. It costs nothing and moves no funds.',
            uri: 'https://snapclaim.app',
          },
        }),
      );

      const first = result.accounts[0];
      if (!first) throw new WalletError('The wallet returned no account.', 'failed');

      const publicKey = accountAddressToPublicKey(first.address);
      const next: WalletAccount = {
        address: publicKey.toBase58(),
        label: 'label' in first ? first.label : undefined,
        publicKey,
      };
      // sign_in_result is only present when the wallet honoured the SIWS
      // payload; without it the app still works, but backend parsing is
      // unavailable until the next connect that does sign in.
      const signIn = result.sign_in_result;
      const nextProof: SignInProof | null = signIn
        ? {
            address: next.address,
            message: Buffer.from(signIn.signed_message, 'base64').toString('utf8'),
            signature: signIn.signature,
          }
        : null;

      setAccount(next);
      setProof(nextProof);
      setAuthToken(result.auth_token);
      await persist({
        authToken: result.auth_token,
        address: next.address,
        label: next.label,
        proof: nextProof ?? undefined,
      });
    } catch (e) {
      throw toWalletError(e);
    } finally {
      setConnecting(false);
    }
  }, [authToken, persist]);

  const disconnect = useCallback(async () => {
    const token = authToken;
    // Clear locally first: the user asked to be signed out, and that must
    // hold even if the wallet app is gone or refuses the deauthorize call.
    setAccount(null);
    setProof(null);
    setAuthToken(null);
    await persist(null);
    if (token && Platform.OS === 'android') {
      try {
        await transact(async (wallet) => wallet.deauthorize({ auth_token: token }));
      } catch {
        // Already revoked or wallet uninstalled — nothing left to do.
      }
    }
  }, [authToken, persist]);

  /**
   * FR-18: get the seal transaction signed, then broadcast it ourselves.
   *
   * The wallet is asked ONLY to sign — the app submits to its own devnet
   * connection. Using signAndSendTransactions would hand broadcasting to the
   * wallet, which sends on whatever cluster the user has selected in its
   * settings; a wallet left on mainnet would then reject or misroute the
   * seal, and devnet is buried behind a developer-mode toggle in some
   * wallets. Signing is cluster-agnostic, so this makes the seal land on
   * devnet regardless of how the wallet is configured.
   */
  const signAndSend = useCallback(
    async (tx: Transaction) => {
      assertSupported();
      if (!authToken) throw new WalletError('Connect a wallet first.', 'failed');

      let signed: Transaction;
      let refreshedToken: AuthToken | null = null;
      try {
        [signed] = await transact(async (wallet: Web3MobileWallet) => {
          // authorize({ auth_token }), NOT reauthorize().
          //
          // reauthorize() is the MWA 1.0 RPC. Wallets implementing the 2.0
          // spec fold it into authorize() and reject the old method outright
          // — Solflare answers "-1/authorization request failed", which looks
          // like a declined signature rather than an unsupported call.
          const auth = await wallet.authorize({
            chain: CHAIN,
            identity: APP_IDENTITY,
            auth_token: authToken,
          });
          // The wallet may hand back a rotated token; keep it or the next
          // seal re-prompts for authorization.
          refreshedToken = auth.auth_token;
          return wallet.signTransactions({ transactions: [tx] });
        });
      } catch (e) {
        throw toWalletError(e);
      }

      if (refreshedToken && refreshedToken !== authToken) {
        setAuthToken(refreshedToken);
        void persist({
          authToken: refreshedToken,
          address: account?.address ?? '',
          label: account?.label,
        });
      }
      if (!signed) throw new WalletError('The wallet returned no signed transaction.', 'failed');

      try {
        const connection = getConnection();
        const signature = await connection.sendRawTransaction(signed.serialize(), {
          preflightCommitment: 'confirmed',
        });
        const blockhash = await connection.getLatestBlockhash('confirmed');
        const result = await connection.confirmTransaction(
          { signature, ...blockhash },
          'confirmed',
        );
        if (result.value.err) {
          throw new WalletError(`The network rejected the seal: ${JSON.stringify(result.value.err)}`, 'failed');
        }
        return signature;
      } catch (e) {
        if (e instanceof WalletError) throw e;
        // Signed but not broadcast: the report stays a draft and can be
        // retried, which re-signs with a fresh blockhash (FR-20).
        throw new WalletError(
          `Signed, but the seal could not be sent: ${e instanceof Error ? e.message : String(e)}`,
          'failed',
        );
      }
    },
    [authToken, account, persist],
  );

  const value = useMemo(
    () => ({ account, proof, connecting, restoring, connect, disconnect, signAndSend }),
    [account, proof, connecting, restoring, connect, disconnect, signAndSend],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletState {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used inside a WalletProvider');
  return ctx;
}
