import { FileSystemUploadType, getInfoAsync, uploadAsync } from 'expo-file-system/legacy';
import { RawReceipt } from './parse';

/**
 * Backend client. The AI provider key and database credentials live only on
 * the server (NFR Security) — this file never holds a secret, only the wallet
 * session token.
 */
const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

/** NFR Performance: a receipt should parse in under 10s on a normal connection. */
const PARSE_TIMEOUT_MS = 20000;

/** NFR Security: file size is checked before upload, not only on the server. */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

export class ParseError extends Error {
  /**
   * `detail` carries the underlying failure verbatim. A release build strips
   * console logging, so without this a failed scan on a real phone is
   * indistinguishable from a wrong URL, an unreadable image file, or a dead
   * server — the review screen shows it in small type under the friendly
   * message so a tester can report something actionable.
   */
  constructor(
    message: string,
    readonly kind: 'offline' | 'timeout' | 'rejected' | 'server',
    readonly detail?: string,
  ) {
    super(message);
    this.name = 'ParseError';
  }
}

export type ParseResponse = { receipt: RawReceipt; imageId?: string };

export type SignInProof = { address: string; message: string; signature: string };

/**
 * Exchange the wallet's sign-in signature for a backend session token
 * (NFR Security: every request carries a token tied to the wallet signature).
 *
 * Returns null rather than throwing when no backend is configured, so the
 * stub-parser path keeps working offline.
 */
export async function authenticate(proof: SignInProof): Promise<string | null> {
  if (usingStubParser()) return null;
  const res = await fetch(`${BASE_URL}/api/auth/wallet`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(proof),
  });
  if (!res.ok) throw new ParseError('Could not sign in to the server.', 'rejected');
  const json = (await res.json()) as { token?: string };
  if (!json.token) throw new ParseError('The server did not return a session.', 'server');
  return json.token;
}

/**
 * Deterministic stand-in used when EXPO_PUBLIC_API_URL is unset, so capture
 * and review can be demoed and tested before the backend is up. It returns
 * the awkward shapes a real model returns — grouped amounts, an ambiguous
 * numeric date — rather than clean data that would hide normalisation bugs.
 */
async function stubParse(): Promise<ParseResponse> {
  await new Promise((r) => setTimeout(r, 1200));
  return {
    receipt: {
      vendor: 'Shoprite Ikeja',
      date: '06/10/2026',
      subtotal: '12,000.00',
      tax: '900.00',
      total: '12,900.00',
      currency: 'NGN',
    },
  };
}

export const usingStubParser = () => BASE_URL === '';

/** uploadAsync has no timeout option, so impose one. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), ms)),
  ]);
}

/**
 * Send a receipt image to the backend and get structured fields back.
 *
 * Every failure path throws a ParseError the review screen can act on: FR-10
 * requires that a failed parse still lets the user type the fields by hand
 * rather than losing the receipt.
 */
export async function parseReceipt(
  imageUri: string,
  opts: { token?: string; signal?: AbortSignal } = {},
): Promise<ParseResponse> {
  if (usingStubParser()) return stubParse();

  // Size is checked on the phone as well as the server (NFR Security), so an
  // oversized photo fails instantly instead of after a long upload.
  try {
    const info = await getInfoAsync(imageUri);
    if (info.exists && typeof info.size === 'number' && info.size > MAX_UPLOAD_BYTES) {
      throw new ParseError('That image is too large to read.', 'rejected');
    }
  } catch (e) {
    if (e instanceof ParseError) throw e;
    // Could not stat the file — let the upload surface the real problem.
  }

  try {
    /**
     * uploadAsync, not fetch + FormData.
     *
     * React Native's new architecture rejects the classic
     * `FormData.append(name, {uri, name, type})` idiom with "Unsupported
     * FormDataPart implementation" — it wants a real Blob. uploadAsync builds
     * the multipart body natively and streams the file straight from disk,
     * so a multi-megabyte receipt never passes through JS memory.
     */
    const res = await withTimeout(
      uploadAsync(`${BASE_URL}/api/receipts/parse`, imageUri, {
        httpMethod: 'POST',
        uploadType: FileSystemUploadType.MULTIPART,
        fieldName: 'image',
        mimeType: 'image/jpeg',
        headers: opts.token ? { Authorization: `Bearer ${opts.token}` } : {},
      }),
      PARSE_TIMEOUT_MS,
    );

    if (res.status === 413) throw new ParseError('That image is too large to read.', 'rejected');
    if (res.status === 415) throw new ParseError('That file type cannot be read.', 'rejected');
    if (res.status === 429) {
      throw new ParseError('Too many scans just now. Wait a moment and try again.', 'rejected');
    }
    if (res.status === 401) {
      throw new ParseError('Your session expired. Reconnect your wallet.', 'rejected');
    }
    if (res.status < 200 || res.status >= 300) {
      throw new ParseError(
        `The server could not read that receipt (${res.status}).`,
        'server',
        res.body?.slice(0, 200),
      );
    }

    let json: ParseResponse;
    try {
      json = JSON.parse(res.body) as ParseResponse;
    } catch {
      throw new ParseError('The server sent back something unexpected.', 'server', res.body?.slice(0, 200));
    }
    if (!json || typeof json !== 'object' || !json.receipt) {
      throw new ParseError('The server sent back something unexpected.', 'server', res.body?.slice(0, 200));
    }
    return json;
  } catch (e) {
    if (e instanceof ParseError) throw e;
    if (e instanceof Error && e.message === 'TIMEOUT') {
      throw new ParseError('Reading the receipt took too long.', 'timeout');
    }
    const detail = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    throw new ParseError(
      'Could not reach the server. Check your connection.',
      'offline',
      `${BASE_URL} — ${detail}`,
    );
  }
}
