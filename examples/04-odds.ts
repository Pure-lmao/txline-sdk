/**
 * Example 4 — Odds API.
 *
 *   - Latest odds snapshot for a fixture
 *   - Currently-live odds (current 5-min interval)
 *   - A specific historical 5-min interval
 *   - Merkle proof for one odds update (`/odds/validation`)
 *
 * Requires JWT_<network> + API_KEY_<network> in .env (run 01-signup first).
 *
 * Run: `bun run examples/04-odds.ts`
 */

import { apiGet, getSampleFixture } from './_shared';
import { epochDayFromTsMs, timeSlotFromTsMs, type ApiOddsPayload } from '..';

async function main(): Promise<void> {
   const fixture = await getSampleFixture();
   const fixtureId = fixture.FixtureId;
   console.log(`fixture ${fixtureId}: ${fixture.Participant1} vs ${fixture.Participant2}`);

   const snapshot = await apiGet<ApiOddsPayload[]>(`/api/odds/snapshot/${fixtureId}`, {
      record: 'odds_snapshot',
   });
   console.log(`[snapshot] ${snapshot.length} odds entries`);

   await apiGet<ApiOddsPayload[]>(`/api/odds/updates/${fixtureId}`, {
      record: 'odds_live_updates',
   });
   console.log('[live] current-interval odds recorded');

   const sample = snapshot[0];
   if (!sample) {
      console.log('no odds entries to drill into');
      return;
   }

   const epochDay = epochDayFromTsMs(sample.Ts);
   const { hourOfDay, minuteOfHour } = timeSlotFromTsMs(sample.Ts);
   const interval = minuteOfHour / 5;
   await apiGet(`/api/odds/updates/${epochDay}/${hourOfDay}/${interval}`, {
      params: { fixtureId },
      record: 'odds_historical_updates',
   });
   console.log(`[historical] day ${epochDay} hour ${hourOfDay} interval ${interval}`);

   await apiGet('/api/odds/validation', {
      params: { messageId: sample.MessageId, ts: sample.Ts },
      record: 'odds_validation',
   });
   console.log('[validation] odds Merkle proof recorded');
}

main().catch((err) => {
   console.error(err);
   process.exit(1);
});
