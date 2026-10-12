# SnapClaim

Photograph a paper receipt, get a clean expense line, and hand your reviewer a
monthly report they can check has not been edited since you sealed it.

Built for CLOCK IN, the Solana Mobile hackathon. **Devnet only — no real funds.**

Sealing proves a report is unchanged since it was sealed. It does **not** prove
the receipts are genuine, or that nothing was left out before sealing.

## Repository layout

| Path | What it is |
|---|---|
| `mobile/` | The Android app (Expo dev build, React Native) |
| `server/` | Node backend: receipt parsing and wallet-tied sessions |
| `project.md` | The business requirements this build is held to |

## Known dependency findings

A security scan flags three moderate-severity advisories (`stream-json`,
`uuid`) pulled in transitively by `@solana/web3.js` and the Mobile Wallet
Adapter packages — not code in this repo. Neither is reachable from how this
app uses them: the `stream-json` DoS needs attacker-supplied deeply nested
JSON parsed by the dependency itself, and the `uuid` issue needs a caller to
pass a custom buffer, which nothing here does. `@solana/web3.js` is already
pinned to its latest 1.x (`1.99.0`); the fix is migrating to `@solana/kit`, a
different API, which is a deliberate post-hackathon change rather than one to
make against a working, on-device-verified signing path under deadline.

## Where the code lives

For anyone auditing the claims in the deck, each one maps to a file:

| Claim | File |
|---|---|
| Mobile Wallet Adapter: discovery, sign-in-with-Solana, signing | [`mobile/src/lib/wallet.tsx`](mobile/src/lib/wallet.tsx) |
| Android package visibility (`solana-wallet` queries) — without this no wallet is discoverable on Android 11+ | [`mobile/plugins/withSolanaWalletQueries.js`](mobile/plugins/withSolanaWalletQueries.js) |
| Canonical report form + SHA-256 fingerprint (pure, no RN/node deps) | [`mobile/src/lib/canonical.ts`](mobile/src/lib/canonical.ts) |
| Memo transaction, verification, idempotent seal lookup | [`mobile/src/lib/solana.ts`](mobile/src/lib/solana.ts) |
| Report CSV the reviewer receives | [`mobile/src/lib/csv.ts`](mobile/src/lib/csv.ts) |
| Browser verifier — recomputes the hash, ignores the claimant's fingerprint | [`web/src/verify.ts`](web/src/verify.ts), bundled to `web/verify.js` |
| Report versioning after a seal (FR-21) | [`mobile/src/lib/store.ts`](mobile/src/lib/store.ts) |
| Backend: wallet-signature sessions, rate limiting, upload validation | [`server/src/index.ts`](server/src/index.ts), [`server/src/auth.ts`](server/src/auth.ts) |
| Vision provider (Claude or any OpenAI-compatible host) | [`server/src/vision.ts`](server/src/vision.ts) |
| Tests | [`mobile/src/lib/__tests__/`](mobile/src/lib/__tests__/) |

### Verifying the claims yourself

```bash
cd mobile && npm install && npm test     # 68 tests
```

The real output — pass/fail, coverage by file — is captured in [TESTS.md](TESTS.md)
rather than just claimed.

Covers canonical determinism, single-character tamper detection, report
versioning after sealing, MWA's base64 address encoding, amount and date
normalisation, CSV round-trip, and every verification outcome.

**Idempotent sealing** is `findExistingSeal` in `mobile/src/lib/solana.ts`,
called by `ReportScreen` before any transaction is built: if this wallet has
already written this fingerprint for this month, the app adopts that seal
instead of paying for an identical one. Tests for it are in
`mobile/src/lib/__tests__/solana.test.ts`.

**A real seal to check against** — this report was sealed from the app on
devnet, and the CSV round-trip test reproduces its fingerprint exactly:

```
memo        snapclaim:v1:2026-10:1df7213fb91f64aa96f9de644e8f5db4f48237d13c325cf1e361bd3f72b8c101
signature   4wSfsWUeEMDcEd2QfkZ8NzyKSgRzyoJSySHBEUTu2NvKR9ecmY72HAzrVBoSa4r3dhGXxqP2msoe8oxVKWbAmEnF
explorer    https://explorer.solana.com/tx/4wSfsWUeEMDcEd2QfkZ8NzyKSgRzyoJSySHBEUTu2NvKR9ecmY72HAzrVBoSa4r3dhGXxqP2msoe8oxVKWbAmEnF?cluster=devnet
```

### Android build

```bash
cd mobile && npx expo prebuild --platform android
cd android && ./gradlew assembleRelease
```

Needs JDK 17 and Android SDK platform 36. Mobile Wallet Adapter requires a
native build — Expo Go cannot sign transactions.

## What works today

- Wallet connect and sign-in through Mobile Wallet Adapter (FR-1, FR-2)
- Camera capture, gallery import, flash, on-device compression (FR-3, FR-4, FR-5)
- Receipt parsing via Claude vision, with an editable review screen and
  low-confidence fields marked (FR-6 – FR-9)
- Manual entry fallback when parsing fails (FR-10)
- Monthly expense log with a running total (FR-11)
- Canonical report form, SHA-256 fingerprint, sealing to devnet, and
  verification (FR-14, FR-15, FR-18 – FR-22)
- Devnet safety banner (FR-25)

## Requirements

- Node 20+ (developed on 22)
- JDK 17
- Android SDK with platform 36 and build-tools 36.x
- An Android phone or emulator, and a wallet app that supports Mobile Wallet
  Adapter

## Running it

### 1. Backend

```bash
cd server
npm install
cp .env.example .env     # then fill in ANTHROPIC_API_KEY and JWT_SECRET
npm run dev              # listens on :8787
```

`.env.example` lists every setting the server needs. API keys and the session
secret live only here — never in the APK.

### Choosing a vision provider

Receipt reading works with either Anthropic or any OpenAI-compatible host, set
in `.env` with no code change:

| Provider | Config | Notes |
|---|---|---|
| Groq (free) | `VISION_PROVIDER=openai-compatible`, `VISION_BASE_URL=https://api.groq.com/openai/v1`, `VISION_MODEL=qwen/qwen3.8-27b` | **Verified 6/6 fields correct in ~1.5s.** Most other Groq models are text-only and reject images. |
| Claude | `VISION_PROVIDER=claude`, `ANTHROPIC_API_KEY=...` | Billed per token (~1 cent per receipt). A Claude Pro subscription does **not** cover API use — that is separate billing. |
| Local / other | any `/v1/chat/completions` host, e.g. Ollama at `http://localhost:11434/v1` | No key needed for a local host. |

Check any provider against a receipt with known values before trusting it:

```bash
cd server && npm run vision:check
```

It scores all six fields and warns loudly if the total is wrong, since that is
the field that corrupts a whole report.

Generate a session secret with:

```bash
openssl rand -base64 48
```

### 2. Mobile app

```bash
cd mobile
npm install
```

Point the app at your backend by creating `mobile/.env`:

```
EXPO_PUBLIC_API_URL=http://<your-machine-ip>:8787
```

Leave `EXPO_PUBLIC_API_URL` unset to run against a built-in sample parser —
capture and review work offline, with no backend and no API costs.

Then build and install a dev build (Mobile Wallet Adapter needs native code, so
Expo Go will not work):

```bash
npx expo run:android
```

For a standalone APK that runs without a Metro server — what you hand to a
tester or a judge:

```bash
cd mobile/android && ./gradlew assembleRelease
# mobile/android/app/build/outputs/apk/release/app-release.apk
```

### Running on the Android emulator

Use `10.0.2.2`, the emulator's fixed alias for your host machine:

```
EXPO_PUBLIC_API_URL=http://10.0.2.2:8787
```

This is worth preferring over your LAN IP: it never changes when you switch
Wi-Fi or tether to a phone, whereas a baked-in LAN IP silently stops resolving
and every scan then fails with a connection error.

Install a wallet inside the emulator from the Play Store (the system image must
be a `google_apis_playstore` one), create a **throwaway** wallet, and fund it
from the faucet. Never import a real recovery phrase into an emulator.

A receipt can be pushed straight into the emulator's gallery:

```bash
adb push server/fixtures/receipt.png /sdcard/Pictures/
```

The emulator's camera is a synthetic pattern and useless for OCR — use gallery
import there, and test the camera on a physical phone.

## Troubleshooting

**"Could not reach the server" on every scan.** The review screen prints the
underlying cause in small type beneath the message — read that first, it names
the actual failure. Common ones:

- `Unsupported FormDataPart implementation` — React Native's new architecture
  rejects `FormData.append(name, {uri, name, type})`, the idiom most upload
  tutorials still use. Uploads go through `uploadAsync` from
  `expo-file-system/legacy` instead; don't "simplify" it back to `fetch` with
  `FormData`.
- A stale IP in the URL — the address is baked in at build time. Rebuild after
  changing networks, or use `10.0.2.2` on an emulator.
- Cleartext blocked — Android matches `<domain>` rules by hostname, never by IP
  literal, so a scoped network-security config silently drops LAN traffic.
  `plugins/withDevCleartext.js` handles this; it emits nothing at all for an
  https backend.

**"No compatible wallet app found."** No MWA-capable wallet is installed, or
the `<queries>` entry for the `solana-wallet` scheme is missing from the
manifest — Android 11+ hides apps you have not declared. See
`plugins/withSolanaWalletQueries.js`. Verify it survived into the APK:

```bash
aapt2 dump xmltree --file AndroidManifest.xml <apk> | grep solana-wallet
```

**Sealing times out.** The wallet never answered the signing request. The
report stays a draft and nothing is written — retry it. Approve the prompt
promptly; the adapter's response window is short.

**Backend reachable from the host but not the phone.** Node binds the IPv6
wildcard by default, which on some macOS setups refuses IPv4 on the LAN
address — `127.0.0.1` answers while `10.x.x.x` is refused. The server binds
`0.0.0.0` explicitly for this reason.

### 3. Devnet SOL

Sealing needs a little devnet SOL for the transaction fee. The public faucet is
heavily rate limited — request it early:

```bash
solana airdrop 1 <your-wallet-address> --url devnet
```

or use https://faucet.solana.com. Keep a second funded wallet as a backup.

## Tests

```bash
cd mobile && npm test
```

Covers the parts where a silent bug would corrupt a sealed report: canonical
form determinism, one-character tamper detection, report versioning after a
seal, MWA's base64 address encoding, amount and date normalisation, and every
verify outcome.

```bash
cd mobile && npm run seal:check
```

Seals a real report to devnet and verifies it, including a tampered copy.
Needs a funded wallet; exits with a clear message if the faucet refuses.

## Design

The app deliberately does not use a default system sans. Three faces, each with
one job:

- **Instrument Serif** — money and screen titles
- **Schibsted Grotesk** — UI text, labels, buttons
- **Martian Mono** — fingerprints, signatures, amount columns, micro labels

Amounts are shown with ISO codes (`12,900.00 NGN`), never symbols: none of the
three faces contains ₦, so a symbol would silently fall back to a system font.

To review the type scale and primitives in both colour schemes without a
device:

```bash
cd mobile && EXPO_PUBLIC_PREVIEW=1 npx expo start --web
```

## How sealing works

1. The month's expenses are put into one fixed canonical form — sorted, fixed
   key order, amounts as fixed decimal strings from integer minor units.
2. The SHA-256 of that text is the fingerprint.
3. One memo instruction carrying `snapclaim:v1:<month>:<fingerprint>` is signed
   by the wallet and sent to devnet.
4. The transaction signature is stored with the report, and that version
   becomes read only.

Verifying rebuilds the canonical text, hashes it, reads the memo back from the
transaction, and compares.

`mobile/src/lib/canonical.ts` is dependency-free on purpose — the phone, the
backend and the browser verify page must all produce byte-identical text, or
verification means nothing. The format string `snapclaim/report/v1` is frozen:
a sealed report must keep verifying forever.
