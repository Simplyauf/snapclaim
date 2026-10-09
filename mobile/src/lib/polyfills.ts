/**
 * Must be imported before anything touches @solana/web3.js.
 *
 * Hermes ships neither crypto.getRandomValues nor Buffer, and web3.js needs
 * both — for blockhash-bearing transaction serialisation and for the memo
 * instruction's Buffer.from(). Importing this late produces a confusing
 * "crypto.getRandomValues is not a function" at signing time.
 */
import 'react-native-get-random-values';
import { Buffer } from 'buffer';

if (typeof global.Buffer === 'undefined') {
  global.Buffer = Buffer;
}
