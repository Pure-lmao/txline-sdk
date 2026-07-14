/**
 * Example 6 — Real-time SSE streams.
 *
 * Odds updates arrive on `/api/odds/stream` as standard SSE with `data:` +
 * `id:` lines (no `event:` field on payloads). Heartbeats use `event: heartbeat`.
 *
 * By default this example:
 *   1. Resolves today's target matchups from the fixtures snapshot.
 *   2. Listens on the **unfiltered** odds stream and prints every data frame.
 *   3. Re-tests each target fixture with `?fixtureId=` to show server-side
 *      filter behaviour (some fixtures receive updates, others do not).
 *
 * Requires JWT_<network> + API_KEY_<network> in .env (run 01-signup first).
 *
 * Run: `bun run examples/06-streaming.ts`
 *      `STREAM_MAX_MS=60000 bun run examples/06-streaming.ts`
 */

import type { ApiFixture, ApiOddsPayload } from '..';
import {
   apiGet,
   findFixturesByMatchups,
   isHeartbeatFrame,
   streamSse,
   type SseFrame,
} from './_shared';

/** Today's upcoming games (override via FIXTURE_ID=123,456 for a custom list). */
const TODAYS_MATCHUPS: readonly (readonly [string, string])[] = [
   ['Argentina', 'Austria'],
   ['France', 'Iraq'],
   ['Norway', 'Senegal'],
   ['Jordan', 'Algeria'],
];

const MAX_MS = Number(process.env.STREAM_MAX_MS ?? 30_000);
const FILTER_PROBE_MS = Number(process.env.STREAM_FILTER_PROBE_MS ?? 15_000);
const LOG_HEARTBEATS = process.env.LOG_HEARTBEATS === 'true';

function fixtureLabel(f: ApiFixture): string {
   return `${f.Participant1} vs ${f.Participant2} (${f.FixtureId})`;
}

function oddsPayload(frame: SseFrame): ApiOddsPayload | null {
   if (typeof frame.data !== 'object' || frame.data === null) {
      return null;
   }
   return frame.data as ApiOddsPayload;
}

function printOddsFrame(frame: SseFrame): void {
   const odds = oddsPayload(frame);
   if (!odds) {
      console.log('odds frame:', frame);
      return;
   }
   const idPart = frame.id ? ` id=${frame.id}` : '';
   console.log(
      `odds${idPart} fixture=${odds.FixtureId} ${odds.SuperOddsType} ` +
         `${odds.MarketPeriod ?? '-'} ${odds.MarketParameters ?? '-'}`,
   );
}

async function streamUnfiltered(): Promise<void> {
   console.log(`\n[odds stream — unfiltered] listening for ${MAX_MS} ms…`);
   const byFixture = new Map<number, number>();
   let printed = 0;

   const { dataEvents, heartbeats } = await streamSse(
      '/api/odds/stream',
      (frame) => {
         const odds = oddsPayload(frame);
         if (odds) {
            byFixture.set(odds.FixtureId, (byFixture.get(odds.FixtureId) ?? 0) + 1);
         }
         printOddsFrame(frame);
         printed += 1;
      },
      {
         maxMs: MAX_MS,
         onFrame: LOG_HEARTBEATS
            ? (frame) => {
                 if (isHeartbeatFrame(frame)) {
                    console.log('heartbeat:', frame.data);
                 }
              }
            : undefined,
      },
   );

   console.log(`\n[odds stream — unfiltered] ${dataEvents} data frame(s), ${heartbeats} heartbeat(s)`);
   if (byFixture.size > 0) {
      console.log('updates by FixtureId:');
      for (const [id, n] of [...byFixture.entries()].sort((a, b) => b[1] - a[1])) {
         console.log(`  ${id}: ${n}`);
      }
   } else if (printed === 0) {
      console.log('(no data frames — check API connectivity or wait for market activity)');
   }
}

async function probeFixtureFilter(fixtures: readonly ApiFixture[]): Promise<void> {
   console.log(`\n[odds stream — fixtureId filter probe] ${FILTER_PROBE_MS} ms each:`);
   for (const fixture of fixtures) {
      const { dataEvents, heartbeats } = await streamSse('/api/odds/stream', () => {}, {
         params: { fixtureId: fixture.FixtureId },
         maxMs: FILTER_PROBE_MS,
      });
      const note = dataEvents === 0 ? ' ← no updates (server filter or no market activity)' : '';
      console.log(`  ${fixtureLabel(fixture)}: ${dataEvents} data, ${heartbeats} hb${note}`);
   }
}

async function main(): Promise<void> {
   const fixtures = await apiGet<ApiFixture[]>('/api/fixtures/snapshot');

   const customIds = process.env.FIXTURE_ID?.split(',').map((s) => Number(s.trim())).filter(Boolean);
   const targets = customIds?.length
      ? fixtures.filter((f) => customIds.includes(f.FixtureId))
      : findFixturesByMatchups(fixtures, TODAYS_MATCHUPS);

   console.log('target fixtures:');
   if (targets.length === 0) {
      console.log('  (none matched — streaming unfiltered only)');
   } else {
      for (const f of targets) {
         console.log(`  ${fixtureLabel(f)} kickoff ${new Date(f.StartTime).toISOString()}`);
      }
   }

   await streamUnfiltered();

   if (targets.length > 0) {
      await probeFixtureFilter(targets);
   }
}

main().catch((err) => {
   console.error(err);
   process.exit(1);
});
