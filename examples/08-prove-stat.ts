/**
 * Example 8 — Prove a score stat via Merkle proof (`proveStat`).
 *
 * Fetches `/api/scores/stat-validation`, builds a TxLINE `validate_stat`
 * instruction, simulates it, and classifies the outcome:
 *
 *   - **proved** — simulation ok, program return `[1]` (predicate true)
 *   - **not_proved** — simulation ok, program return `[0]` (valid proof, predicate false)
 *   - **invalid** — simulation error (bad proof, timestamp mismatch, etc.)
 *
 * TxLINE returns predicate pass/fail in **return data**, not as a failed instruction.
 * Only broken proofs / setup errors surface as `sim.err`.
 *
 * Env: FIXTURE_ID, SEQ, STAT_KEY, STAT_KEY2, THRESHOLD, COMPARISON (gt|lt|eq).
 * Requires JWT_<network> + API_KEY_<network> + wallet (SECRET_KEY).
 *
 * Run: `bun run examples/08-prove-stat.ts`
 */

import type { Address } from '@solana/kit';
import {
   BinaryExpression,
   Comparison,
   getProgramId,
   getValidateStatIx,
   hash32FromBytes,
   proofNodeFromApi,
   simulateTransaction,
   safeJSONStringify,
   type ApiProofNode,
   type ApiScoresStatValidation,
   type SimulationResult,
   type ValidateStatIxData,
} from '..';
import { DEVNET, NETWORK, apiGet, exampleClients, loadSigner, recordResponse } from './_shared';

type StatCheckComparison = 'gt' | 'lt' | 'eq';

export type ProveStatOutcome =
   | { kind: 'proved'; predicateMet: true }
   | { kind: 'not_proved'; predicateMet: false }
   | {
        kind: 'invalid';
        error: unknown;
        customCode?: number;
        anchorError?: string;
     };

const FIXTURE_ID = Number(process.env.FIXTURE_ID ?? 17588223);
const SEQ = Number(process.env.SEQ ?? 1024);
const STAT_KEY = Number(process.env.STAT_KEY ?? 1);
const STAT_KEY2 = process.env.STAT_KEY2 ? Number(process.env.STAT_KEY2) : 2;
const THRESHOLD = Number(process.env.THRESHOLD ?? 0);
const COMPARISON = (process.env.COMPARISON ?? 'gt') as StatCheckComparison;
const COMPUTE_UNIT_LIMIT = 600_000;

function comparisonFromCheck(c: StatCheckComparison): Comparison {
   switch (c) {
      case 'gt':
         return Comparison.GreaterThan;
      case 'lt':
         return Comparison.LessThan;
      case 'eq':
         return Comparison.EqualTo;
   }
}

function toProof(nodes: ApiProofNode[]) {
   return nodes.map((n) => proofNodeFromApi(n));
}

function mapValidation(
   v: ApiScoresStatValidation,
   threshold: number,
   comparison: Comparison,
   twoStat: boolean,
): ValidateStatIxData {
   return {
      ts: BigInt(v.ts),
      fixtureSummary: {
         fixtureId: BigInt(v.summary.fixtureId),
         updateStats: {
            updateCount: v.summary.updateStats.updateCount,
            minTimestamp: BigInt(v.summary.updateStats.minTimestamp),
            maxTimestamp: BigInt(v.summary.updateStats.maxTimestamp),
         },
         eventsSubTreeRoot: hash32FromBytes(v.summary.eventStatsSubTreeRoot),
      },
      fixtureProof: toProof(v.subTreeProof),
      mainTreeProof: toProof(v.mainTreeProof),
      predicate: { threshold, comparison },
      statA: {
         statToProve: v.statToProve,
         eventStatRoot: hash32FromBytes(v.eventStatRoot),
         statProof: toProof(v.statProof),
      },
      statB: twoStat && v.statToProve2
         ? {
              statToProve: v.statToProve2,
              eventStatRoot: hash32FromBytes(v.eventStatRoot),
              statProof: toProof(v.statProof2 ?? []),
           }
         : null,
      op: twoStat ? BinaryExpression.Subtract : null,
   };
}

/** Pull Anchor `Error Code` / `Error Number` from TxLINE program logs. */
export function anchorErrorFromLogs(logs: readonly string[] | null): string | undefined {
   if (!logs) return undefined;
   for (const line of logs) {
      const match = line.match(/Error Code: (\w+)\. Error Number: (\d+)/);
      if (match) return `${match[1]} (${match[2]})`;
   }
   return undefined;
}

/** Extract a custom program error code from a simulation `err` object. */
export function customErrorCode(err: unknown): number | undefined {
   if (typeof err !== 'object' || err === null) return undefined;
   const ixErr = (err as { InstructionError?: [string | number, unknown] }).InstructionError;
   if (!ixErr) return undefined;
   const inner = ixErr[1];
   if (typeof inner === 'object' && inner !== null && 'Custom' in inner) {
      const code = (inner as { Custom: string | number }).Custom;
      return typeof code === 'number' ? code : Number(code);
   }
   return undefined;
}

/**
 * Classify a `validate_stat` simulation.
 *
 * Observed on devnet (Mexico vs Korea, seq 1024):
 *   - predicate true  → `returnData.data === [1]` (`AQ==`)
 *   - predicate false → `returnData.data === [0]` (`AA==`)
 *   - bad Merkle path   → `InstructionError` custom 6023 (`InvalidStatProof`)
 *   - ts mismatch       → custom 6010 (`TimestampMismatch`)
 */
export function parseProveStatSimulation(
   sim: SimulationResult,
   txlineProgramId: Address = getProgramId(DEVNET),
): ProveStatOutcome {
   if (sim.err !== null) {
      return {
         kind: 'invalid',
         error: sim.err,
         customCode: customErrorCode(sim.err),
         anchorError: anchorErrorFromLogs(sim.logs),
      };
   }

   const ret = sim.returnData;
   if (!ret || ret.programId !== txlineProgramId) {
      return {
         kind: 'invalid',
         error: new Error('validate_stat simulation succeeded but returned no TxLINE return data'),
         anchorError: anchorErrorFromLogs(sim.logs),
      };
   }

   const flag = ret.data[0];
   if (flag === 1) return { kind: 'proved', predicateMet: true };
   if (flag === 0) return { kind: 'not_proved', predicateMet: false };

   return {
      kind: 'invalid',
      error: new Error(`unexpected validate_stat return payload: ${Buffer.from(ret.data).toString('base64')}`),
   };
}

export interface ProveStatParams {
   fixtureId: number;
   seq: number;
   statKey: number;
   threshold: number;
   comparison: StatCheckComparison;
   statKey2?: number;
   op?: 'add' | 'subtract';
}

/** Fetch Merkle proof from API, simulate `validate_stat`, return classified outcome. */
export async function proveStat(params: ProveStatParams): Promise<{
   outcome: ProveStatOutcome;
   validation: ApiScoresStatValidation;
   simulation: SimulationResult;
}> {
   const twoStat = params.statKey2 != null;
   const validation = await apiGet<ApiScoresStatValidation>('/api/scores/stat-validation', {
      params: {
         fixtureId: params.fixtureId,
         seq: params.seq,
         statKey: params.statKey,
         statKey2: params.statKey2,
      },
      record: 'scores_stat_validation',
   });

   if (twoStat && validation.statToProve2 == null) {
      throw new Error('statKey2 requested but API returned no statToProve2');
   }

   const ixData = mapValidation(
      validation,
      params.threshold,
      comparisonFromCheck(params.comparison),
      twoStat,
   );
   const ix = await getValidateStatIx(ixData, DEVNET);
   const signer = await loadSigner();
   const simulation = await simulateTransaction(exampleClients(), [ix], [signer], {
      computeUnitLimit: COMPUTE_UNIT_LIMIT,
   });
   const outcome = parseProveStatSimulation(simulation);
   return { outcome, validation, simulation };
}

function printOutcome(label: string, outcome: ProveStatOutcome, sim: SimulationResult): void {
   console.log(`\n[${label}] ${outcome.kind}${'predicateMet' in outcome ? ` (predicateMet=${outcome.predicateMet})` : ''}`);
   if (outcome.kind === 'invalid') {
      console.log('  error:', safeJSONStringify(outcome.error));
      if (outcome.customCode !== undefined) console.log('  customCode:', outcome.customCode);
      if (outcome.anchorError) console.log('  anchorError:', outcome.anchorError);
   }
   console.log('  units:', sim.unitsConsumed);
   if (sim.returnData) {
      console.log('  return:', Buffer.from(sim.returnData.data).toString('base64'));
   }
}

async function main(): Promise<void> {
   console.log(`network: ${NETWORK}`);
   console.log(`fixture ${FIXTURE_ID} seq ${SEQ} stat ${STAT_KEY}${STAT_KEY2 ? ` - ${STAT_KEY2}` : ''} ${COMPARISON} ${THRESHOLD}`);

   const pass = await proveStat({
      fixtureId: FIXTURE_ID,
      seq: SEQ,
      statKey: STAT_KEY,
      statKey2: STAT_KEY2,
      threshold: THRESHOLD,
      comparison: COMPARISON,
   });
   printOutcome('configured check', pass.outcome, pass.simulation);
   console.log('  statA:', pass.validation.statToProve, 'statB:', pass.validation.statToProve2 ?? '(none)');

   // Demonstrate the three simulation classes using the same API proof.
   const { validation } = pass;
   const signer = await loadSigner();
   const clients = exampleClients();

   async function simMapped(threshold: number, comparison: Comparison, label: string) {
      const ix = await getValidateStatIx(
         mapValidation(validation, threshold, comparison, true),
         DEVNET,
      );
      const simulation = await simulateTransaction(clients, [ix], [signer], {
         computeUnitLimit: COMPUTE_UNIT_LIMIT,
      });
      printOutcome(label, parseProveStatSimulation(simulation), simulation);
   }

   await simMapped(0, Comparison.GreaterThan, 'demo: proof passes (home-away > 0)');
   await simMapped(9999, Comparison.GreaterThan, 'demo: proof fails predicate (home-away > 9999)');

   const badIxData = mapValidation(validation, 0, Comparison.GreaterThan, true);
   badIxData.statA.statProof[0] = {
      ...badIxData.statA.statProof[0]!,
      hash: new Uint8Array(32).fill(0xff) as never,
   };
   const badIx = await getValidateStatIx(badIxData, DEVNET);
   const badSim = await simulateTransaction(clients, [badIx], [signer], {
      computeUnitLimit: COMPUTE_UNIT_LIMIT,
   });
   printOutcome('demo: invalid Merkle proof', parseProveStatSimulation(badSim), badSim);
}

main().catch((err) => {
   console.error(err);
   process.exit(1);
});
