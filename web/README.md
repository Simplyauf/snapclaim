# SnapClaim landing + verify page

Static. `verify.js` is **generated** — do not edit it by hand.

It is bundled from the app's own `canonical.ts` and `csv.ts` so the browser
runs byte-identical logic to the phone. A separate reimplementation would be
free to drift, and a drifting verifier does not fail loudly: it quietly starts
telling reviewers that honest reports do not match.

Rebuild after changing either source file:

```bash
npm run build:web      # from the repo root
```
