import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { issueToken, requireWallet, verifyWalletSignature } from './auth.js';
import { readReceipt } from './vision.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

/** NFR Security: file type and size are checked before anything is read. */
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED.has(file.mimetype)) return cb(new Error('UNSUPPORTED_TYPE'));
    cb(null, true);
  },
});

/** NFR Security: parsing is rate limited — each call costs real money. */
const parseLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 12,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many scans just now. Wait a moment and try again.' },
  // requireWallet runs before this limiter, so a wallet address is always
  // present. ipKeyGenerator is used for the unreachable fallback because a
  // bare req.ip lets IPv6 clients sidestep the limit by changing address
  // within their /64 — express-rate-limit refuses to start without it.
  keyGenerator: (req) =>
    (req as { session?: { address: string } }).session?.address ?? ipKeyGenerator(req.ip ?? ''),
});

app.get('/health', (_req, res) => res.json({ ok: true }));

/**
 * Exchange a wallet signature for a session token. The message is whatever
 * the wallet signed during sign-in; the signature must verify against the
 * claimed address or no token is issued.
 */
app.post('/api/auth/wallet', (req, res) => {
  const { address, message, signature } = req.body ?? {};
  if (typeof address !== 'string' || typeof message !== 'string' || typeof signature !== 'string') {
    return res.status(400).json({ error: 'address, message and signature are required.' });
  }
  if (!verifyWalletSignature({ address, message, signatureBase64: signature })) {
    return res.status(401).json({ error: 'That signature does not match the address.' });
  }
  return res.json({ token: issueToken(address), address });
});

app.post('/api/receipts/parse', requireWallet, parseLimiter, (req, res) => {
  upload.single('image')(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'That image is too large to read.' });
      }
      if (err.message === 'UNSUPPORTED_TYPE') {
        return res.status(415).json({ error: 'That file type cannot be read.' });
      }
      return res.status(400).json({ error: 'That upload could not be read.' });
    }
    if (!req.file) return res.status(400).json({ error: 'No image was attached.' });

    try {
      const receipt = await readReceipt(
        req.file.buffer.toString('base64'),
        req.file.mimetype as 'image/jpeg',
      );
      return res.json({ receipt });
    } catch (e) {
      // Never leak provider details or key material to the client; the app
      // falls back to manual entry on any failure here (FR-10).
      console.error('parse failed:', e);
      return res.status(502).json({ error: 'The receipt could not be read. Enter it by hand.' });
    }
  });
});

const port = Number(process.env.PORT ?? 8787);

/**
 * Bind 0.0.0.0 explicitly.
 *
 * Without a host argument Node binds the IPv6 wildcard, which on some macOS
 * setups does not accept IPv4 connections on the machine's LAN address: the
 * server answers on 127.0.0.1 but refuses 10.x.x.x, so a phone or emulator on
 * the same Wi-Fi gets ECONNREFUSED while the host's own curl succeeds.
 * Explicit IPv4 binding is what makes on-device testing work.
 */
/**
 * HOST defaults to 0.0.0.0 so a phone or emulator on the LAN can reach a dev
 * machine. Behind a reverse proxy set HOST=127.0.0.1 — otherwise the port is
 * reachable from the internet directly, bypassing nginx, its TLS and any
 * rate limiting in front.
 */
const host = process.env.HOST ?? '0.0.0.0';

app.listen(port, host, () => {
  console.log(`snapclaim server on http://${host}:${port}`);
});
