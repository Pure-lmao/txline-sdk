/**
 * Shared helpers for the runnable examples.
 *
 * These are Node/Bun-only (filesystem + keypair loading) and are intentionally
 * kept out of the published SDK surface (`solana.ts` stays browser-safe).
 * Configure via `.env` (see `.env.sample`); Bun auto-loads it.
 *
 * Run an example with, e.g.:  `bun run examples/01-signup.ts`
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { KeyPairSigner } from '@solana/kit';
import {
   API_BASE_URL,
   API_ACCEPT_ENCODING,
   TxLineApiClient,
   apiRequestHeaders,
   createTxLineApiClient,
   isHeartbeatFrame,
   parseSseBlock,
   type ApiFixture,
   type Network,
   type QueryParams,
   type RpcClients,
   type SseFrame,
   type StreamSseOptions,
   createClients,
   loadKeypairSignerFromBase58String,
   loadKeypairSignerFromJsonFile,
   networkFromDevnet,
} from '..';

export { isHeartbeatFrame, parseSseBlock, type SseFrame };

/** All examples target devnet. Flip to false to exercise mainnet. */
export const DEVNET = true;

export const NETWORK: Network = networkFromDevnet(DEVNET);

const RESPONSES_DIR = join(import.meta.dir, '..', 'example_responses');

/** Read a required env var or throw a helpful error. */
export function requireEnv(name: string): string {
   const value = process.env[name]?.trim();
   if (!value) {
      throw new Error(`Missing env var ${name} — copy .env.sample to .env and fill it in.`);
   }
   return value;
}

/** Read an optional env var (returns undefined when blank). */
export function optionalEnv(name: string): string | undefined {
   const value = process.env[name]?.trim();
   return value ? value : undefined;
}

/**
 * Load the example wallet, preferring a base58 `SECRET_KEY` and falling back to
 * a Solana CLI keypair file at `KEYPAIR_PATH`.
 */
export async function loadSigner(): Promise<KeyPairSigner> {
   const secret = optionalEnv('SECRET_KEY');
   if (secret) {
      return loadKeypairSignerFromBase58String(secret);
   }
   return loadKeypairSignerFromJsonFile(requireEnv('KEYPAIR_PATH'));
}

/** RPC + WSS clients for the example's {@link NETWORK}. */
export function exampleClients(): RpcClients {
   const clients = createClients(optionalEnv('RPC_URL_devnet'), optionalEnv('RPC_URL_mainnet'));
   return clients[NETWORK];
}

/** Base url for the TxLINE off-chain API on the example's {@link NETWORK}. */
export const API_BASE = API_BASE_URL[NETWORK];

export { API_ACCEPT_ENCODING, apiRequestHeaders };

/**
 * Record an example response to `example_responses/<name>.json` so we can build
 * accurate API types from real payloads.
 */
export async function recordResponse(name: string, data: unknown): Promise<string> {
   await mkdir(RESPONSES_DIR, { recursive: true });
   const file = join(RESPONSES_DIR, `${name}.json`);
   await writeFile(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
   return file;
}

export interface ApiAuth {
   jwt: string;
   apiToken: string;
}

/** Read the JWT + API token for {@link NETWORK} from env (populated by the signup example). */
export function loadAuth(): ApiAuth {
   const jwt = optionalEnv(`JWT_${NETWORK}`);
   const apiToken = optionalEnv(`API_KEY_${NETWORK}`);
   if (!jwt || !apiToken) {
      throw new Error(
         `Missing JWT_${NETWORK} / API_KEY_${NETWORK} in .env — run \`bun run examples/01-signup.ts\` first.`,
      );
   }
   return { jwt, apiToken };
}

/** Authenticated {@link TxLineApiClient} using credentials from `.env`. */
export function exampleApiClient(): TxLineApiClient {
   const { jwt, apiToken } = loadAuth();
   return createTxLineApiClient({ network: NETWORK, jwt, apiKey: apiToken });
}

/** `POST /auth/guest/start` → anonymous guest JWT. */
export async function getGuestToken(): Promise<string> {
   const data = await TxLineApiClient.startGuestSession(NETWORK);
   await recordResponse('auth_guest_start', data);
   return data.token;
}

/** Authenticated GET with optional response recording. */
export async function apiGet<T>(
   path: string,
   opts: { params?: QueryParams; record?: string } = {},
): Promise<T> {
   const data = await exampleApiClient()._get<T>(path, opts.params);
   if (opts.record) {
      await recordResponse(opts.record, data);
   }
   return data;
}

/** Fetch the latest fixtures snapshot and return the first fixture (for drill-down examples). */
export async function getSampleFixture(): Promise<ApiFixture> {
   const fixtures = await exampleApiClient().fixtures.snapshot();
   const first = fixtures[0];
   if (!first) {
      throw new Error('fixtures snapshot returned no fixtures to sample');
   }
   return first;
}

export interface SseOptions extends StreamSseOptions {
   params?: QueryParams;
}

/** Consume an SSE endpoint via {@link TxLineApiClient._stream}. */
export async function streamSse(
   path: string,
   onMessage: (frame: SseFrame) => void,
   opts: SseOptions = {},
): Promise<{ dataEvents: number; heartbeats: number }> {
   return exampleApiClient()._stream(path, onMessage, opts);
}

/** Match fixtures whose participant names contain both sides (order-independent). */
export function findFixturesByMatchups(
   fixtures: readonly ApiFixture[],
   matchups: readonly (readonly [string, string])[],
): ApiFixture[] {
   const found: ApiFixture[] = [];
   for (const [a, b] of matchups) {
      const fixture = fixtures.find((f) => {
         const names = [f.Participant1, f.Participant2];
         return names.some((n) => n.includes(a)) && names.some((n) => n.includes(b));
      });
      if (fixture) {
         found.push(fixture);
      }
   }
   return found;
}
