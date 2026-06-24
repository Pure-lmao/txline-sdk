/**
 * TxLINE (txoracle) program constants.
 *
 * Anything that differs between clusters is keyed by {@link Network}
 * (`{ devnet, mainnet }`), so instruction builders can index with
 * `PROGRAM_ID[network]`, `TOKEN_MINT[network]`, etc. Cluster-agnostic values
 * (SPL program ids, Anchor discriminators, IDL numeric constants) are plain.
 *
 * @see https://txline-docs.txodds.com/documentation/programs/mainnet
 */

import type { Address } from '@solana/kit';
import type { Network } from '../solana';

// SPL program ids (SYSTEM_PROGRAM_ID, TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID,
// ASSOCIATED_TOKEN_PROGRAM_ID) are cluster-agnostic and live in `../solana`.

// --- Cluster-specific addresses ---

/** TxLINE / txoracle program id per cluster. */
export const PROGRAM_ID: Record<Network, Address> = {
   devnet: '6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J' as Address,
   mainnet: '9ExbZjAapQww1vfcisDmrngPinHTEfpjYRWMunJgcKaA' as Address,
};

/** TxL subscription token mint (Token-2022). */
export const TOKEN_MINT: Record<Network, Address> = {
   devnet: '4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG' as Address,
   mainnet: 'Zhw9TVKp68a1QrftncMSd6ELXKDtpVMNuMGr1jNwdeL' as Address,
};

/** USDT mint used to purchase TxL (SPL Token). */
export const USDT_MINT: Record<Network, Address> = {
   devnet: 'ELWTKspHKCnCfCiCiqYw1EDH77k8VCP74dK9qytG2Ujh' as Address,
   mainnet: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB' as Address,
};

/**
 * TxODDS backend signer that co-signs `purchaseSubscriptionTokenUsdt` (same key
 * on both clusters). In practice the backend builds + signs that transaction
 * (see the purchase-quote flow), so this is mostly informational.
 */
export const BACKEND_ADMIN: Record<Network, Address> = {
   devnet: '54Wot8oX53yKTtfoJwMc8RHrsqL1p6WC71devAoB1GGT' as Address,
   mainnet: '54Wot8oX53yKTtfoJwMc8RHrsqL1p6WC71devAoB1GGT' as Address,
};

/** TxLINE REST/SSE API base url per cluster. */
export const API_BASE_URL: Record<Network, string> = {
   devnet: 'https://txline-dev.txodds.com',
   mainnet: 'https://txline.txodds.com',
};

// --- Anchor 8-byte instruction discriminators (IDL v1.4.7) ---

export const CLOSE_PRICING_MATRIX_IX_DISCRIMINATOR = [251, 118, 215, 117, 22, 155, 38, 73] as const;
export const INITIALIZE_PRICING_MATRIX_IX_DISCRIMINATOR = [147, 32, 167, 248, 235, 57, 210, 6] as const;
export const INITIALIZE_TREASURY_V2_IX_DISCRIMINATOR = [18, 140, 152, 210, 31, 25, 22, 171] as const;
export const INITIALIZE_USDT_TREASURY_IX_DISCRIMINATOR = [81, 0, 86, 241, 86, 85, 243, 74] as const;
export const INSERT_BATCH_ROOT_IX_DISCRIMINATOR = [243, 170, 208, 158, 207, 29, 237, 93] as const;
export const INSERT_FIXTURES_ROOT_IX_DISCRIMINATOR = [18, 70, 8, 160, 75, 200, 109, 235] as const;
export const INSERT_SCORES_ROOT_IX_DISCRIMINATOR = [137, 39, 242, 97, 131, 204, 100, 133] as const;
export const PURCHASE_SUBSCRIPTION_TOKEN_USDT_IX_DISCRIMINATOR = [198, 251, 223, 9, 31, 184, 166, 188] as const;
export const SUBSCRIBE_IX_DISCRIMINATOR = [254, 28, 191, 138, 156, 179, 183, 53] as const;
export const SUBSCRIBE_V2_IX_DISCRIMINATOR = [13, 248, 232, 63, 182, 236, 71, 149] as const;
export const UPDATE_PRICING_MATRIX_IX_DISCRIMINATOR = [177, 191, 172, 252, 42, 203, 8, 164] as const;
export const VALIDATE_FIXTURE_IX_DISCRIMINATOR = [231, 129, 218, 86, 223, 114, 21, 126] as const;
export const VALIDATE_FIXTURE_BATCH_IX_DISCRIMINATOR = [85, 223, 204, 7, 4, 87, 157, 1] as const;
export const VALIDATE_ODDS_IX_DISCRIMINATOR = [192, 19, 91, 138, 104, 100, 212, 86] as const;
export const VALIDATE_STAT_IX_DISCRIMINATOR = [107, 197, 232, 90, 191, 136, 105, 185] as const;
export const WITHDRAW_USDT_IX_DISCRIMINATOR = [117, 75, 94, 162, 178, 92, 19, 141] as const;

/** Anchor account discriminator for `PricingMatrix`. */
export const PRICING_MATRIX_ACCOUNT_DISCRIMINATOR = [173, 13, 64, 22, 248, 77, 110, 106] as const;

// --- PDA seed prefixes ---

export const SEED_PRICING_MATRIX = 'pricing_matrix';
export const SEED_TOKEN_TREASURY = 'token_treasury_v2';
export const SEED_USDT_TREASURY = 'usdt_treasury';
export const SEED_DAILY_SCORES_ROOTS = 'daily_scores_roots';
export const SEED_TEN_DAILY_FIXTURES_ROOTS = 'ten_daily_fixtures_roots';
export const SEED_DAILY_BATCH_ROOTS = 'daily_batch_roots';
export const SEED_DAILY_ODDS_MERKLE_ROOTS = 'daily_odds_merkle_roots';

// --- Numeric constants from the IDL (cluster-agnostic) ---

export const MIN_DEPOSIT_TOKENS = 1_000_000n;
export const MIN_USER_BALANCE = 1_000_000n;
export const STAKE_AMOUNT = 250_000_000n;
export const SUBSCRIPTION_DURATION = 604_800n;
export const SUBSCRIPTION_PRICE_TOKEN = 25_000_000n;
export const TOKEN_DECIMALS = 6;
export const TOKEN_PRICE_IN_USDT = 1000n;
export const USDT_DECIMALS_FACTOR = 1_000_000n;
