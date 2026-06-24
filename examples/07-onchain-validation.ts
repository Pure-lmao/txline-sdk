/**
 * Example 7 — On-chain stat validation.
 *
 * Fetches a three-stage Merkle proof from `/api/scores/stat-validation`, maps it
 * into the program's `validateStat` instruction, and simulates it (set
 * `SEND=true` to broadcast). This is how a consumer proves a score statistic
 * (or a derived `statA - statB`) against the on-chain daily-scores root.
 *
 * For a Rust on-chain CPI sketch see `examples/rust/validate_stat_cpi.rs`.
 *
 * Tunable via env: VALIDATION_SEQ, VALIDATION_STAT_KEY, VALIDATION_STAT_KEY2,
 * VALIDATION_THRESHOLD. Requires JWT_<network> + API_KEY_<network> + a wallet.
 *
 * Run: `bun run examples/07-onchain-validation.ts`
 *      `SEND=true bun run examples/07-onchain-validation.ts`
 */

import {
   BinaryExpression,
   Comparison,
   getValidateStatIx,
   hash32FromBytes,
   proofNodeFromApi,
   simulateTransaction,
   buildSignSendTransaction,
   type ApiProofNode,
   type ApiScoresStatValidation,
   type ProofNode,
   type ValidateStatIxData,
} from '..';
import {
   DEVNET,
   apiGet,
   exampleClients,
   getSampleFixture,
   loadSigner,
} from './_shared';

const SEQ = Number(process.env.VALIDATION_SEQ ?? 1);
const STAT_KEY = Number(process.env.VALIDATION_STAT_KEY ?? 1);
const STAT_KEY2 = process.env.VALIDATION_STAT_KEY2
   ? Number(process.env.VALIDATION_STAT_KEY2)
   : undefined;
const THRESHOLD = Number(process.env.VALIDATION_THRESHOLD ?? 0);
const SEND = process.env.SEND === 'true';
const COMPUTE_UNIT_LIMIT = 600_000;

function toProof(nodes: ApiProofNode[]): ProofNode[] {
   return nodes.map((n) => proofNodeFromApi(n));
}

function mapValidation(v: ApiScoresStatValidation): ValidateStatIxData {
   const hasSecondStat = STAT_KEY2 !== undefined && v.statToProve2 !== undefined;
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
      predicate: { threshold: THRESHOLD, comparison: Comparison.GreaterThan },
      statA: {
         statToProve: v.statToProve,
         eventStatRoot: hash32FromBytes(v.eventStatRoot),
         statProof: toProof(v.statProof),
      },
      // Both stats live under the same event, so they share `eventStatRoot`.
      statB: hasSecondStat && v.statToProve2
         ? {
              statToProve: v.statToProve2,
              eventStatRoot: hash32FromBytes(v.eventStatRoot),
              statProof: toProof(v.statProof2 ?? []),
           }
         : null,
      op: hasSecondStat ? BinaryExpression.Subtract : null,
   };
}

async function main(): Promise<void> {
   const fixture = await getSampleFixture();
   console.log(`fixture ${fixture.FixtureId}: ${fixture.Participant1} vs ${fixture.Participant2}`);

   const validation = await apiGet<ApiScoresStatValidation>('/api/scores/stat-validation', {
      params: { fixtureId: fixture.FixtureId, seq: SEQ, statKey: STAT_KEY, statKey2: STAT_KEY2 },
      record: 'scores_stat_validation',
   });
   console.log(`stat to prove: key=${validation.statToProve.key} value=${validation.statToProve.value}`);

   const data = mapValidation(validation);
   const ix = await getValidateStatIx(data, DEVNET);
   const signer = await loadSigner();
   const clients = exampleClients();

   if (SEND) {
      const sig = await buildSignSendTransaction(clients, [ix], [signer], {
         computeUnitLimit: COMPUTE_UNIT_LIMIT,
      });
      console.log('validateStat confirmed:', sig);
      return;
   }

   const sim = await simulateTransaction(clients, [ix], [signer], {
      computeUnitLimit: COMPUTE_UNIT_LIMIT,
   });
   console.log('simulation error:', sim.err);
   console.log('compute units:', sim.unitsConsumed);
   if (sim.logs) {
      console.log(sim.logs.join('\n'));
   }
}

main().catch((err) => {
   console.error(err);
   process.exit(1);
});
