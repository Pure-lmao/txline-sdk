# TxLINE SDK

TypeScript SDK for [TxLINE](https://txline-docs.txodds.com/) — TxODDS's verified sports-data oracle on Solana. It gives you **modern `@solana/kit` tooling** for the on-chain program, **typed REST/SSE API shapes**, and **runnable examples** for the full integration path.

This is generally vibecoded, mainly tidying up code I had written to test and explore the API and program myself. Feel free to fix any problems you find or add anything and I will probably just merge it without looking too closely. I only built this so I can use it, and maybe it will help people use TxLine with a more modern SDK than their docs suggest. 

## What you get

| Layer | Location | Purpose |
| --- | --- | --- |
| **Solana helpers** | `solana.ts` | RPC/WSS clients, PDA/ATA derivation, ATA-create ix, simulate/send txs, `safeJSONStringify` |
| **Program** | `program/` | Network-keyed constants, Borsh codecs, PDA helpers, instruction builders (`getSubscribeIx`, `getValidateStatIx`, …) |
| **API client** | `api/client.ts` | Typed REST + SSE wrapper (`TxLineApiClient`) |
| **API types** | `api/types.ts` | Request/response interfaces for fixtures, odds, scores, Merkle proofs, auth |
| **Examples** | `examples/` | Sign-up, snapshots, streaming, on-chain validation, `proveStat` simulation |
| **Rust reference** | `examples/rust/` | Minimal Pinocchio CPI sketch for `validate_stat` inside your program |

Most program functions take a `devnet: boolean` and resolve cluster-specific addresses (`PROGRAM_ID`, `TOKEN_MINT`, `API_BASE_URL`, …) from `program/constants.ts`.

## Install

```bash
bun add txline-sdk @solana/kit @solana-program/compute-budget
# or: npm install …
```

Peer dependency: TypeScript 5+.

## Quick start

### 1. Sign up and activate API access

```bash
cp .env.sample .env
# set SECRET_KEY or KEYPAIR_PATH
bun run example:signup
# save JWT_devnet + API_KEY_devnet (+ TX_SIG_devnet) to .env
```

Flow: guest JWT → subscribe on-chain (TxL token) → sign activation message → long-lived API token.

### 2. Call the REST API

Use `TxLineApiClient` — pass `network`, `jwt`, and `apiKey`:

```typescript
import { TxLineApiClient, createTxLineApiClient } from 'txline-sdk';

const api = createTxLineApiClient({
   network: true, // devnet
   jwt: process.env.JWT_devnet!,
   apiKey: process.env.API_KEY_devnet!,
});

const fixtures = await api.fixtures.snapshot();
const odds = await api.odds.snapshot({ fixtureId: fixtures[0]!.FixtureId });
const proof = await api.scores.statValidation({
   fixtureId: 17588223,
   seq: 1024,
   statKey: 1,
   statKey2: 2,
});

// SSE (typed payloads, heartbeats filtered)
await api.odds.stream(
   (update) => console.log(update.SuperOddsType, update.Prices),
   { fixtureId: 17588389, maxMs: 30_000 },
);
```

Guest / activation flows (no API key yet):

```typescript
const { token: jwt } = await TxLineApiClient.startGuestSession(true);
const apiKey = await TxLineApiClient.activateToken(true, jwt, {
   txSig,
   walletSignature,
   leagues: [],
});
```

Run `bun run example:fixtures`, `example:odds`, `example:scores` for full endpoint coverage.

### 3. Build a program instruction

Instruction builders take **minimal input** — accounts are derived internally:

```typescript
import { getSubscribeIx, getValidateStatIx } from 'txline-sdk';

const subscribeIx = await getSubscribeIx(userAddress, serviceLevelId, weeks, devnet);
const validateIx = await getValidateStatIx(validateStatPayload, devnet);
```

Encode/decode raw instruction data with `program/codex.ts` (`encodeValidateStatIxData`, `proofNodeFromApi`, …).

### 4. Prove a stat (Merkle validation)

The flagship pattern: fetch a proof from the API, simulate `validate_stat`, interpret the result.

```bash
bun run example:prove-stat
# FIXTURE_ID=17588223 SEQ=1024 THRESHOLD=0 COMPARISON=gt
```

TxLINE returns predicate **pass/fail in program return data** (`[1]` / `[0]`), not as a failed instruction. Invalid Merkle paths fail the simulation with Anchor errors (e.g. `6023 InvalidStatProof`). See `examples/08-prove-stat.ts` for `parseProveStatSimulation`.

For CPI from your own Solana program, see `examples/rust/validate_stat_cpi.rs`.

## Examples

| Script | Command | Description |
| --- | --- | --- |
| Sign-up | `bun run example:signup` | Guest JWT, subscribe tx, API token activation |
| Purchase | `bun run example:purchase` | USDT → TxL quote (dry run; `SEND=true` to broadcast) |
| Fixtures | `bun run example:fixtures` | Snapshots, updates, Merkle validation |
| Odds | `bun run example:odds` | Snapshot, live/historical updates, odds validation |
| Scores | `bun run example:scores` | Snapshot, intervals, full sequence |
| Streaming | `bun run example:streaming` | SSE odds stream (unfiltered + fixture probe) |
| On-chain validation | `bun run example:validation` | Simulate `validate_stat` (`SEND=true` to broadcast) |
| Prove stat | `bun run example:prove-stat` | API proof → simulate → classify outcome |

Examples are Bun/Node-oriented (`examples/_shared.ts` loads `.env`, writes to `example_responses/`). They are **not** part of the published SDK surface.

## Project layout

```
index.ts              # barrel exports
solana.ts             # generic Solana helpers
program/
  constants.ts        # PROGRAM_ID, discriminators, seeds (devnet/mainnet)
  types.ts            # instruction + account types (mirrors Anchor IDL)
  codex.ts            # Borsh encoders/decoders
  utils.ts            # PDA helpers (getPricingMatrixPda, …)
  instructions.ts     # getSubscribeIx, getValidateStatIx, …
api/
  types.ts            # ApiFixture, ApiOddsPayload, ApiScoresStatValidation, …
  http.ts             # fetch helpers, TxLineApiError, Accept-Encoding header
  sse.ts              # SSE frame parser + stream helper
  client.ts           # TxLineApiClient (fixtures / odds / scores resources)
examples/             # runnable integration scripts
```

## Network configuration

| Constant | Devnet | Mainnet |
| --- | --- | --- |
| `PROGRAM_ID` | `6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J` | `9ExbZjAapQww1vfcisDmrngPinHTEfpjYRWMunJgcKaA` |
| `API_BASE_URL` | `https://txline-dev.txodds.com` | `https://txline.txodds.com` |

Token mints and treasury addresses are in `program/constants.ts`.

## Development

```bash
bun install
bun run typecheck
```

Copy `.env.sample` → `.env` before running examples. Recorded API responses land in `example_responses/` (gitignored — may contain JWTs/tokens).

## Design notes & caveats

- **Browser vs Node:** `loadKeypairSignerFromJsonFile` in `solana.ts` uses `node:fs`. Use wallet adapters in the browser; import program/API modules directly.
- **Bun + API compression:** The client sets `Accept-Encoding: gzip, deflate, br` automatically — Bun cannot decode zstd responses.
- **SSE wire format:** Live streams use `data:` + `id:` lines; heartbeats use `event: heartbeat`. The parser in `examples/_shared.ts` accepts current and documented formats.
- **Scores:** All score REST/SSE endpoints return PascalCase (`ApiScoreEvent`). Narrow on `Type` — `Soccer` is association football, `UsFootball` is NFL. Soccer SSE misnames some fields `StatusUsFootballId` / `DataUsFootball` (see `ApiSoccerScoreEventFields`).
- **Merkle hashes:** Validation endpoints return 32-byte JSON number arrays (`ApiMerkleHash`); use `hash32FromBytes` / `proofNodeFromApi` before on-chain codecs. `GET /api/odds/validation` returns the odds row under **`odds`** (maps to on-chain `oddsSnapshot`).

## Links

- [TxLINE documentation](https://txline-docs.txodds.com/)
- [Program reference](https://txline-docs.txodds.com/documentation/programs/mainnet)
- [API reference](https://txline-docs.txodds.com/api-reference)
