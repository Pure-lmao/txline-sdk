# Rust: on-chain TxLINE verification

Reference only — copy into your program crate and adapt.

| File | Purpose |
|------|---------|
| [`validate_stat_cpi.rs`](./validate_stat_cpi.rs) | Parse once, validate period/keys from program constants, CPI |

## Flow

1. Off-chain: `encodeValidateStatIxData` → append as **sole** ix data payload (passthrough).
2. On-chain `process_settle_with_txline`:
   - Read `fixture_id` from **bet account** (not client ix).
   - `parse_validate_stat_ix` once → `ValidateStatIx` via **Borsh** (`borsh` crate).
   - `validate_full_time_home_win` — period `5`, keys `1`/`2`, etc. are **program constants**.
   - `cpi_validate_stat(..., ix.ts, data)` — no second parse.

Add to your program `Cargo.toml`:

```toml
borsh = { version = "1", default-features = false }
```

## Soccer constants (hardcoded in program)

| | |
|-|-|
| Stat `1` | Home goals |
| Stat `2` | Away goals |
| Period `5` | Full time |

## TxLINE program ids

| Cluster | Program id |
|---------|------------|
| devnet | `6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J` |
| mainnet | `9ExbZjAapQww1vfcisDmrngPinHTEfpjYRWMunJgcKaA` |
