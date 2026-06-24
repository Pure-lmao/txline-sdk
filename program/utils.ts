/**
 * TxLINE program-specific helpers: cluster-aware PDA derivation, treasury vault
 * ATAs, and the timestamp → epoch-day / time-slot math the program uses to key
 * its daily root accounts.
 *
 * Cluster-dependent helpers take a `devnet: boolean` and route to the correct
 * group in `constants` (program id, mints).
 */

import {
   getProgramDerivedAddress,
   getU16Encoder,
   getU8Encoder,
   getU64Encoder,
   type Address,
   type ReadonlyUint8Array,
} from '@solana/kit';
import { getATA, networkFromDevnet, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from '../solana';
import {
   PROGRAM_ID,
   SEED_DAILY_BATCH_ROOTS,
   SEED_DAILY_ODDS_MERKLE_ROOTS,
   SEED_DAILY_SCORES_ROOTS,
   SEED_PRICING_MATRIX,
   SEED_TEN_DAILY_FIXTURES_ROOTS,
   SEED_TOKEN_TREASURY,
   SEED_USDT_TREASURY,
   TOKEN_MINT,
   USDT_MINT,
} from './constants';

const MS_PER_MIN = 60_000;
const MS_PER_HOUR = 60 * MS_PER_MIN;
const MS_PER_DAY = 24 * MS_PER_HOUR;

const u8Encoder = getU8Encoder();
const u16Encoder = getU16Encoder();
const u64Encoder = getU64Encoder();

/** Resolve the program id for the given cluster. */
export function getProgramId(devnet: boolean): Address {
   return PROGRAM_ID[networkFromDevnet(devnet)];
}

async function derivePda(
   devnet: boolean,
   seeds: readonly (string | ReadonlyUint8Array)[],
): Promise<readonly [Address, number]> {
   return getProgramDerivedAddress({ programAddress: getProgramId(devnet), seeds: [...seeds] });
}

const u8Seed = (value: number): Uint8Array => new Uint8Array(u8Encoder.encode(value));
const u16Seed = (value: number): Uint8Array => new Uint8Array(u16Encoder.encode(value));

/** u64 little-endian seed bytes (handy for index-keyed PDAs). */
export function u64Seed(value: bigint): Uint8Array {
   return new Uint8Array(u64Encoder.encode(value));
}

/** Epoch day index from a millisecond timestamp (matches the TxLINE API / on-chain accounts). */
export function epochDayFromTsMs(tsMs: number | bigint): number {
   return Math.floor(Number(tsMs) / MS_PER_DAY);
}

/** Hour-of-day and 5-minute-aligned minute within the epoch day. */
export function timeSlotFromTsMs(tsMs: number | bigint): { hourOfDay: number; minuteOfHour: number } {
   const msIntoDay = Number(tsMs) % MS_PER_DAY;
   const totalMinutes = Math.floor(msIntoDay / MS_PER_MIN);
   return {
      hourOfDay: Math.floor(totalMinutes / 60),
      minuteOfHour: Math.floor((totalMinutes % 60) / 5) * 5,
   };
}

// --- PDAs ---

export async function getPricingMatrixPda(devnet: boolean): Promise<readonly [Address, number]> {
   return derivePda(devnet, [SEED_PRICING_MATRIX]);
}

export async function getTokenTreasuryPda(devnet: boolean): Promise<readonly [Address, number]> {
   return derivePda(devnet, [SEED_TOKEN_TREASURY]);
}

export async function getUsdtTreasuryPda(devnet: boolean): Promise<readonly [Address, number]> {
   return derivePda(devnet, [SEED_USDT_TREASURY]);
}

export async function getDailyScoresRootsPda(devnet: boolean, epochDay: number): Promise<readonly [Address, number]> {
   return derivePda(devnet, [SEED_DAILY_SCORES_ROOTS, u16Seed(epochDay)]);
}

export async function getDailyScoresRootsPdaFromTs(
   devnet: boolean,
   tsMs: number | bigint,
): Promise<readonly [Address, number]> {
   return getDailyScoresRootsPda(devnet, epochDayFromTsMs(tsMs));
}

export async function getTenDailyFixturesRootsPda(
   devnet: boolean,
   epochDay: number,
): Promise<readonly [Address, number]> {
   return derivePda(devnet, [SEED_TEN_DAILY_FIXTURES_ROOTS, u16Seed(epochDay)]);
}

export async function getDailyBatchRootsPda(
   devnet: boolean,
   epochDay: number,
   hourOfDay: number,
   minuteOfHour: number,
): Promise<readonly [Address, number]> {
   return derivePda(devnet, [SEED_DAILY_BATCH_ROOTS, u16Seed(epochDay), u8Seed(hourOfDay), u8Seed(minuteOfHour)]);
}

export async function getDailyOddsMerkleRootsPda(
   devnet: boolean,
   tsMs: number | bigint,
): Promise<readonly [Address, number]> {
   const epochDay = epochDayFromTsMs(tsMs);
   const { hourOfDay, minuteOfHour } = timeSlotFromTsMs(tsMs);
   return derivePda(devnet, [
      SEED_DAILY_ODDS_MERKLE_ROOTS,
      u16Seed(epochDay),
      u8Seed(hourOfDay),
      u8Seed(minuteOfHour),
   ]);
}

// --- Treasury vault ATAs ---

/** TxL (Token-2022) treasury vault ATA owned by the token-treasury PDA. */
export async function getTokenTreasuryVault(devnet: boolean): Promise<Address> {
   const network = networkFromDevnet(devnet);
   const [tokenTreasuryPda] = await getTokenTreasuryPda(devnet);
   return getATA(tokenTreasuryPda, TOKEN_MINT[network], TOKEN_2022_PROGRAM_ID);
}

/** USDT (SPL Token) treasury vault ATA owned by the usdt-treasury PDA. */
export async function getUsdtTreasuryVault(devnet: boolean): Promise<Address> {
   const network = networkFromDevnet(devnet);
   const [usdtTreasuryPda] = await getUsdtTreasuryPda(devnet);
   return getATA(usdtTreasuryPda, USDT_MINT[network], TOKEN_PROGRAM_ID);
}
