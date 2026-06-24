/**
 * TxLINE (txoracle) instruction builders.
 *
 * Each builder takes the minimum semantic inputs (e.g. a user address) and
 * derives everything else — ATAs, PDAs, treasury vaults — internally. Every
 * cluster-dependent builder takes a `devnet: boolean` and routes to the right
 * accounts via `constants` (`TOKEN_MINT[network]`, `PROGRAM_ID[network]`, ...).
 *
 * Returns plain @solana/kit {@link Instruction}s; compose them with the helpers
 * in `../solana` (`buildSignSendTransaction`, `simulateTransaction`).
 */

import { AccountRole, type Address, type Instruction } from '@solana/kit';
import {
   ASSOCIATED_TOKEN_PROGRAM_ID,
   getATA,
   networkFromDevnet,
   SYSTEM_PROGRAM_ID,
   TOKEN_2022_PROGRAM_ID,
   TOKEN_PROGRAM_ID,
} from '../solana';
import { TOKEN_MINT, USDT_MINT } from './constants';
import {
   encodeSubscribeIxData,
   encodeSubscribeV2IxData,
   encodeTxoracleInstructionData,
   encodeValidateFixtureBatchIxData,
   encodeValidateFixtureIxData,
   encodeValidateOddsIxData,
   encodeValidateStatIxData,
} from './codex';
import type {
   InsertBatchRootIxData,
   InsertFixturesRootIxData,
   InsertScoresRootIxData,
   ServiceRow,
   SubscribeIxData,
   SubscribeV2IxData,
   ValidateFixtureBatchIxData,
   ValidateFixtureIxData,
   ValidateOddsIxData,
   ValidateStatIxData,
} from './types';
import {
   epochDayFromTsMs,
   getDailyBatchRootsPda,
   getDailyOddsMerkleRootsPda,
   getDailyScoresRootsPda,
   getDailyScoresRootsPdaFromTs,
   getPricingMatrixPda,
   getProgramId,
   getTenDailyFixturesRootsPda,
   getTokenTreasuryPda,
   getTokenTreasuryVault,
   getUsdtTreasuryPda,
   getUsdtTreasuryVault,
} from './utils';

const ro = (address: Address) => ({ address, role: AccountRole.READONLY });
const rw = (address: Address) => ({ address, role: AccountRole.WRITABLE });
const rs = (address: Address) => ({ address, role: AccountRole.READONLY_SIGNER });
const ws = (address: Address) => ({ address, role: AccountRole.WRITABLE_SIGNER });

// --- Subscription / purchase ---

/**
 * Subscribe to a TxLINE service level by paying TxL. Derives the user's TxL ATA,
 * pricing matrix, and treasury accounts. The user's TxL ATA must already exist
 * (prepend {@link getCreateAtaIx} from `../solana` if unsure).
 */
export async function getSubscribeIx(
   user: Address,
   serviceLevelId: number,
   weeks: number,
   devnet: boolean,
): Promise<Instruction> {
   const network = networkFromDevnet(devnet);
   const data: SubscribeIxData = { serviceLevelId, weeks };
   const [pricingMatrix] = await getPricingMatrixPda(devnet);
   const [tokenTreasuryPda] = await getTokenTreasuryPda(devnet);
   const tokenTreasuryVault = await getTokenTreasuryVault(devnet);
   const userTokenAccount = await getATA(user, TOKEN_MINT[network], TOKEN_2022_PROGRAM_ID);
   return {
      programAddress: getProgramId(devnet),
      data: encodeSubscribeIxData(data),
      accounts: [
         ws(user),
         ro(pricingMatrix),
         ro(TOKEN_MINT[network]),
         rw(userTokenAccount),
         rw(tokenTreasuryVault),
         ro(tokenTreasuryPda),
         ro(TOKEN_2022_PROGRAM_ID),
         ro(SYSTEM_PROGRAM_ID),
         ro(ASSOCIATED_TOKEN_PROGRAM_ID),
      ],
   };
}

/** Subscribe via the v2 flow (no explicit service level; weeks only). */
export async function getSubscribeV2Ix(user: Address, weeks: number, devnet: boolean): Promise<Instruction> {
   const network = networkFromDevnet(devnet);
   const data: SubscribeV2IxData = { weeks };
   const [tokenTreasuryPda] = await getTokenTreasuryPda(devnet);
   const tokenTreasuryVault = await getTokenTreasuryVault(devnet);
   const userTokenAccount = await getATA(user, TOKEN_MINT[network], TOKEN_2022_PROGRAM_ID);
   return {
      programAddress: getProgramId(devnet),
      data: encodeSubscribeV2IxData(data),
      accounts: [
         ws(user),
         ro(TOKEN_MINT[network]),
         rw(userTokenAccount),
         rw(tokenTreasuryVault),
         ro(tokenTreasuryPda),
         ro(TOKEN_2022_PROGRAM_ID),
         ro(SYSTEM_PROGRAM_ID),
         ro(ASSOCIATED_TOKEN_PROGRAM_ID),
      ],
   };
}

/**
 * Buy TxL with USDT on-chain. Requires the TxODDS `backendAdmin` co-signer.
 * In normal use the backend builds and partially signs this transaction via the
 * purchase-quote endpoint; this builder is provided for completeness/testing.
 */
export async function getPurchaseSubscriptionTokenUsdtIx(
   buyer: Address,
   backendAdmin: Address,
   txlineAmount: bigint,
   devnet: boolean,
): Promise<Instruction> {
   const network = networkFromDevnet(devnet);
   const [tokenTreasuryPda] = await getTokenTreasuryPda(devnet);
   const [usdtTreasuryPda] = await getUsdtTreasuryPda(devnet);
   const tokenTreasuryVault = await getTokenTreasuryVault(devnet);
   const usdtTreasuryVault = await getUsdtTreasuryVault(devnet);
   const buyerUsdtAccount = await getATA(buyer, USDT_MINT[network], TOKEN_PROGRAM_ID);
   const buyerTokenAccount = await getATA(buyer, TOKEN_MINT[network], TOKEN_2022_PROGRAM_ID);
   return {
      programAddress: getProgramId(devnet),
      data: encodeTxoracleInstructionData({ kind: 'purchaseSubscriptionTokenUsdt', txlineAmount }),
      accounts: [
         ws(buyer),
         rs(backendAdmin),
         ro(USDT_MINT[network]),
         rw(buyerUsdtAccount),
         rw(usdtTreasuryVault),
         ro(usdtTreasuryPda),
         ro(TOKEN_MINT[network]),
         rw(tokenTreasuryVault),
         ro(tokenTreasuryPda),
         rw(buyerTokenAccount),
         ro(TOKEN_PROGRAM_ID),
         ro(TOKEN_2022_PROGRAM_ID),
         ro(SYSTEM_PROGRAM_ID),
         ro(ASSOCIATED_TOKEN_PROGRAM_ID),
      ],
   };
}

// --- Validation (read-only oracle root accounts derived from payload timestamps) ---

export async function getValidateStatIx(data: ValidateStatIxData, devnet: boolean): Promise<Instruction> {
   const [dailyScoresMerkleRoots] = await getDailyScoresRootsPdaFromTs(devnet, data.ts);
   return {
      programAddress: getProgramId(devnet),
      data: encodeValidateStatIxData(data),
      accounts: [ro(dailyScoresMerkleRoots)],
   };
}

export async function getValidateOddsIx(data: ValidateOddsIxData, devnet: boolean): Promise<Instruction> {
   const [dailyOddsMerkleRoots] = await getDailyOddsMerkleRootsPda(devnet, data.ts);
   return {
      programAddress: getProgramId(devnet),
      data: encodeValidateOddsIxData(data),
      accounts: [ro(dailyOddsMerkleRoots)],
   };
}

export async function getValidateFixtureIx(data: ValidateFixtureIxData, devnet: boolean): Promise<Instruction> {
   const epochDay = epochDayFromTsMs(data.snapshot.ts);
   const [tenDailyFixturesRoots] = await getTenDailyFixturesRootsPda(devnet, epochDay);
   return {
      programAddress: getProgramId(devnet),
      data: encodeValidateFixtureIxData(data),
      accounts: [ro(tenDailyFixturesRoots)],
   };
}

export async function getValidateFixtureBatchIx(
   data: ValidateFixtureBatchIxData,
   devnet: boolean,
): Promise<Instruction> {
   const epochDay = epochDayFromTsMs(data.metadata.overallBatchStartTs);
   const [tenDailyFixturesRoots] = await getTenDailyFixturesRootsPda(devnet, epochDay);
   return {
      programAddress: getProgramId(devnet),
      data: encodeValidateFixtureBatchIxData(data),
      accounts: [ro(tenDailyFixturesRoots)],
   };
}

// --- Admin / oracle root posting ---

export async function getClosePricingMatrixIx(authority: Address, devnet: boolean): Promise<Instruction> {
   const [pricingMatrix] = await getPricingMatrixPda(devnet);
   return {
      programAddress: getProgramId(devnet),
      data: encodeTxoracleInstructionData({ kind: 'closePricingMatrix' }),
      accounts: [rw(pricingMatrix), ws(authority), ro(SYSTEM_PROGRAM_ID)],
   };
}

export async function getInitializePricingMatrixIx(
   authority: Address,
   rows: ServiceRow[],
   devnet: boolean,
): Promise<Instruction> {
   const [pricingMatrix] = await getPricingMatrixPda(devnet);
   return {
      programAddress: getProgramId(devnet),
      data: encodeTxoracleInstructionData({ kind: 'initializePricingMatrix', rows }),
      accounts: [ws(authority), rw(pricingMatrix), ro(SYSTEM_PROGRAM_ID)],
   };
}

export async function getUpdatePricingMatrixIx(
   authority: Address,
   rows: ServiceRow[],
   devnet: boolean,
): Promise<Instruction> {
   const [pricingMatrix] = await getPricingMatrixPda(devnet);
   return {
      programAddress: getProgramId(devnet),
      data: encodeTxoracleInstructionData({ kind: 'updatePricingMatrix', rows }),
      accounts: [ws(authority), rw(pricingMatrix), ro(SYSTEM_PROGRAM_ID)],
   };
}

export async function getInitializeTreasuryV2Ix(authority: Address, devnet: boolean): Promise<Instruction> {
   const network = networkFromDevnet(devnet);
   const [tokenTreasuryPda] = await getTokenTreasuryPda(devnet);
   const tokenTreasuryVault = await getTokenTreasuryVault(devnet);
   return {
      programAddress: getProgramId(devnet),
      data: encodeTxoracleInstructionData({ kind: 'initializeTreasuryV2' }),
      accounts: [
         ws(authority),
         rw(tokenTreasuryVault),
         ro(tokenTreasuryPda),
         ro(TOKEN_MINT[network]),
         ro(SYSTEM_PROGRAM_ID),
         ro(TOKEN_2022_PROGRAM_ID),
         ro(ASSOCIATED_TOKEN_PROGRAM_ID),
      ],
   };
}

export async function getInitializeUsdtTreasuryIx(authority: Address, devnet: boolean): Promise<Instruction> {
   const network = networkFromDevnet(devnet);
   const [usdtTreasuryPda] = await getUsdtTreasuryPda(devnet);
   const usdtTreasuryVault = await getUsdtTreasuryVault(devnet);
   return {
      programAddress: getProgramId(devnet),
      data: encodeTxoracleInstructionData({ kind: 'initializeUsdtTreasury' }),
      accounts: [
         ws(authority),
         rw(usdtTreasuryVault),
         ro(usdtTreasuryPda),
         ro(USDT_MINT[network]),
         ro(TOKEN_PROGRAM_ID),
         ro(ASSOCIATED_TOKEN_PROGRAM_ID),
         ro(SYSTEM_PROGRAM_ID),
      ],
   };
}

export async function getInsertBatchRootIx(
   authority: Address,
   data: InsertBatchRootIxData,
   devnet: boolean,
): Promise<Instruction> {
   const [dailyBatchRoots] = await getDailyBatchRootsPda(devnet, data.epochDay, data.hourOfDay, data.minuteOfHour);
   return {
      programAddress: getProgramId(devnet),
      data: encodeTxoracleInstructionData({ kind: 'insertBatchRoot', data }),
      accounts: [ws(authority), rw(dailyBatchRoots), ro(SYSTEM_PROGRAM_ID)],
   };
}

export async function getInsertFixturesRootIx(
   authority: Address,
   data: InsertFixturesRootIxData,
   devnet: boolean,
): Promise<Instruction> {
   const [tenDailyFixturesRoots] = await getTenDailyFixturesRootsPda(devnet, data.epochDay);
   return {
      programAddress: getProgramId(devnet),
      data: encodeTxoracleInstructionData({ kind: 'insertFixturesRoot', data }),
      accounts: [ws(authority), rw(tenDailyFixturesRoots), ro(SYSTEM_PROGRAM_ID)],
   };
}

export async function getInsertScoresRootIx(
   authority: Address,
   data: InsertScoresRootIxData,
   devnet: boolean,
): Promise<Instruction> {
   const [dailyScoresRoots] = await getDailyScoresRootsPda(devnet, data.epochDay);
   return {
      programAddress: getProgramId(devnet),
      data: encodeTxoracleInstructionData({ kind: 'insertScoresRoot', data }),
      accounts: [ws(authority), rw(dailyScoresRoots), ro(SYSTEM_PROGRAM_ID)],
   };
}

export async function getWithdrawUsdtIx(
   authority: Address,
   adminDestination: Address,
   amount: bigint,
   devnet: boolean,
): Promise<Instruction> {
   const network = networkFromDevnet(devnet);
   const [usdtTreasuryPda] = await getUsdtTreasuryPda(devnet);
   const usdtTreasuryVault = await getUsdtTreasuryVault(devnet);
   return {
      programAddress: getProgramId(devnet),
      data: encodeTxoracleInstructionData({ kind: 'withdrawUsdt', amount }),
      accounts: [
         ws(authority),
         rw(adminDestination),
         rw(usdtTreasuryVault),
         ro(usdtTreasuryPda),
         ro(USDT_MINT[network]),
         ro(TOKEN_PROGRAM_ID),
         ro(ASSOCIATED_TOKEN_PROGRAM_ID),
         ro(SYSTEM_PROGRAM_ID),
      ],
   };
}
