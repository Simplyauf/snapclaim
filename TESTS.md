# Test run

Captured output, not a description of one. Run it yourself:

```
cd mobile && npm test
```

```
> mobile@1.0.0 test
> tsx --test src/lib/__tests__/*.test.ts
TAP version 13
ok 1 - decodes the base64 address MWA actually returns
ok 2 - still accepts a base58 address from wallets that send one
ok 3 - round-trips every encoding to the same key
ok 4 - rejects an address that is not 32 bytes instead of inventing a key
ok 5 - shortens for display without mangling a short string
ok 6 - a base64 address is never mistaken for base58
ok 7 - is independent of the order expenses were entered in
ok 8 - is stable under whitespace runs and currency case
ok 9 - breaks on a single edited character in a vendor name
ok 10 - breaks on a single minor unit of difference in a total
ok 11 - escapes tabs and newlines so a vendor name cannot forge a row
ok 12 - sums per normalised currency without mixing them
ok 13 - formats minor units without floating point
ok 14 - round-trips a memo and rejects a malformed one
ok 15 - reproduces the fingerprint that was actually sealed on devnet
ok 16 - a CSV round-trip rebuilds the identical fingerprint
ok 17 - carries the fingerprint and transaction so a reviewer needs nothing else
ok 18 - survives vendor names containing commas, quotes and newlines
ok 19 - a single edited amount in the CSV changes the fingerprint
ok 20 - an edited vendor name in the CSV changes the fingerprint
ok 21 - preserves empty subtotal and tax rather than inventing zeros
ok 22 - rejects a file that is not a SnapClaim report, with a readable message
ok 23 - reports a malformed amount by line number
ok 24 - groups thousands and keeps two decimals
ok 25 - groups a negative amount without stranding the minus sign
ok 26 - never emits a currency symbol, only an ISO code
ok 27 - formats months and tape dates in UTC regardless of device zone
ok 28 - reads amounts in either grouping convention
ok 29 - treats a lone separator with three digits after it as grouping
ok 30 - treats a lone separator with two digits after it as a decimal point
ok 31 - strips currency symbols and stray text
ok 32 - handles whole numbers and negatives
ok 33 - returns null rather than guessing at unreadable input
ok 34 - reads unambiguous date formats
ok 35 - reads an ambiguous numeric date day-first and flags it
ok 36 - picks the only non-future reading without flagging it
ok 37 - flags a numeric date when both readings are plausibly in the past
ok 38 - does not flag a date where both readings agree
ok 39 - rejects an impossible date instead of rolling it over
ok 40 - detects currency from a code or a symbol, and admits a guess
ok 41 - normalises a clean receipt with nothing flagged
ok 42 - flags a total that does not equal subtotal plus tax
ok 43 - reconstructs a missing total from the parts and flags it
ok 44 - flags a future-dated receipt as a likely misread year
ok 45 - always returns something saveable, even from an empty parse
ok 46 - matches a report that has not changed since sealing
ok 47 - reads the memo from logs when the RPC does not parse it
ok 48 - reports no match when the report has been edited
ok 49 - refuses a seal belonging to a different month
ok 50 - accepts an upper-cased fingerprint from a pasted field
ok 51 - ignores a memo that is not a SnapClaim seal
ok 52 - skips instructions from other programs
ok 53 - reports not found for an unknown transaction
ok 54 - surfaces a network failure instead of claiming no match
ok 55 - finds a seal this wallet already wrote for the same report
ok 56 - ignores a seal for a different month or fingerprint
ok 57 - skips failed transactions when looking for an existing seal
ok 58 - returns null when the RPC is unreachable instead of blocking a seal
ok 59 - groups expenses by month and totals them
ok 60 - refreshes an unsealed draft in place instead of piling up versions
ok 61 - keeps a sealed version untouched when the month is edited afterwards
ok 62 - does not cut a new version when a sealed month is unchanged
ok 63 - cuts a new draft when an edit is reverted and then re-applied
ok 64 - refuses to seal the same report version twice
ok 65 - the fingerprint ignores ids, images and timestamps
ok 66 - survives a corrupt stored blob instead of crashing on launch
ok 67 - returns the same db reference when the draft has not changed
ok 68 - still returns a new db when the month actually changed
# tests 68
# pass 68
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 503.868584
```

68 tests, 0 failures, run in ?ms.

## Coverage by file

| File | Tests | Covers |
|---|---:|---|
| `canonical.test.ts` | 8 | Canonical form determinism, whitespace/currency-case stability, single-character tamper detection, memo round-trip |
| `solana.test.ts` | 13 | Every `verifySeal` outcome (match/no-match/not-found), idempotent seal lookup (`findExistingSeal`), network-failure handling |
| `store.test.ts` | 10 | Report versioning after a seal (FR-21), sealed-version immutability, refuses double-sealing, referential stability (the render-loop regression) |
| `address.test.ts` | 6 | MWA's base64 address encoding vs base58, 50-key round-trip |
| `parse.test.ts` | 18 | Amount parsing across grouping conventions, ambiguous-date handling, receipt normalisation |
| `money.test.ts` | 4 | Amount formatting, no currency symbols (font glyph coverage) |
| `csv.test.ts` | 9 | CSV round-trip reproduces the exact fingerprint sealed on devnet, tamper detection through the file format |

## Idempotent sealing, specifically

`findExistingSeal` in [`mobile/src/lib/solana.ts`](mobile/src/lib/solana.ts) is called by
`ReportScreen` before building any transaction. If this wallet has already written this
exact fingerprint for this month, the app adopts that signature instead of sending a new
one. Tested in `solana.test.ts`: finds its own prior seal, ignores a seal for a different
month or fingerprint, skips failed transactions, and falls back to sending rather than
blocking when the RPC is unreachable.

This was also exercised for real, not just in the test suite: on-device, sealing a report
whose fingerprint already existed on devnet produced no second transaction and no wallet
prompt — the app read the existing memo back and marked the report sealed from that.

Captured 2026-10-12.
