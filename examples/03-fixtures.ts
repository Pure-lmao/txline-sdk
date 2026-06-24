/**
 * Example 3 — Fixtures API.
 *
 *   - Latest snapshot (all + filtered by competition)
 *   - Hourly updates for a single fixture
 *   - Merkle proof for one fixture update (`/fixtures/validation`)
 *   - Merkle proof for the whole hourly batch (`/fixtures/batch-validation`)
 *
 * Requires JWT_<network> + API_KEY_<network> in .env (run 01-signup first).
 *
 * Run: `bun run examples/03-fixtures.ts`
 */

import { apiGet } from './_shared';
import { epochDayFromTsMs, timeSlotFromTsMs, type ApiFixture } from '..';

async function main(): Promise<void> {
   const fixtures = await apiGet<ApiFixture[]>('/api/fixtures/snapshot', {
      record: 'fixtures_snapshot',
   });
   console.log(`[snapshot] ${fixtures.length} fixtures`);

   const fixture = fixtures[0];
   if (!fixture) {
      console.log('no fixtures available to drill into');
      return;
   }
   console.log(`sample: ${fixture.Participant1} vs ${fixture.Participant2} (id ${fixture.FixtureId})`);

   await apiGet<ApiFixture[]>('/api/fixtures/snapshot', {
      params: { competitionId: fixture.CompetitionId },
      record: 'fixtures_snapshot_by_competition',
   });
   console.log(`[snapshot] filtered by competition ${fixture.CompetitionId}`);

   const epochDay = epochDayFromTsMs(fixture.Ts);
   const { hourOfDay } = timeSlotFromTsMs(fixture.Ts);
   await apiGet(`/api/fixtures/updates/${epochDay}/${hourOfDay}`, {
      params: { fixtureId: fixture.FixtureId },
      record: 'fixtures_updates',
   });
   console.log(`[updates] day ${epochDay} hour ${hourOfDay}`);

   await apiGet('/api/fixtures/validation', {
      params: { fixtureId: fixture.FixtureId, timestamp: fixture.Ts },
      record: 'fixtures_validation',
   });
   console.log('[validation] single-update Merkle proof recorded');

   await apiGet('/api/fixtures/batch-validation', {
      params: { epochDay, hourOfDay },
      record: 'fixtures_batch_validation',
   });
   console.log('[batch-validation] hourly-batch Merkle proof recorded');
}

main().catch((err) => {
   console.error(err);
   process.exit(1);
});
