/**
 * TypeScript shapes for the TxLINE off-chain REST + SSE API.
 *
 * Field names mirror the API exactly (fixtures/odds/scores use PascalCase on the
 * wire). Sport-specific score fields live in `api/score-types.ts`.
 *
 * @see https://txline-docs.txodds.com/api-reference
 */

import type {
   ApiBasketballScoreEventFields,
   ApiKickoffDetails,
   ApiLineupData,
   ApiScoreStats,
   ApiSoccerScoreEventFields,
   ApiUsFootballScoreEventFields,
} from './score-types';

export type {
   ApiBasketballData,
   ApiBasketballFixtureScore,
   ApiBasketballPartiState,
   ApiBasketballScore,
   ApiBasketballTotalScore,
   ApiInPlayInfo,
   ApiKickoffDetails,
   ApiKickoffInfo,
   ApiLineupData,
   ApiScoreClock,
   ApiScoreMarker,
   ApiScoreSport,
   ApiScoreStats,
   ApiSoccerData,
   ApiSoccerFixtureScore,
   ApiSoccerPartiState,
   ApiSoccerScore,
   ApiSoccerStreamData,
   ApiSoccerTotalScore,
   ApiUpdateReference,
   ApiUsFootballData,
   ApiUsFootballFixtureDown,
   ApiUsFootballFixtureScore,
   ApiUsFootballPartiState,
   ApiUsFootballScore,
   ApiUsFootballTotalScore,
} from './score-types';

/** 32-byte Merkle hash/root as a JSON number array on validation endpoints. */
export type ApiMerkleHash = number[];

// --- Authentication ---

/** `POST /auth/guest/start` — anonymous guest session (JWT valid ~30 days). */
export interface ApiGuestSessionResponse {
   token: string;
}

/**
 * `POST /api/token/activate` request body.
 */
export interface ApiActivationPayload {
   txSig: string;
   walletSignature: string;
   /** Requested league ids (empty for all leagues). */
   leagues: number[];
}

/** `POST /api/token/activate` returns the long-lived API token as plain text. */
export type ApiActivationResponse = string;

// --- Purchase (USDT → TxL quote) ---

/** `POST /api/guest/purchase/quote` request body. */
export interface ApiPurchaseQuoteRequest {
   /** Buyer's Solana wallet public key (base58). */
   buyerPubkey: string;
   /** Whole TxL tokens to purchase. */
   txlineAmount: number;
}

/** `POST /api/guest/purchase/quote` response: a partially signed tx + fee breakdown. */
export interface ApiPurchaseQuoteResponse {
   /** Base64-encoded, partially signed Solana transaction to verify, sign, and broadcast. */
   transactionBase64: string;
   /** Raw USDT cost for the tokens before fees (whole USDT). */
   baseUsdtCost: number;
   /** Premium fee applied. */
   feeUsdtAmount: number;
   /** Final total USDT charged to the wallet. */
   totalUsdtCharged: number;
}

// --- Fixtures ---

/**
 * A fixture as returned by `GET /api/fixtures/snapshot` and the fixtures
 * updates endpoints. Int64 fields (`Ts`, `StartTime`, `FixtureId`) arrive as
 * JSON numbers.
 */
export interface ApiFixture {
   /** Update timestamp (ms). */
   Ts: number;
   /** Scheduled kickoff (ms). */
   StartTime: number;
   Competition: string;
   CompetitionId: number;
   FixtureGroupId: number;
   Participant1Id: number;
   Participant1: string;
   Participant2Id: number;
   Participant2: string;
   FixtureId: number;
   Participant1IsHome: boolean;
}

// --- Odds ---

/**
 * A single odds offer from `GET /api/odds/snapshot/{fixtureId}`, the odds
 * updates endpoints, and the odds SSE stream.
 */
export interface ApiOddsPayload {
   FixtureId: number;
   MessageId: string;
   /** Update timestamp (ms). */
   Ts: number;
   Bookmaker: string;
   BookmakerId: number;
   SuperOddsType: string;
   InRunning: boolean;
   GameState?: string | null;
   MarketParameters?: string | null;
   MarketPeriod?: string | null;
   PriceNames?: string[];
   /** Prices as integers (implied scaling per market). */
   Prices?: number[];
   /**
    * StablePrice demargined percentages: each entry is formatted to 3 decimal
    * places, or `"NA"` for quarter-handicap lines.
    */
   Pct?: string[];
}

// --- Merkle proofs / on-chain validation payloads ---

/** A node along a Merkle branch (`hash` is a 32-byte JSON number array). */
export interface ApiProofNode {
   hash: ApiMerkleHash;
   isRightSibling: boolean;
}

/** A single statistic `(key, value, period)` to prove on-chain. */
export interface ApiScoreStat {
   key: number;
   value: number;
   period: number;
}

export interface ApiScoresUpdateStats {
   updateCount: number;
   /** ms. */
   minTimestamp: number;
   /** ms. */
   maxTimestamp: number;
}

export interface ApiScoresBatchSummary {
   fixtureId: number;
   updateStats: ApiScoresUpdateStats;
   /** Sub-tree root for this fixture's events (32-byte number array). */
   eventStatsSubTreeRoot: ApiMerkleHash;
}

/**
 * `GET /api/scores/stat-validation` response: the three-stage Merkle proof
 * connecting a stat (or two stats) to the on-chain batch root. Feed into the
 * program's `validateStat` instruction (see `program/instructions`).
 */
export interface ApiScoresStatValidation {
   /** Event timestamp (ms) — used to derive the daily-scores-roots PDA. */
   ts: number;
   statToProve: ApiScoreStat;
   /** Event stat root (32-byte number array). */
   eventStatRoot: ApiMerkleHash;
   summary: ApiScoresBatchSummary;
   statProof: ApiProofNode[];
   subTreeProof: ApiProofNode[];
   mainTreeProof: ApiProofNode[];
   /** Present only when a second stat (`statKey2`) was requested. */
   statToProve2?: ApiScoreStat;
   /** Present only when a second stat (`statKey2`) was requested. */
   statProof2?: ApiProofNode[];
}

// --- Fixtures / odds validation ---

export interface ApiFixturesUpdateStats {
   updateCount: number;
   minTimestamp: number;
   maxTimestamp: number;
}

export interface ApiFixturesBatchSummary {
   fixtureId: number;
   competitionId: number;
   competition: string;
   updateStats: ApiFixturesUpdateStats;
   /** Sub-tree root (32-byte number array). */
   updateSubTreeRoot: ApiMerkleHash;
}

/** `GET /api/fixtures/validation` */
export interface ApiFixturesValidation {
   snapshot: ApiFixture;
   summary: ApiFixturesBatchSummary;
   subTreeProof: ApiProofNode[];
   mainTreeProof: ApiProofNode[];
}

export interface ApiFixturesBatchMetadata {
   totalUpdateCount: number;
   numUniqueFixtures: number;
   overallBatchStartTs: number;
   overallBatchEndTs: number;
}

/** `GET /api/fixtures/batch-validation` */
export interface ApiFixturesBatchValidation {
   metadata: ApiFixturesBatchMetadata;
   proof: ApiProofNode[];
}

export interface ApiOddsUpdateStats {
   updateCount: number;
   minTimestamp: number;
   maxTimestamp: number;
}

export interface ApiOddsBatchSummary {
   fixtureId: number;
   updateStats: ApiOddsUpdateStats;
   oddsSubTreeRoot: ApiMerkleHash;
}

/** `GET /api/odds/validation` */
export interface ApiOddsValidation {
   odds: ApiOddsPayload;
   summary: ApiOddsBatchSummary;
   subTreeProof: ApiProofNode[];
   mainTreeProof: ApiProofNode[];
}

/** Base fields on live score events (PascalCase wire format). */
export interface ApiScoreEventBase {
   FixtureId: number;
   GameState: string;
   StartTime: number;
   Action: string;
   Id: number;
   Ts: number;
   Seq: number;
   Participant1Id: number;
   Participant2Id: number;
   Participant1IsHome: boolean;
   FixtureGroupId: number;
   CompetitionId: number;
   SportId: number;
   CountryId?: number;
   IsTeam?: boolean;
   ConnectionId?: number;
   CoverageSecondaryData?: boolean;
   CoverageType?: string;
   Confirmed?: boolean;
   Stats?: ApiScoreStats;
   Participant?: number;
   Kickoff?: ApiKickoffDetails;
   Lineups?: ApiLineupData[];
   Possession?: number;
}

export type ApiSoccerScoreEvent = ApiScoreEventBase & ApiSoccerScoreEventFields;
export type ApiBasketballScoreEvent = ApiScoreEventBase & ApiBasketballScoreEventFields;
export type ApiUsFootballScoreEvent = ApiScoreEventBase & ApiUsFootballScoreEventFields;

export type ApiScoreEventBySport =
   | ApiSoccerScoreEvent
   | ApiBasketballScoreEvent
   | ApiUsFootballScoreEvent;

/**
 * Score update as returned by the live REST/SSE API.
 * Narrow on `Type`: `Soccer`, `UsFootball` (NFL), or
 * `Basketball`.
 */
export type ApiScoreEvent = ApiScoreEventBase &
   Partial<
      ApiSoccerScoreEventFields &
         ApiBasketballScoreEventFields &
         ApiUsFootballScoreEventFields
   >;
