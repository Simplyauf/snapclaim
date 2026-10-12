# SnapClaim — pitch deck
Eight slides. Bold line is the slide; the rest is speaker notes.

---
## 1. Title
**SnapClaim**
Photograph a receipt. Hand over a month's expenses nobody can quietly edit.

Abdulazeez UmarFaruq · solo · CLOCK IN · Solana devnet

---
## 2. The problem
**Expense claims run on trust and retyping.**

- Freelancers and DAO contributors retype paper receipts into a spreadsheet at month end.
- The person reimbursing receives a file that could have been edited after it was filed.
- Nobody can tell the difference between an honest report and an edited one.

Notes: this is my own monthly chore. I built the tool I wanted.

---
## 3. What it does
**Scan. Seal. Verify.**

1. **Scan** — photograph a receipt, the fields are read for you, uncertain ones are flagged for checking.
2. **Seal** — the month is reduced to a fixed canonical form, hashed, and that fingerprint is signed with your wallet and written to Solana.
3. **Verify** — your reviewer drops the exported CSV into a web page that recomputes the hash and compares it to the chain. No app install.

---
## 4. The moment
**Change one character. Watch it break.**

Live in the demo: export the report, verify → **MATCH**. Edit a single amount, verify again → **NO MATCH**.

Notes: this is the product in one screen. Everything else is plumbing.

---
## 5. Why the reviewer can trust it
**The reviewer never trusts the claimant's word — not even their fingerprint.**

A fingerprint sent on its own is circular: it comes from the person being checked. So the verify page **ignores the fingerprint in the file** and recomputes it from the expense rows, in the reviewer's own browser, then compares against the memo on chain.

**What sealing proves:** the report is byte-for-byte what was sealed, at that transaction.
**What it does not prove:** that the receipts are genuine, or that nothing was left out. It is a tamper check, not an audit — and the app says so on screen.

---
## 6. Why this is a mobile app
**The phone is the only place this works.**

- Receipts are paper and appear when you are out. Capture has to be in your pocket.
- **Mobile Wallet Adapter** end to end: discovery, sign-in-with-Solana in one approval, transaction signing. Needs a native build — Expo Go cannot do it.
- The app **broadcasts its own transaction**; the wallet only signs, so the seal lands on the right cluster regardless of the wallet's settings.
- Hashing happens **on the phone**. Only the fingerprint goes on-chain — never your receipts, never your amounts.
- Sealing is **idempotent**: the app checks the chain before sending, so a crash never makes you pay twice.

---
## 7. Why people come back
**A running total you actually want to open.**

- The month's total is the first thing on the home screen, and it moves every time you scan.
- Sealing is monthly and habitual — the claim cycle already exists; SnapClaim attaches to it.
- Weekly reminder to scan before receipts are lost (next).

**Next:** PDF export · categories and tags · multi-currency · team workspaces with approval · reimbursement payout · dApp Store.

---
## 8. Status
**Working today, on a real phone, against real devnet.**

- Scan → parse → seal → verify, proven end to end on an Android device.
- A real sealed transaction on devnet, with tamper detection demonstrated.
- 68 automated tests over canonical form, tamper detection, report versioning and verification.
- Backend deployed, HTTPS, no API key in the APK.

APK · Repo · Verify page — devnet only, no real funds.
