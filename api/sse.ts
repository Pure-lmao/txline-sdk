import { apiRequestHeaders, buildApiUrl, TxLineApiError, type ApiFetchContext, type QueryParams } from './http';

/** One SSE frame as emitted by TxLINE. */
export interface SseFrame {
   /** Present on odds/scores payloads (`id: <ts>:<seq>`). */
   id?: string;
   /** Empty string for data payloads; `heartbeat` for keep-alives. */
   event: string;
   data: unknown;
}

export interface StreamSseOptions {
   params?: QueryParams;
   /** Stop after this many non-heartbeat frames. */
   maxMessages?: number;
   /** Stop after this many milliseconds. */
   maxMs?: number;
   /** External abort (e.g. user cancellation). */
   signal?: AbortSignal;
   /** Called for every parsed frame (including heartbeats). */
   onFrame?: (frame: SseFrame) => void;
}

function normalizeSseEventName(raw: string): string {
   const trimmed = raw.trimStart();
   if (trimmed === '""' || trimmed === "''") {
      return '';
   }
   return trimmed;
}

function isHeartbeatPayload(data: unknown): boolean {
   if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      return false;
   }
   const record = data as Record<string, unknown>;
   const keys = Object.keys(record);
   return keys.length === 1 && keys[0] === 'Ts' && typeof record.Ts === 'number';
}

/** Detect keep-alives by event name or by payload shape. */
export function isHeartbeatFrame(frame: SseFrame): boolean {
   return frame.event === 'heartbeat' || isHeartbeatPayload(frame.data);
}

function parseSseDataPayload(event: string, payload: string): unknown {
   const trimmed = payload.trim();
   if (!trimmed) {
      return null;
   }
   try {
      return JSON.parse(trimmed) as unknown;
   } catch {
      if (event === 'heartbeat' && !trimmed.endsWith('}')) {
         try {
            return JSON.parse(`${trimmed}}`) as unknown;
         } catch {
            /* fall through */
         }
      }
      return trimmed;
   }
}

/** Parse one SSE block (lines between blank-line delimiters). */
export function parseSseBlock(block: string): SseFrame | null {
   const trimmed = block.trim();
   if (!trimmed) {
      return null;
   }

   let id: string | undefined;
   let event = '';
   const dataLines: string[] = [];
   for (const line of trimmed.split('\n')) {
      if (line.startsWith(':') || line.startsWith('retry:')) {
         continue;
      }
      if (line.startsWith('data:')) {
         dataLines.push(line.slice(5).trimStart());
      } else if (line.startsWith('Message: ')) {
         dataLines.push(line.slice('Message: '.length));
      } else if (line.startsWith('event:')) {
         event = normalizeSseEventName(line.slice(6));
      } else if (line.startsWith('id:')) {
         id = line.slice(3).trimStart();
      }
   }
   if (dataLines.length === 0) {
      return null;
   }

   const payload = dataLines.join('\n');
   const data = parseSseDataPayload(event, payload);
   const resolvedEvent = event || (isHeartbeatPayload(data) ? 'heartbeat' : '');
   return id !== undefined ? { id, event: resolvedEvent, data } : { event: resolvedEvent, data };
}

/** Consume an authenticated SSE endpoint. */
export async function streamSse(
   ctx: ApiFetchContext,
   path: string,
   authHeaders: Record<string, string>,
   onMessage: (frame: SseFrame) => void,
   opts: StreamSseOptions = {},
): Promise<{ dataEvents: number; heartbeats: number }> {
   const controller = new AbortController();
   const timer = opts.maxMs ? setTimeout(() => controller.abort(), opts.maxMs) : undefined;
   if (opts.signal) {
      opts.signal.addEventListener('abort', () => controller.abort(), { once: true });
   }

   let dataEvents = 0;
   let heartbeats = 0;
   const emit = (frame: SseFrame): void => {
      opts.onFrame?.(frame);
      if (isHeartbeatFrame(frame)) {
         heartbeats += 1;
         return;
      }
      onMessage(frame);
      dataEvents += 1;
   };

   try {
      const res = await ctx.fetch(buildApiUrl(ctx.baseUrl, path, opts.params), {
         headers: apiRequestHeaders({
            ...authHeaders,
            Accept: 'text/event-stream',
            'Cache-Control': 'no-cache',
         }),
         signal: controller.signal,
      });
      if (!res.ok || !res.body) {
         throw new TxLineApiError(res.status, path, await res.text().catch(() => ''));
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
         const { value, done } = await reader.read();
         if (done) break;
         buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
         let sep = buffer.indexOf('\n\n');
         while (sep !== -1) {
            const block = buffer.slice(0, sep);
            buffer = buffer.slice(sep + 2);
            const frame = parseSseBlock(block);
            if (frame) {
               emit(frame);
               if (opts.maxMessages && dataEvents >= opts.maxMessages) {
                  controller.abort();
                  return { dataEvents, heartbeats };
               }
            }
            sep = buffer.indexOf('\n\n');
         }
      }
      const trailing = parseSseBlock(buffer);
      if (trailing) {
         emit(trailing);
      }
   } catch (err) {
      if (!(err instanceof Error && err.name === 'AbortError')) throw err;
   } finally {
      clearTimeout(timer);
   }
   return { dataEvents, heartbeats };
}
