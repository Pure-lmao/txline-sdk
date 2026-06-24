/**
 * TypeScript shapes for TxLINE (txoracle) program instruction payloads and
 * on-chain account data. These mirror the Anchor IDL (Borsh layouts).
 *
 * @see https://txline-docs.txodds.com/documentation/programs/mainnet
 */

import type { Address } from '@solana/kit';

/** A fixed 32-byte hash (merkle node / root). */
export type Hash32 = Uint8Array & { readonly length: 32 };

export enum BinaryExpression {
   Add = 0,
   Subtract = 1,
}

export enum Comparison {
   GreaterThan = 0,
   LessThan = 1,
   EqualTo = 2,
}

export type BatchMetadata = {
   totalUpdateCount: number;
   numUniqueFixtures: number;
   overallBatchStartTs: bigint;
   overallBatchEndTs: bigint;
};

export type Fixture = {
   ts: bigint;
   startTime: bigint;
   competition: string;
   competitionId: number;
   fixtureGroupId: number;
   participant1Id: number;
   participant1: string;
   participant2Id: number;
   participant2: string;
   fixtureId: bigint;
   participant1IsHome: boolean;
};

export type FixtureUpdateStats = {
   updateCount: number;
   minTimestamp: bigint;
   maxTimestamp: bigint;
};

export type FixtureBatchSummary = {
   fixtureId: bigint;
   competitionId: number;
   competition: string;
   updateStats: FixtureUpdateStats;
   updateSubTreeRoot: Hash32;
};

export type OddsUpdateStats = {
   updateCount: number;
   minTimestamp: bigint;
   maxTimestamp: bigint;
};

export type Odds = {
   fixtureId: bigint;
   messageId: string;
   ts: bigint;
   bookmaker: string;
   bookmakerId: number;
   superOddsType: string;
   gameState: string | null;
   inRunning: boolean;
   marketParameters: string | null;
   marketPeriod: string | null;
   priceNames: string[];
   prices: number[];
};

export type OddsBatchSummary = {
   fixtureId: bigint;
   updateStats: OddsUpdateStats;
   oddsSubTreeRoot: Hash32;
};

export type ProofNode = {
   hash: Hash32;
   isRightSibling: boolean;
};

export type ScoreStat = {
   key: number;
   value: number;
   period: number;
};

export type ScoresUpdateStats = {
   updateCount: number;
   minTimestamp: bigint;
   maxTimestamp: bigint;
};

export type ScoresBatchSummary = {
   fixtureId: bigint;
   updateStats: ScoresUpdateStats;
   eventsSubTreeRoot: Hash32;
};

export type ServiceRow = {
   rowId: number;
   pricePerWeekToken: bigint;
   samplingIntervalSec: number;
   leagueBundleId: number;
   marketBundleId: number;
};

export type StatTerm = {
   statToProve: ScoreStat;
   eventStatRoot: Hash32;
   statProof: ProofNode[];
};

export type TraderPredicate = {
   threshold: number;
   comparison: Comparison;
};

export type PricingMatrixAccount = {
   discriminator: Uint8Array;
   admin: Address;
   rows: ServiceRow[];
};

export type InsertBatchRootIxData = {
   epochDay: number;
   hourOfDay: number;
   minuteOfHour: number;
   root: Hash32;
   accountBump: number;
};

export type InsertFixturesRootIxData = {
   epochDay: number;
   index: bigint;
   root: Hash32;
};

export type InsertScoresRootIxData = {
   epochDay: number;
   hourOfDay: number;
   minuteOfHour: number;
   root: Hash32;
};

export type SubscribeIxData = {
   serviceLevelId: number;
   weeks: number;
};

export type SubscribeV2IxData = {
   weeks: number;
};

export type ValidateFixtureIxData = {
   snapshot: Fixture;
   summary: FixtureBatchSummary;
   subTreeProof: ProofNode[];
   mainTreeProof: ProofNode[];
};

export type ValidateFixtureBatchIxData = {
   index: number;
   metadata: BatchMetadata;
   proof: ProofNode[];
};

export type ValidateOddsIxData = {
   ts: bigint;
   oddsSnapshot: Odds;
   summary: OddsBatchSummary;
   subTreeProof: ProofNode[];
   mainTreeProof: ProofNode[];
};

export type ValidateStatIxData = {
   ts: bigint;
   fixtureSummary: ScoresBatchSummary;
   fixtureProof: ProofNode[];
   mainTreeProof: ProofNode[];
   predicate: TraderPredicate;
   statA: StatTerm;
   statB: StatTerm | null;
   op: BinaryExpression | null;
};

/** Discriminated union over every txoracle instruction (used by codex encode/decode). */
export type DecodedTxoracleInstruction =
   | { kind: 'closePricingMatrix' }
   | { kind: 'initializePricingMatrix'; rows: ServiceRow[] }
   | { kind: 'initializeTreasuryV2' }
   | { kind: 'initializeUsdtTreasury' }
   | { kind: 'insertBatchRoot'; data: InsertBatchRootIxData }
   | { kind: 'insertFixturesRoot'; data: InsertFixturesRootIxData }
   | { kind: 'insertScoresRoot'; data: InsertScoresRootIxData }
   | { kind: 'purchaseSubscriptionTokenUsdt'; txlineAmount: bigint }
   | { kind: 'subscribe'; data: SubscribeIxData }
   | { kind: 'subscribeV2'; data: SubscribeV2IxData }
   | { kind: 'updatePricingMatrix'; rows: ServiceRow[] }
   | { kind: 'validateFixture'; data: ValidateFixtureIxData }
   | { kind: 'validateFixtureBatch'; data: ValidateFixtureBatchIxData }
   | { kind: 'validateOdds'; data: ValidateOddsIxData }
   | { kind: 'validateStat'; data: ValidateStatIxData }
   | { kind: 'withdrawUsdt'; amount: bigint };
