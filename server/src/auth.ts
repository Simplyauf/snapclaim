import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import nacl from 'tweetnacl';
import bs58 from 'bs58';

/**
 * Wallet-tied sessions (NFR Security: every request carries a token tied to
 * the wallet signature).
 *
 * The app signs a message during Mobile Wallet Adapter sign-in; this verifies
 * that ed25519 signature against the claimed address and issues a short JWT.
 * The server never sees a private key and never issues a token for an address
 * whose signature does not check out.
 */
const JWT_SECRET = process.env.JWT_SECRET ?? '';
const TOKEN_TTL = '7d';

if (!JWT_SECRET) {
  // Failing at boot is correct: a server running with an empty secret would
  // happily mint forgeable tokens.
  throw new Error('JWT_SECRET is not set. Copy .env.example to .env and set it.');
}

export type Session = { address: string };

export function verifyWalletSignature(params: {
  address: string;
  message: string;
  signatureBase64: string;
}): boolean {
  try {
    const publicKey = bs58.decode(params.address);
    if (publicKey.length !== 32) return false;
    return nacl.sign.detached.verify(
      new TextEncoder().encode(params.message),
      Buffer.from(params.signatureBase64, 'base64'),
      publicKey,
    );
  } catch {
    return false;
  }
}

export const issueToken = (address: string): string =>
  jwt.sign({ address }, JWT_SECRET, { expiresIn: TOKEN_TTL });

export function requireWallet(req: Request, res: Response, next: NextFunction) {
  const header = req.header('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Sign in with your wallet first.' });

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { address?: string };
    if (!payload.address) return res.status(401).json({ error: 'Invalid session.' });
    (req as Request & { session?: Session }).session = { address: payload.address };
    return next();
  } catch {
    return res.status(401).json({ error: 'Your session has expired. Sign in again.' });
  }
}
