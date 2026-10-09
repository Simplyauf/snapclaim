import * as Crypto from 'expo-crypto';
import { canonicalize, CanonicalReport } from './canonical';

/** SHA-256 of the canonical text, lowercase hex. */
export async function sha256Hex(text: string): Promise<string> {
  return (
    await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, text, {
      encoding: Crypto.CryptoEncoding.HEX,
    })
  ).toLowerCase();
}

export async function fingerprintReport(
  report: CanonicalReport,
): Promise<{ canonical: string; fingerprint: string }> {
  const canonical = canonicalize(report);
  return { canonical, fingerprint: await sha256Hex(canonical) };
}

/** Display form: 64 hex chars are unreadable, so group them in fours. */
/** 4 groups per line: 8 overflows phone width in Martian Mono and wraps. */
export function groupHex(hex: string, group = 4, perLine = 4): string[] {
  const chunks = hex.match(new RegExp(`.{1,${group}}`, 'g')) ?? [];
  const lines: string[] = [];
  for (let i = 0; i < chunks.length; i += perLine) {
    lines.push(chunks.slice(i, i + perLine).join(' '));
  }
  return lines;
}

export function shortHex(hex: string): string {
  return hex.length <= 16 ? hex : `${hex.slice(0, 8)}…${hex.slice(-8)}`;
}
