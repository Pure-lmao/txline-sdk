/**
 * Encoders and decoders for TxLINE (txoracle) instruction payloads and on-chain
 * account data, using @solana/kit codecs.
 *
 * Wire layouts follow the Anchor IDL (Borsh + 8-byte instruction discriminators).
 * Instruction data = 8-byte discriminator ++ Borsh-encoded payload.
 *
 * @see https://txline-docs.txodds.com/documentation/programs/mainnet
 * @see https://www.solanakit.com/docs/concepts/codecs
 */

import {
   addDecoderSizePrefix,
   addEncoderSizePrefix,
   fixDecoderSize,
   fixEncoderSize,
   getAddressDecoder,
   getAddressEncoder,
   getArrayDecoder,
   getArrayEncoder,
   getBytesDecoder,
   getBytesEncoder,
   getEnumDecoder,
   getEnumEncoder,
   getI16Decoder,
   getI16Encoder,
   getI32Decoder,
   getI32Encoder,
   getI64Decoder,
   getI64Encoder,
   getOptionDecoder,
   getOptionEncoder,
   getStructDecoder,
   getStructEncoder,
   getU16Decoder,
   getU16Encoder,
   getU32Decoder,
   getU32Encoder,
   getU64Decoder,
   getU64Encoder,
   getU8Decoder,
   getU8Encoder,
   getUtf8Decoder,
   getUtf8Encoder,
   isSome,
   none,
   some,
   transformDecoder,
   transformEncoder,
   type Decoder,
   type Encoder,
   type ReadonlyUint8Array,
} from '@solana/kit';

import {
   CLOSE_PRICING_MATRIX_IX_DISCRIMINATOR,
   INITIALIZE_PRICING_MATRIX_IX_DISCRIMINATOR,
   INITIALIZE_TREASURY_V2_IX_DISCRIMINATOR,
   INITIALIZE_USDT_TREASURY_IX_DISCRIMINATOR,
   INSERT_BATCH_ROOT_IX_DISCRIMINATOR,
   INSERT_FIXTURES_ROOT_IX_DISCRIMINATOR,
   INSERT_SCORES_ROOT_IX_DISCRIMINATOR,
   PRICING_MATRIX_ACCOUNT_DISCRIMINATOR,
   PURCHASE_SUBSCRIPTION_TOKEN_USDT_IX_DISCRIMINATOR,
   SUBSCRIBE_IX_DISCRIMINATOR,
   SUBSCRIBE_V2_IX_DISCRIMINATOR,
   UPDATE_PRICING_MATRIX_IX_DISCRIMINATOR,
   VALIDATE_FIXTURE_BATCH_IX_DISCRIMINATOR,
   VALIDATE_FIXTURE_IX_DISCRIMINATOR,
   VALIDATE_ODDS_IX_DISCRIMINATOR,
   VALIDATE_STAT_IX_DISCRIMINATOR,
   WITHDRAW_USDT_IX_DISCRIMINATOR,
} from './constants';
import {
   BinaryExpression,
   Comparison,
   type BatchMetadata,
   type DecodedTxoracleInstruction,
   type Fixture,
   type FixtureBatchSummary,
   type FixtureUpdateStats,
   type Hash32,
   type InsertBatchRootIxData,
   type InsertFixturesRootIxData,
   type InsertScoresRootIxData,
   type Odds,
   type OddsBatchSummary,
   type OddsUpdateStats,
   type PricingMatrixAccount,
   type ProofNode,
   type ScoreStat,
   type ScoresBatchSummary,
   type ScoresUpdateStats,
   type ServiceRow,
   type StatTerm,
   type SubscribeIxData,
   type SubscribeV2IxData,
   type TraderPredicate,
   type ValidateFixtureBatchIxData,
   type ValidateFixtureIxData,
   type ValidateOddsIxData,
   type ValidateStatIxData,
} from './types';

const ANCHOR_IX_DISCRIMINATOR_LEN = 8;

const getBoolU8Encoder = (): Encoder<boolean> =>
   transformEncoder(getU8Encoder(), (v: boolean) => (v ? 1 : 0));

const getBoolU8Decoder = (): Decoder<boolean> =>
   transformDecoder(getU8Decoder(), (n: number) => {
      if (n !== 0 && n !== 1) {
         throw new RangeError(`boolean wire byte must be 0 or 1, got ${n}`);
      }
      return n !== 0;
   });

const getBorshStringEncoder = (): Encoder<string> =>
   addEncoderSizePrefix(getUtf8Encoder(), getU32Encoder());

const getBorshStringDecoder = (): Decoder<string> =>
   addDecoderSizePrefix(getUtf8Decoder(), getU32Decoder());

const getNullableBorshStringEncoder = (): Encoder<string | null> =>
   transformEncoder(getOptionEncoder(getBorshStringEncoder()), (value: string | null) =>
      value === null ? none() : some(value),
   );

const getNullableBorshStringDecoder = (): Decoder<string | null> =>
   transformDecoder(getOptionDecoder(getBorshStringDecoder()), (value) => (isSome(value) ? value.value : null));

const getHash32Encoder = (): Encoder<Hash32> =>
   transformEncoder(fixEncoderSize(getBytesEncoder(), 32), (hash: Hash32) => {
      if (hash.length !== 32) {
         throw new RangeError(`hash must be 32 bytes, got ${hash.length}`);
      }
      return hash;
   });

const getHash32Decoder = (): Decoder<Hash32> =>
   transformDecoder(fixDecoderSize(getBytesDecoder(), 32), (bytes: ReadonlyUint8Array) => {
      const out = new Uint8Array(bytes) as Hash32;
      return out;
   });

const getBinaryExpressionEncoder = (): Encoder<BinaryExpression> => getEnumEncoder(BinaryExpression);
const getBinaryExpressionDecoder = (): Decoder<BinaryExpression> => getEnumDecoder(BinaryExpression);
const getComparisonEncoder = (): Encoder<Comparison> => getEnumEncoder(Comparison);
const getComparisonDecoder = (): Decoder<Comparison> => getEnumDecoder(Comparison);

export const getScoreStatEncoder = (): Encoder<ScoreStat> =>
   getStructEncoder([
      ['key', getU32Encoder()],
      ['value', getI32Encoder()],
      ['period', getI32Encoder()],
   ]);

export const getScoreStatDecoder = (): Decoder<ScoreStat> =>
   getStructDecoder([
      ['key', getU32Decoder()],
      ['value', getI32Decoder()],
      ['period', getI32Decoder()],
   ]);

export const getProofNodeEncoder = (): Encoder<ProofNode> =>
   getStructEncoder([
      ['hash', getHash32Encoder()],
      ['isRightSibling', getBoolU8Encoder()],
   ]);

export const getProofNodeDecoder = (): Decoder<ProofNode> =>
   getStructDecoder([
      ['hash', getHash32Decoder()],
      ['isRightSibling', getBoolU8Decoder()],
   ]);

export const getServiceRowEncoder = (): Encoder<ServiceRow> =>
   getStructEncoder([
      ['rowId', getU16Encoder()],
      ['pricePerWeekToken', getU64Encoder()],
      ['samplingIntervalSec', getU32Encoder()],
      ['leagueBundleId', getI16Encoder()],
      ['marketBundleId', getI16Encoder()],
   ]);

export const getServiceRowDecoder = (): Decoder<ServiceRow> =>
   getStructDecoder([
      ['rowId', getU16Decoder()],
      ['pricePerWeekToken', getU64Decoder()],
      ['samplingIntervalSec', getU32Decoder()],
      ['leagueBundleId', getI16Decoder()],
      ['marketBundleId', getI16Decoder()],
   ]);

export const getBatchMetadataEncoder = (): Encoder<BatchMetadata> =>
   getStructEncoder([
      ['totalUpdateCount', getI32Encoder()],
      ['numUniqueFixtures', getI32Encoder()],
      ['overallBatchStartTs', getI64Encoder()],
      ['overallBatchEndTs', getI64Encoder()],
   ]);

export const getBatchMetadataDecoder = (): Decoder<BatchMetadata> =>
   getStructDecoder([
      ['totalUpdateCount', getI32Decoder()],
      ['numUniqueFixtures', getI32Decoder()],
      ['overallBatchStartTs', getI64Decoder()],
      ['overallBatchEndTs', getI64Decoder()],
   ]);

export const getFixtureUpdateStatsEncoder = (): Encoder<FixtureUpdateStats> =>
   getStructEncoder([
      ['updateCount', getU32Encoder()],
      ['minTimestamp', getI64Encoder()],
      ['maxTimestamp', getI64Encoder()],
   ]);

export const getFixtureUpdateStatsDecoder = (): Decoder<FixtureUpdateStats> =>
   getStructDecoder([
      ['updateCount', getU32Decoder()],
      ['minTimestamp', getI64Decoder()],
      ['maxTimestamp', getI64Decoder()],
   ]);

export const getFixtureBatchSummaryEncoder = (): Encoder<FixtureBatchSummary> =>
   getStructEncoder([
      ['fixtureId', getI64Encoder()],
      ['competitionId', getI32Encoder()],
      ['competition', getBorshStringEncoder()],
      ['updateStats', getFixtureUpdateStatsEncoder()],
      ['updateSubTreeRoot', getHash32Encoder()],
   ]);

export const getFixtureBatchSummaryDecoder = (): Decoder<FixtureBatchSummary> =>
   getStructDecoder([
      ['fixtureId', getI64Decoder()],
      ['competitionId', getI32Decoder()],
      ['competition', getBorshStringDecoder()],
      ['updateStats', getFixtureUpdateStatsDecoder()],
      ['updateSubTreeRoot', getHash32Decoder()],
   ]);

export const getFixtureEncoder = (): Encoder<Fixture> =>
   getStructEncoder([
      ['ts', getI64Encoder()],
      ['startTime', getI64Encoder()],
      ['competition', getBorshStringEncoder()],
      ['competitionId', getI32Encoder()],
      ['fixtureGroupId', getI32Encoder()],
      ['participant1Id', getI32Encoder()],
      ['participant1', getBorshStringEncoder()],
      ['participant2Id', getI32Encoder()],
      ['participant2', getBorshStringEncoder()],
      ['fixtureId', getI64Encoder()],
      ['participant1IsHome', getBoolU8Encoder()],
   ]);

export const getFixtureDecoder = (): Decoder<Fixture> =>
   getStructDecoder([
      ['ts', getI64Decoder()],
      ['startTime', getI64Decoder()],
      ['competition', getBorshStringDecoder()],
      ['competitionId', getI32Decoder()],
      ['fixtureGroupId', getI32Decoder()],
      ['participant1Id', getI32Decoder()],
      ['participant1', getBorshStringDecoder()],
      ['participant2Id', getI32Decoder()],
      ['participant2', getBorshStringDecoder()],
      ['fixtureId', getI64Decoder()],
      ['participant1IsHome', getBoolU8Decoder()],
   ]);

export const getOddsUpdateStatsEncoder = (): Encoder<OddsUpdateStats> =>
   getStructEncoder([
      ['updateCount', getU32Encoder()],
      ['minTimestamp', getI64Encoder()],
      ['maxTimestamp', getI64Encoder()],
   ]);

export const getOddsUpdateStatsDecoder = (): Decoder<OddsUpdateStats> =>
   getStructDecoder([
      ['updateCount', getU32Decoder()],
      ['minTimestamp', getI64Decoder()],
      ['maxTimestamp', getI64Decoder()],
   ]);

export const getOddsBatchSummaryEncoder = (): Encoder<OddsBatchSummary> =>
   getStructEncoder([
      ['fixtureId', getI64Encoder()],
      ['updateStats', getOddsUpdateStatsEncoder()],
      ['oddsSubTreeRoot', getHash32Encoder()],
   ]);

export const getOddsBatchSummaryDecoder = (): Decoder<OddsBatchSummary> =>
   getStructDecoder([
      ['fixtureId', getI64Decoder()],
      ['updateStats', getOddsUpdateStatsDecoder()],
      ['oddsSubTreeRoot', getHash32Decoder()],
   ]);

export const getOddsEncoder = (): Encoder<Odds> =>
   getStructEncoder([
      ['fixtureId', getI64Encoder()],
      ['messageId', getBorshStringEncoder()],
      ['ts', getI64Encoder()],
      ['bookmaker', getBorshStringEncoder()],
      ['bookmakerId', getI32Encoder()],
      ['superOddsType', getBorshStringEncoder()],
      ['gameState', getNullableBorshStringEncoder()],
      ['inRunning', getBoolU8Encoder()],
      ['marketParameters', getNullableBorshStringEncoder()],
      ['marketPeriod', getNullableBorshStringEncoder()],
      ['priceNames', getArrayEncoder(getBorshStringEncoder())],
      ['prices', getArrayEncoder(getI32Encoder())],
   ]);

export const getOddsDecoder = (): Decoder<Odds> =>
   getStructDecoder([
      ['fixtureId', getI64Decoder()],
      ['messageId', getBorshStringDecoder()],
      ['ts', getI64Decoder()],
      ['bookmaker', getBorshStringDecoder()],
      ['bookmakerId', getI32Decoder()],
      ['superOddsType', getBorshStringDecoder()],
      ['gameState', getNullableBorshStringDecoder()],
      ['inRunning', getBoolU8Decoder()],
      ['marketParameters', getNullableBorshStringDecoder()],
      ['marketPeriod', getNullableBorshStringDecoder()],
      ['priceNames', getArrayDecoder(getBorshStringDecoder())],
      ['prices', getArrayDecoder(getI32Decoder())],
   ]);

export const getScoresUpdateStatsEncoder = (): Encoder<ScoresUpdateStats> =>
   getStructEncoder([
      ['updateCount', getI32Encoder()],
      ['minTimestamp', getI64Encoder()],
      ['maxTimestamp', getI64Encoder()],
   ]);

export const getScoresUpdateStatsDecoder = (): Decoder<ScoresUpdateStats> =>
   getStructDecoder([
      ['updateCount', getI32Decoder()],
      ['minTimestamp', getI64Decoder()],
      ['maxTimestamp', getI64Decoder()],
   ]);

export const getScoresBatchSummaryEncoder = (): Encoder<ScoresBatchSummary> =>
   getStructEncoder([
      ['fixtureId', getI64Encoder()],
      ['updateStats', getScoresUpdateStatsEncoder()],
      ['eventsSubTreeRoot', getHash32Encoder()],
   ]);

export const getScoresBatchSummaryDecoder = (): Decoder<ScoresBatchSummary> =>
   getStructDecoder([
      ['fixtureId', getI64Decoder()],
      ['updateStats', getScoresUpdateStatsDecoder()],
      ['eventsSubTreeRoot', getHash32Decoder()],
   ]);

export const getStatTermEncoder = (): Encoder<StatTerm> =>
   getStructEncoder([
      ['statToProve', getScoreStatEncoder()],
      ['eventStatRoot', getHash32Encoder()],
      ['statProof', getArrayEncoder(getProofNodeEncoder())],
   ]);

export const getStatTermDecoder = (): Decoder<StatTerm> =>
   getStructDecoder([
      ['statToProve', getScoreStatDecoder()],
      ['eventStatRoot', getHash32Decoder()],
      ['statProof', getArrayDecoder(getProofNodeDecoder())],
   ]);

const getNullableStatTermEncoder = (): Encoder<StatTerm | null> =>
   transformEncoder(getOptionEncoder(getStatTermEncoder()), (value: StatTerm | null) =>
      value === null ? none() : some(value),
   );

const getNullableStatTermDecoder = (): Decoder<StatTerm | null> =>
   transformDecoder(getOptionDecoder(getStatTermDecoder()), (value) => (isSome(value) ? value.value : null));

const getNullableBinaryExpressionEncoder = (): Encoder<BinaryExpression | null> =>
   transformEncoder(getOptionEncoder(getBinaryExpressionEncoder()), (value: BinaryExpression | null) =>
      value === null ? none() : some(value),
   );

const getNullableBinaryExpressionDecoder = (): Decoder<BinaryExpression | null> =>
   transformDecoder(getOptionDecoder(getBinaryExpressionDecoder()), (value) =>
      isSome(value) ? value.value : null,
   );

export const getTraderPredicateEncoder = (): Encoder<TraderPredicate> =>
   getStructEncoder([
      ['threshold', getI32Encoder()],
      ['comparison', getComparisonEncoder()],
   ]);

export const getTraderPredicateDecoder = (): Decoder<TraderPredicate> =>
   getStructDecoder([
      ['threshold', getI32Decoder()],
      ['comparison', getComparisonDecoder()],
   ]);

export const getPricingMatrixAccountEncoder = (): Encoder<PricingMatrixAccount> =>
   getStructEncoder([
      ['discriminator', fixEncoderSize(getBytesEncoder(), 8)],
      ['admin', getAddressEncoder()],
      ['rows', getArrayEncoder(getServiceRowEncoder())],
   ]);

export const getPricingMatrixAccountDecoder = (): Decoder<PricingMatrixAccount> =>
   transformDecoder(
      getStructDecoder([
         ['discriminator', fixDecoderSize(getBytesDecoder(), 8)],
         ['admin', getAddressDecoder()],
         ['rows', getArrayDecoder(getServiceRowDecoder())],
      ]),
      (decoded) => ({
         ...decoded,
         discriminator: new Uint8Array(decoded.discriminator),
      }),
   );

export const decodePricingMatrixAccount = (data: ReadonlyUint8Array): PricingMatrixAccount =>
   getPricingMatrixAccountDecoder().decode(new Uint8Array(data));

const getServiceRowVecEncoder = (): Encoder<ServiceRow[]> => getArrayEncoder(getServiceRowEncoder());
const getServiceRowVecDecoder = (): Decoder<ServiceRow[]> => getArrayDecoder(getServiceRowDecoder());

const getInsertBatchRootIxPayloadEncoder = (): Encoder<InsertBatchRootIxData> =>
   getStructEncoder([
      ['epochDay', getU16Encoder()],
      ['hourOfDay', getU8Encoder()],
      ['minuteOfHour', getU8Encoder()],
      ['root', getHash32Encoder()],
      ['accountBump', getU8Encoder()],
   ]);

const getInsertBatchRootIxPayloadDecoder = (): Decoder<InsertBatchRootIxData> =>
   getStructDecoder([
      ['epochDay', getU16Decoder()],
      ['hourOfDay', getU8Decoder()],
      ['minuteOfHour', getU8Decoder()],
      ['root', getHash32Decoder()],
      ['accountBump', getU8Decoder()],
   ]);

const getInsertFixturesRootIxPayloadEncoder = (): Encoder<InsertFixturesRootIxData> =>
   getStructEncoder([
      ['epochDay', getU16Encoder()],
      ['index', getU64Encoder()],
      ['root', getHash32Encoder()],
   ]);

const getInsertFixturesRootIxPayloadDecoder = (): Decoder<InsertFixturesRootIxData> =>
   getStructDecoder([
      ['epochDay', getU16Decoder()],
      ['index', getU64Decoder()],
      ['root', getHash32Decoder()],
   ]);

const getInsertScoresRootIxPayloadEncoder = (): Encoder<InsertScoresRootIxData> =>
   getStructEncoder([
      ['epochDay', getU16Encoder()],
      ['hourOfDay', getU8Encoder()],
      ['minuteOfHour', getU8Encoder()],
      ['root', getHash32Encoder()],
   ]);

const getInsertScoresRootIxPayloadDecoder = (): Decoder<InsertScoresRootIxData> =>
   getStructDecoder([
      ['epochDay', getU16Decoder()],
      ['hourOfDay', getU8Decoder()],
      ['minuteOfHour', getU8Decoder()],
      ['root', getHash32Decoder()],
   ]);

const getSubscribeIxPayloadEncoder = (): Encoder<SubscribeIxData> =>
   getStructEncoder([
      ['serviceLevelId', getU16Encoder()],
      ['weeks', getU8Encoder()],
   ]);

const getSubscribeIxPayloadDecoder = (): Decoder<SubscribeIxData> =>
   getStructDecoder([
      ['serviceLevelId', getU16Decoder()],
      ['weeks', getU8Decoder()],
   ]);

const getSubscribeV2IxPayloadEncoder = (): Encoder<SubscribeV2IxData> =>
   getStructEncoder([['weeks', getU8Encoder()]]);

const getSubscribeV2IxPayloadDecoder = (): Decoder<SubscribeV2IxData> =>
   getStructDecoder([['weeks', getU8Decoder()]]);

const getValidateFixtureIxPayloadEncoder = (): Encoder<ValidateFixtureIxData> =>
   getStructEncoder([
      ['snapshot', getFixtureEncoder()],
      ['summary', getFixtureBatchSummaryEncoder()],
      ['subTreeProof', getArrayEncoder(getProofNodeEncoder())],
      ['mainTreeProof', getArrayEncoder(getProofNodeEncoder())],
   ]);

const getValidateFixtureIxPayloadDecoder = (): Decoder<ValidateFixtureIxData> =>
   getStructDecoder([
      ['snapshot', getFixtureDecoder()],
      ['summary', getFixtureBatchSummaryDecoder()],
      ['subTreeProof', getArrayDecoder(getProofNodeDecoder())],
      ['mainTreeProof', getArrayDecoder(getProofNodeDecoder())],
   ]);

const getValidateFixtureBatchIxPayloadEncoder = (): Encoder<ValidateFixtureBatchIxData> =>
   getStructEncoder([
      ['index', getU8Encoder()],
      ['metadata', getBatchMetadataEncoder()],
      ['proof', getArrayEncoder(getProofNodeEncoder())],
   ]);

const getValidateFixtureBatchIxPayloadDecoder = (): Decoder<ValidateFixtureBatchIxData> =>
   getStructDecoder([
      ['index', getU8Decoder()],
      ['metadata', getBatchMetadataDecoder()],
      ['proof', getArrayDecoder(getProofNodeDecoder())],
   ]);

const getValidateOddsIxPayloadEncoder = (): Encoder<ValidateOddsIxData> =>
   getStructEncoder([
      ['ts', getI64Encoder()],
      ['oddsSnapshot', getOddsEncoder()],
      ['summary', getOddsBatchSummaryEncoder()],
      ['subTreeProof', getArrayEncoder(getProofNodeEncoder())],
      ['mainTreeProof', getArrayEncoder(getProofNodeEncoder())],
   ]);

const getValidateOddsIxPayloadDecoder = (): Decoder<ValidateOddsIxData> =>
   getStructDecoder([
      ['ts', getI64Decoder()],
      ['oddsSnapshot', getOddsDecoder()],
      ['summary', getOddsBatchSummaryDecoder()],
      ['subTreeProof', getArrayDecoder(getProofNodeDecoder())],
      ['mainTreeProof', getArrayDecoder(getProofNodeDecoder())],
   ]);

const getValidateStatIxPayloadEncoder = (): Encoder<ValidateStatIxData> =>
   getStructEncoder([
      ['ts', getI64Encoder()],
      ['fixtureSummary', getScoresBatchSummaryEncoder()],
      ['fixtureProof', getArrayEncoder(getProofNodeEncoder())],
      ['mainTreeProof', getArrayEncoder(getProofNodeEncoder())],
      ['predicate', getTraderPredicateEncoder()],
      ['statA', getStatTermEncoder()],
      ['statB', getNullableStatTermEncoder()],
      ['op', getNullableBinaryExpressionEncoder()],
   ]);

const getValidateStatIxPayloadDecoder = (): Decoder<ValidateStatIxData> =>
   getStructDecoder([
      ['ts', getI64Decoder()],
      ['fixtureSummary', getScoresBatchSummaryDecoder()],
      ['fixtureProof', getArrayDecoder(getProofNodeDecoder())],
      ['mainTreeProof', getArrayDecoder(getProofNodeDecoder())],
      ['predicate', getTraderPredicateDecoder()],
      ['statA', getStatTermDecoder()],
      ['statB', getNullableStatTermDecoder()],
      ['op', getNullableBinaryExpressionDecoder()],
   ]);

function concatAnchorDiscriminator(disc: readonly number[], payload: ReadonlyUint8Array | Uint8Array): Uint8Array {
   const p = new Uint8Array(payload);
   const out = new Uint8Array(ANCHOR_IX_DISCRIMINATOR_LEN + p.length);
   out.set(disc, 0);
   out.set(p, ANCHOR_IX_DISCRIMINATOR_LEN);
   return out;
}

function discriminatorMatches(data: ReadonlyUint8Array, disc: readonly number[]): boolean {
   if (data.length < ANCHOR_IX_DISCRIMINATOR_LEN) {
      return false;
   }
   for (let i = 0; i < ANCHOR_IX_DISCRIMINATOR_LEN; i++) {
      if (data[i] !== disc[i]) {
         return false;
      }
   }
   return true;
}

function ixPayload(data: ReadonlyUint8Array): Uint8Array {
   return new Uint8Array(data.subarray(ANCHOR_IX_DISCRIMINATOR_LEN));
}

export function encodeSubscribeIxData(data: SubscribeIxData): Uint8Array {
   return concatAnchorDiscriminator(SUBSCRIBE_IX_DISCRIMINATOR, getSubscribeIxPayloadEncoder().encode(data));
}

export function decodeSubscribeIxData(data: ReadonlyUint8Array): SubscribeIxData {
   if (!discriminatorMatches(data, SUBSCRIBE_IX_DISCRIMINATOR)) {
      throw new RangeError('not a subscribe instruction');
   }
   return getSubscribeIxPayloadDecoder().decode(ixPayload(data));
}

export function encodeSubscribeV2IxData(data: SubscribeV2IxData): Uint8Array {
   return concatAnchorDiscriminator(SUBSCRIBE_V2_IX_DISCRIMINATOR, getSubscribeV2IxPayloadEncoder().encode(data));
}

export function decodeSubscribeV2IxData(data: ReadonlyUint8Array): SubscribeV2IxData {
   if (!discriminatorMatches(data, SUBSCRIBE_V2_IX_DISCRIMINATOR)) {
      throw new RangeError('not a subscribe_v2 instruction');
   }
   return getSubscribeV2IxPayloadDecoder().decode(ixPayload(data));
}

export function encodeValidateStatIxData(data: ValidateStatIxData): Uint8Array {
   return concatAnchorDiscriminator(VALIDATE_STAT_IX_DISCRIMINATOR, getValidateStatIxPayloadEncoder().encode(data));
}

export function decodeValidateStatIxData(data: ReadonlyUint8Array): ValidateStatIxData {
   if (!discriminatorMatches(data, VALIDATE_STAT_IX_DISCRIMINATOR)) {
      throw new RangeError('not a validate_stat instruction');
   }
   return getValidateStatIxPayloadDecoder().decode(ixPayload(data));
}

export function encodeValidateFixtureIxData(data: ValidateFixtureIxData): Uint8Array {
   return concatAnchorDiscriminator(VALIDATE_FIXTURE_IX_DISCRIMINATOR, getValidateFixtureIxPayloadEncoder().encode(data));
}

export function decodeValidateFixtureIxData(data: ReadonlyUint8Array): ValidateFixtureIxData {
   if (!discriminatorMatches(data, VALIDATE_FIXTURE_IX_DISCRIMINATOR)) {
      throw new RangeError('not a validate_fixture instruction');
   }
   return getValidateFixtureIxPayloadDecoder().decode(ixPayload(data));
}

export function encodeValidateFixtureBatchIxData(data: ValidateFixtureBatchIxData): Uint8Array {
   return concatAnchorDiscriminator(
      VALIDATE_FIXTURE_BATCH_IX_DISCRIMINATOR,
      getValidateFixtureBatchIxPayloadEncoder().encode(data),
   );
}

export function decodeValidateFixtureBatchIxData(data: ReadonlyUint8Array): ValidateFixtureBatchIxData {
   if (!discriminatorMatches(data, VALIDATE_FIXTURE_BATCH_IX_DISCRIMINATOR)) {
      throw new RangeError('not a validate_fixture_batch instruction');
   }
   return getValidateFixtureBatchIxPayloadDecoder().decode(ixPayload(data));
}

export function encodeValidateOddsIxData(data: ValidateOddsIxData): Uint8Array {
   return concatAnchorDiscriminator(VALIDATE_ODDS_IX_DISCRIMINATOR, getValidateOddsIxPayloadEncoder().encode(data));
}

export function decodeValidateOddsIxData(data: ReadonlyUint8Array): ValidateOddsIxData {
   if (!discriminatorMatches(data, VALIDATE_ODDS_IX_DISCRIMINATOR)) {
      throw new RangeError('not a validate_odds instruction');
   }
   return getValidateOddsIxPayloadDecoder().decode(ixPayload(data));
}

export function encodeTxoracleInstructionData(ix: DecodedTxoracleInstruction): Uint8Array {
   switch (ix.kind) {
      case 'closePricingMatrix':
         return new Uint8Array(CLOSE_PRICING_MATRIX_IX_DISCRIMINATOR);
      case 'initializePricingMatrix':
         return concatAnchorDiscriminator(
            INITIALIZE_PRICING_MATRIX_IX_DISCRIMINATOR,
            getServiceRowVecEncoder().encode(ix.rows),
         );
      case 'initializeTreasuryV2':
         return new Uint8Array(INITIALIZE_TREASURY_V2_IX_DISCRIMINATOR);
      case 'initializeUsdtTreasury':
         return new Uint8Array(INITIALIZE_USDT_TREASURY_IX_DISCRIMINATOR);
      case 'insertBatchRoot':
         return concatAnchorDiscriminator(
            INSERT_BATCH_ROOT_IX_DISCRIMINATOR,
            getInsertBatchRootIxPayloadEncoder().encode(ix.data),
         );
      case 'insertFixturesRoot':
         return concatAnchorDiscriminator(
            INSERT_FIXTURES_ROOT_IX_DISCRIMINATOR,
            getInsertFixturesRootIxPayloadEncoder().encode(ix.data),
         );
      case 'insertScoresRoot':
         return concatAnchorDiscriminator(
            INSERT_SCORES_ROOT_IX_DISCRIMINATOR,
            getInsertScoresRootIxPayloadEncoder().encode(ix.data),
         );
      case 'purchaseSubscriptionTokenUsdt': {
         const payload = getU64Encoder().encode(ix.txlineAmount);
         return concatAnchorDiscriminator(PURCHASE_SUBSCRIPTION_TOKEN_USDT_IX_DISCRIMINATOR, payload);
      }
      case 'subscribe':
         return encodeSubscribeIxData(ix.data);
      case 'subscribeV2':
         return encodeSubscribeV2IxData(ix.data);
      case 'updatePricingMatrix':
         return concatAnchorDiscriminator(
            UPDATE_PRICING_MATRIX_IX_DISCRIMINATOR,
            getServiceRowVecEncoder().encode(ix.rows),
         );
      case 'validateFixture':
         return encodeValidateFixtureIxData(ix.data);
      case 'validateFixtureBatch':
         return encodeValidateFixtureBatchIxData(ix.data);
      case 'validateOdds':
         return encodeValidateOddsIxData(ix.data);
      case 'validateStat':
         return encodeValidateStatIxData(ix.data);
      case 'withdrawUsdt': {
         const payload = getU64Encoder().encode(ix.amount);
         return concatAnchorDiscriminator(WITHDRAW_USDT_IX_DISCRIMINATOR, payload);
      }
      default: {
         const _exhaustive: never = ix;
         throw new Error(`unreachable: ${String(_exhaustive)}`);
      }
   }
}

export function decodeTxoracleInstructionData(data: ReadonlyUint8Array): DecodedTxoracleInstruction {
   if (data.length < ANCHOR_IX_DISCRIMINATOR_LEN) {
      throw new RangeError('instruction data too short for Anchor discriminator');
   }
   const payload = ixPayload(data);
   if (discriminatorMatches(data, CLOSE_PRICING_MATRIX_IX_DISCRIMINATOR)) {
      if (payload.length !== 0) {
         throw new RangeError('closePricingMatrix: expected no payload');
      }
      return { kind: 'closePricingMatrix' };
   }
   if (discriminatorMatches(data, INITIALIZE_PRICING_MATRIX_IX_DISCRIMINATOR)) {
      return { kind: 'initializePricingMatrix', rows: getServiceRowVecDecoder().decode(payload) };
   }
   if (discriminatorMatches(data, INITIALIZE_TREASURY_V2_IX_DISCRIMINATOR)) {
      if (payload.length !== 0) {
         throw new RangeError('initializeTreasuryV2: expected no payload');
      }
      return { kind: 'initializeTreasuryV2' };
   }
   if (discriminatorMatches(data, INITIALIZE_USDT_TREASURY_IX_DISCRIMINATOR)) {
      if (payload.length !== 0) {
         throw new RangeError('initializeUsdtTreasury: expected no payload');
      }
      return { kind: 'initializeUsdtTreasury' };
   }
   if (discriminatorMatches(data, INSERT_BATCH_ROOT_IX_DISCRIMINATOR)) {
      return { kind: 'insertBatchRoot', data: getInsertBatchRootIxPayloadDecoder().decode(payload) };
   }
   if (discriminatorMatches(data, INSERT_FIXTURES_ROOT_IX_DISCRIMINATOR)) {
      return { kind: 'insertFixturesRoot', data: getInsertFixturesRootIxPayloadDecoder().decode(payload) };
   }
   if (discriminatorMatches(data, INSERT_SCORES_ROOT_IX_DISCRIMINATOR)) {
      return { kind: 'insertScoresRoot', data: getInsertScoresRootIxPayloadDecoder().decode(payload) };
   }
   if (discriminatorMatches(data, PURCHASE_SUBSCRIPTION_TOKEN_USDT_IX_DISCRIMINATOR)) {
      return { kind: 'purchaseSubscriptionTokenUsdt', txlineAmount: getU64Decoder().decode(payload) };
   }
   if (discriminatorMatches(data, SUBSCRIBE_IX_DISCRIMINATOR)) {
      return { kind: 'subscribe', data: getSubscribeIxPayloadDecoder().decode(payload) };
   }
   if (discriminatorMatches(data, SUBSCRIBE_V2_IX_DISCRIMINATOR)) {
      return { kind: 'subscribeV2', data: getSubscribeV2IxPayloadDecoder().decode(payload) };
   }
   if (discriminatorMatches(data, UPDATE_PRICING_MATRIX_IX_DISCRIMINATOR)) {
      return { kind: 'updatePricingMatrix', rows: getServiceRowVecDecoder().decode(payload) };
   }
   if (discriminatorMatches(data, VALIDATE_FIXTURE_IX_DISCRIMINATOR)) {
      return { kind: 'validateFixture', data: getValidateFixtureIxPayloadDecoder().decode(payload) };
   }
   if (discriminatorMatches(data, VALIDATE_FIXTURE_BATCH_IX_DISCRIMINATOR)) {
      return { kind: 'validateFixtureBatch', data: getValidateFixtureBatchIxPayloadDecoder().decode(payload) };
   }
   if (discriminatorMatches(data, VALIDATE_ODDS_IX_DISCRIMINATOR)) {
      return { kind: 'validateOdds', data: getValidateOddsIxPayloadDecoder().decode(payload) };
   }
   if (discriminatorMatches(data, VALIDATE_STAT_IX_DISCRIMINATOR)) {
      return { kind: 'validateStat', data: getValidateStatIxPayloadDecoder().decode(payload) };
   }
   if (discriminatorMatches(data, WITHDRAW_USDT_IX_DISCRIMINATOR)) {
      return { kind: 'withdrawUsdt', amount: getU64Decoder().decode(payload) };
   }
   throw new RangeError(
      `unknown txoracle instruction discriminator: ${Array.from(data.subarray(0, 8))
         .map((b) => b.toString())
         .join(',')}`,
   );
}

/** Coerce a 32-byte API Merkle hash (JSON number array) to raw bytes. */
export function apiHashToBytes(hash: ReadonlyUint8Array | readonly number[]): Uint8Array {
   return hash instanceof Uint8Array ? hash : new Uint8Array(hash);
}

/** Coerce API Merkle hashes into fixed 32-byte wire form. */
export function hash32FromBytes(bytes: ReadonlyUint8Array | readonly number[]): Hash32 {
   const arr = apiHashToBytes(bytes);
   if (arr.length !== 32) {
      throw new RangeError(`hash must be 32 bytes, got ${arr.length}`);
   }
   return arr as Hash32;
}

/** Map an API merkle proof node (`{ hash, isRightSibling }`) into the on-chain {@link ProofNode}. */
export function proofNodeFromApi(node: { hash: ReadonlyUint8Array | readonly number[]; isRightSibling: boolean }): ProofNode {
   return {
      hash: hash32FromBytes(node.hash),
      isRightSibling: node.isRightSibling,
   };
}

export function assertPricingMatrixDiscriminator(data: ReadonlyUint8Array): void {
   if (!discriminatorMatches(data, PRICING_MATRIX_ACCOUNT_DISCRIMINATOR)) {
      throw new RangeError('account discriminator is not PricingMatrix');
   }
}
