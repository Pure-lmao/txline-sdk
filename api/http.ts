import { API_BASE_URL } from '../program/constants';
import type { Network } from '../solana';

/** Bun cannot decode zstd — request encodings it supports so the server falls back to gzip/br. */
export const API_ACCEPT_ENCODING = 'gzip, deflate, br';

export type QueryParams = Record<string, string | number | boolean | undefined>;

export function resolveApiBaseUrl(network: Network, override?: string): string {
   return override ?? API_BASE_URL[network];
}

export function apiRequestHeaders(extra: Record<string, string> = {}): Record<string, string> {
   return { 'Accept-Encoding': API_ACCEPT_ENCODING, ...extra };
}

export function buildApiUrl(baseUrl: string, path: string, params?: QueryParams): URL {
   const url = new URL(path, baseUrl);
   if (params) {
      for (const [key, value] of Object.entries(params)) {
         if (value !== undefined) {
            url.searchParams.set(key, String(value));
         }
      }
   }
   return url;
}

export class TxLineApiError extends Error {
   constructor(
      readonly status: number,
      readonly path: string,
      readonly body: string,
   ) {
      super(`TxLINE API ${path} ${status}: ${body}`);
      this.name = 'TxLineApiError';
   }
}

export interface ApiFetchContext {
   baseUrl: string;
   fetch: typeof fetch;
}

async function readErrorBody(res: Response): Promise<string> {
   try {
      return await res.text();
   } catch {
      return '';
   }
}

export async function apiJsonGet<T>(
   ctx: ApiFetchContext,
   path: string,
   headers: Record<string, string>,
   params?: QueryParams,
): Promise<T> {
   const res = await ctx.fetch(buildApiUrl(ctx.baseUrl, path, params), { headers });
   if (!res.ok) {
      throw new TxLineApiError(res.status, path, await readErrorBody(res));
   }
   return (await res.json()) as T;
}

export async function apiJsonPost<T>(
   ctx: ApiFetchContext,
   path: string,
   headers: Record<string, string>,
   body: unknown,
): Promise<T> {
   const res = await ctx.fetch(buildApiUrl(ctx.baseUrl, path), {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
   });
   if (!res.ok) {
      throw new TxLineApiError(res.status, path, await readErrorBody(res));
   }
   return (await res.json()) as T;
}

export async function apiTextPost(
   ctx: ApiFetchContext,
   path: string,
   headers: Record<string, string>,
   body: unknown,
): Promise<string> {
   const res = await ctx.fetch(buildApiUrl(ctx.baseUrl, path), {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
   });
   if (!res.ok) {
      throw new TxLineApiError(res.status, path, await readErrorBody(res));
   }
   return (await res.text()).trim();
}
