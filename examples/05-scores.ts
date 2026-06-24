/**
 * Example 5 — Scores API.
 *
 *   - Latest scores snapshot for a fixture
 *   - Current 5-min interval of score updates
 *   - Full historical sequence for the fixture (`/scores/historical/{id}`)
 *   - A specific historical 5-min interval
 *
 * Requires JWT_<network> + API_KEY_<network> in .env (run 01-signup first).
 *
 * Run: `bun run examples/05-scores.ts`
 */

import { apiGet, getSampleFixture } from './_shared';
import { epochDayFromTsMs, timeSlotFromTsMs, type ApiScoreEvent } from '..';

async function main(): Promise<void> {
   const fixture = await getSampleFixture();
   const fixtureId = fixture.FixtureId;
   console.log(`fixture ${fixtureId}: ${fixture.Participant1} vs ${fixture.Participant2}`);

   const snapshot = await apiGet<ApiScoreEvent[]>(`/api/scores/snapshot/${fixtureId}`, {
      record: 'scores_snapshot',
   });
   console.log(`[snapshot] ${snapshot.length} score actions`);

   await apiGet<ApiScoreEvent[]>(`/api/scores/updates/${fixtureId}`, {
      record: 'scores_current_interval',
   });
   console.log('[current] current-interval score updates recorded');

   await apiGet<ApiScoreEvent[]>(`/api/scores/historical/${fixtureId}`, {
      record: 'scores_full_sequence',
   });
   console.log('[full] full score sequence recorded');

   const sample = snapshot[0];
   if (!sample) {
      console.log('no score updates to drill into');
      return;
   }

   const epochDay = epochDayFromTsMs(sample.Ts);
   const { hourOfDay, minuteOfHour } = timeSlotFromTsMs(sample.Ts);
   const interval = minuteOfHour / 5;
   await apiGet(`/api/scores/updates/${epochDay}/${hourOfDay}/${interval}`, {
      params: { fixtureId },
      record: 'scores_historical_updates',
   });
   console.log(`[historical] day ${epochDay} hour ${hourOfDay} interval ${interval}`);
}

main().catch((err) => {
   console.error(err);
   process.exit(1);
});
