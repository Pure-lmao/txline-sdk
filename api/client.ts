import { networkFromDevnet, type Network } from '../solana';
import {
   apiJsonGet,
   apiJsonPost,
   apiRequestHeaders,
   apiTextPost,
   resolveApiBaseUrl,
   type ApiFetchContext,
   type QueryParams,
} from './http';
import { isHeartbeatFrame, streamSse, type SseFrame, type StreamSseOptions } from './sse';
import type {
   ApiActivationPayload,
   ApiFixture,
   ApiFixturesBatchValidation,
   ApiFixturesValidation,
   ApiGuestSessionResponse,
   ApiOddsPayload,
   ApiOddsValidation,
   ApiPurchaseQuoteRequest,
   ApiPurchaseQuoteResponse,
   ApiScoreEvent,
   ApiScoresStatValidation,
} from './types';

export interface TxLineApiClientOptions {
   /** Cluster selector — pass `true` for devnet, `false` for mainnet, or a {@link Network} literal. */
   network: Network | boolean;
   /** Guest JWT from {@link TxLineApiClient.startGuestSession}. */
   jwt: string;
   /** Long-lived API token from token activation. */
   apiKey: string;
   /** Override the default cluster API base URL. */
   baseUrl?: string;
   /** Custom fetch (defaults to global `fetch`). */
   fetch?: typeof fetch;
}

export interface FixturesSnapshotParams {
   startEpochDay?: number;
   competitionId?: number;
}

export interface FixturesUpdatesParams {
   epochDay: number;
   hourOfDay: number;
   fixtureId?: number;
}

export interface FixturesValidationParams {
   fixtureId: number;
   timestamp: number;
}

export interface FixturesBatchValidationParams {
   epochDay: number;
   hourOfDay: number;
}

export interface OddsSnapshotParams {
   fixtureId: number;
   asOf?: number;
}

export interface OddsIntervalParams {
   epochDay: number;
   hourOfDay: number;
   interval: number;
   fixtureId?: number;
}

export interface OddsValidationParams {
   messageId: string;
   ts: number;
}

export interface ScoresIntervalParams {
   epochDay: number;
   hourOfDay: number;
   interval: number;
   fixtureId?: number;
}

export interface ScoresStatValidationParams {
   fixtureId: number;
   seq: number;
   statKey: number;
   statKey2?: number;
}

export interface StreamParams extends Omit<StreamSseOptions, 'params'> {
   fixtureId?: number;
}

type StreamMessageHandler<T> = (payload: T, frame: SseFrame) => void;

/**
 * Typed client for the TxLINE REST + SSE API.
 *
 * ```typescript
 * const api = new TxLineApiClient({
 *    network: true,
 *    jwt: process.env.JWT_devnet!,
 *    apiKey: process.env.API_KEY_devnet!,
 * });
 *
 * const fixtures = await api.fixtures.snapshot();
 * const proof = await api.scores.statValidation({ fixtureId: 17588223, seq: 1024, statKey: 1, statKey2: 2 });
 * ```
 */
export class TxLineApiClient {
   readonly network: Network;
   readonly baseUrl: string;
   readonly jwt: string;
   readonly apiKey: string;

   readonly fixtures: FixturesApi;
   readonly odds: OddsApi;
   readonly scores: ScoresApi;

   private readonly ctx: ApiFetchContext;

   constructor(options: TxLineApiClientOptions) {
      this.network = typeof options.network === 'boolean'
         ? networkFromDevnet(options.network)
         : options.network;
      this.baseUrl = resolveApiBaseUrl(this.network, options.baseUrl);
      this.jwt = options.jwt;
      this.apiKey = options.apiKey;
      this.ctx = { baseUrl: this.baseUrl, fetch: options.fetch ?? fetch };
      this.fixtures = new FixturesApi(this);
      this.odds = new OddsApi(this);
      this.scores = new ScoresApi(this);
   }

   private authHeaders(extra: Record<string, string> = {}): Record<string, string> {
      return apiRequestHeaders({
         Authorization: `Bearer ${this.jwt}`,
         'X-Api-Token': this.apiKey,
         ...extra,
      });
   }

   private guestHeaders(extra: Record<string, string> = {}): Record<string, string> {
      return apiRequestHeaders({
         Authorization: `Bearer ${this.jwt}`,
         ...extra,
      });
   }

   /** `POST /auth/guest/start` — no credentials required. */
   static async startGuestSession(
      network: Network | boolean,
      fetchImpl: typeof fetch = fetch,
   ): Promise<ApiGuestSessionResponse> {
      const net = typeof network === 'boolean' ? networkFromDevnet(network) : network;
      const ctx: ApiFetchContext = { baseUrl: resolveApiBaseUrl(net), fetch: fetchImpl };
      return apiJsonPost<ApiGuestSessionResponse>(
         ctx,
         '/auth/guest/start',
         apiRequestHeaders({ 'Content-Type': 'application/json' }),
         {},
      );
   }

   /**
    * `POST /api/token/activate` — exchange subscribe tx + wallet signature for an API key.
    * Requires a guest JWT; returns the API token as plain text.
    */
   static async activateToken(
      network: Network | boolean,
      jwt: string,
      payload: ApiActivationPayload,
      fetchImpl: typeof fetch = fetch,
   ): Promise<string> {
      const net = typeof network === 'boolean' ? networkFromDevnet(network) : network;
      const ctx: ApiFetchContext = { baseUrl: resolveApiBaseUrl(net), fetch: fetchImpl };
      return apiTextPost(
         ctx,
         '/api/token/activate',
         apiRequestHeaders({
            'Content-Type': 'application/json',
            Authorization: `Bearer ${jwt}`,
         }),
         payload,
      );
   }

   /** `POST /api/guest/purchase/quote` — partially signed USDT → TxL purchase tx. */
   async purchaseQuote(request: ApiPurchaseQuoteRequest): Promise<ApiPurchaseQuoteResponse> {
      return apiJsonPost<ApiPurchaseQuoteResponse>(
         this.ctx,
         '/api/guest/purchase/quote',
         this.guestHeaders({ 'Content-Type': 'application/json' }),
         request,
      );
   }

   /** Internal GET helper for resource classes. */
   _get<T>(path: string, params?: QueryParams): Promise<T> {
      return apiJsonGet<T>(this.ctx, path, this.authHeaders(), params);
   }

   /** Internal SSE helper for resource classes. */
   _stream(
      path: string,
      onMessage: (frame: SseFrame) => void,
      opts: StreamSseOptions = {},
   ): Promise<{ dataEvents: number; heartbeats: number }> {
      return streamSse(this.ctx, path, this.authHeaders(), onMessage, opts);
   }
}

class FixturesApi {
   constructor(private readonly client: TxLineApiClient) {}

   /** `GET /api/fixtures/snapshot` */
   snapshot(params: FixturesSnapshotParams = {}): Promise<ApiFixture[]> {
      return this.client._get('/api/fixtures/snapshot', { ...params });
   }

   /** `GET /api/fixtures/updates/{epochDay}/{hourOfDay}` */
   updates(params: FixturesUpdatesParams): Promise<ApiFixture[]> {
      const { epochDay, hourOfDay, fixtureId } = params;
      return this.client._get(`/api/fixtures/updates/${epochDay}/${hourOfDay}`, { fixtureId });
   }

   /** `GET /api/fixtures/validation` */
   validation(params: FixturesValidationParams): Promise<ApiFixturesValidation> {
      return this.client._get('/api/fixtures/validation', { ...params });
   }

   /** `GET /api/fixtures/batch-validation` */
   batchValidation(params: FixturesBatchValidationParams): Promise<ApiFixturesBatchValidation> {
      return this.client._get('/api/fixtures/batch-validation', { ...params });
   }
}

class OddsApi {
   constructor(private readonly client: TxLineApiClient) {}

   /** `GET /api/odds/snapshot/{fixtureId}` */
   snapshot(params: OddsSnapshotParams): Promise<ApiOddsPayload[]> {
      const { fixtureId, asOf } = params;
      return this.client._get(`/api/odds/snapshot/${fixtureId}`, { asOf });
   }

   /** `GET /api/odds/updates/{fixtureId}` — current 5-minute interval. */
   liveUpdates(fixtureId: number): Promise<ApiOddsPayload[]> {
      return this.client._get(`/api/odds/updates/${fixtureId}`);
   }

   /** `GET /api/odds/updates/{epochDay}/{hourOfDay}/{interval}` */
   historicalUpdates(params: OddsIntervalParams): Promise<ApiOddsPayload[]> {
      const { epochDay, hourOfDay, interval, fixtureId } = params;
      return this.client._get(`/api/odds/updates/${epochDay}/${hourOfDay}/${interval}`, { fixtureId });
   }

   /** `GET /api/odds/validation` */
   validation(params: OddsValidationParams): Promise<ApiOddsValidation> {
      return this.client._get('/api/odds/validation', { ...params });
   }

   /** `GET /api/odds/stream` — Server-Sent Events. */
   stream(
      onMessage: StreamMessageHandler<ApiOddsPayload>,
      opts: StreamParams = {},
   ): Promise<{ dataEvents: number; heartbeats: number }> {
      const { fixtureId, ...sseOpts } = opts;
      return this.client._stream(
         '/api/odds/stream',
         (frame) => {
            if (!isHeartbeatFrame(frame)) {
               onMessage(frame.data as ApiOddsPayload, frame);
            }
         },
         { ...sseOpts, params: fixtureId !== undefined ? { fixtureId } : undefined },
      );
   }
}

class ScoresApi {
   constructor(private readonly client: TxLineApiClient) {}

   /** `GET /api/scores/snapshot/{fixtureId}` */
   snapshot(fixtureId: number): Promise<ApiScoreEvent[]> {
      return this.client._get(`/api/scores/snapshot/${fixtureId}`);
   }

   /** `GET /api/scores/updates/{fixtureId}` — current 5-minute interval. */
   currentInterval(fixtureId: number): Promise<ApiScoreEvent[]> {
      return this.client._get(`/api/scores/updates/${fixtureId}`);
   }

   /** `GET /api/scores/historical/{fixtureId}` — full sequence. */
   historical(fixtureId: number): Promise<ApiScoreEvent[]> {
      return this.client._get(`/api/scores/historical/${fixtureId}`);
   }

   /** `GET /api/scores/updates/{epochDay}/{hourOfDay}/{interval}` */
   historicalInterval(params: ScoresIntervalParams): Promise<ApiScoreEvent[]> {
      const { epochDay, hourOfDay, interval, fixtureId } = params;
      return this.client._get(`/api/scores/updates/${epochDay}/${hourOfDay}/${interval}`, { fixtureId });
   }

   /** `GET /api/scores/stat-validation` — Merkle proof for on-chain `validate_stat`. */
   statValidation(params: ScoresStatValidationParams): Promise<ApiScoresStatValidation> {
      return this.client._get('/api/scores/stat-validation', { ...params });
   }

   /** `GET /api/scores/stream` — Server-Sent Events. */
   stream(
      onMessage: StreamMessageHandler<ApiScoreEvent>,
      opts: StreamParams = {},
   ): Promise<{ dataEvents: number; heartbeats: number }> {
      const { fixtureId, ...sseOpts } = opts;
      return this.client._stream(
         '/api/scores/stream',
         (frame) => {
            if (!isHeartbeatFrame(frame)) {
               onMessage(frame.data as ApiScoreEvent, frame);
            }
         },
         { ...sseOpts, params: fixtureId !== undefined ? { fixtureId } : undefined },
      );
   }
}

/** Convenience factory — identical to `new TxLineApiClient(options)`. */
export function createTxLineApiClient(options: TxLineApiClientOptions): TxLineApiClient {
   return new TxLineApiClient(options);
}
