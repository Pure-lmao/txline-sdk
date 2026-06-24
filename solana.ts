/**
 * Generic Solana helpers built on @solana/kit.
 *
 * These are deliberately program-agnostic: RPC/WSS client creation, PDA + ATA
 * derivation, an idempotent "create ATA" instruction builder, and small
 * simulate / build-sign-send helpers. Program-specific logic lives in `program/`.
 *
 * @see https://www.solanakit.com/docs
 */

import {
   AccountRole,
   addSignersToTransactionMessage,
   appendTransactionMessageInstructions,
   createKeyPairSignerFromBytes,
   createSolanaRpc,
   createSolanaRpcSubscriptions,
   createTransactionMessage,
   getAddressEncoder,
   getBase58Encoder,
   getBase64EncodedWireTransaction,
   getProgramDerivedAddress,
   getSignatureFromTransaction,
   pipe,
   sendAndConfirmTransactionFactory,
   setTransactionMessageFeePayer,
   setTransactionMessageLifetimeUsingBlockhash,
   signTransactionMessageWithSigners,
   type Address,
   type Commitment,
   type Instruction,
   type KeyPairSigner,
   type ReadonlyUint8Array,
   type Rpc,
   type RpcSubscriptions,
   type Signature,
   type SolanaRpcApi,
   type SolanaRpcSubscriptionsApi,
   type TransactionSigner,
} from '@solana/kit';
import {
   getSetComputeUnitLimitInstruction,
   getSetComputeUnitPriceInstruction,
} from '@solana-program/compute-budget';
import { readFile } from 'node:fs/promises';

/** The two clusters this SDK targets. TxLINE differs only by API base URL + a few accounts. */
export type Network = 'devnet' | 'mainnet';

/** Resolve a `devnet` boolean flag to a {@link Network} key. */
export function networkFromDevnet(devnet: boolean): Network {
   return devnet ? 'devnet' : 'mainnet';
}

// --- Well-known program ids (cluster-agnostic) ---

export const SYSTEM_PROGRAM_ID = '11111111111111111111111111111111' as Address;
export const TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' as Address;
export const TOKEN_2022_PROGRAM_ID = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb' as Address;
export const ASSOCIATED_TOKEN_PROGRAM_ID = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL' as Address;

const DEFAULT_DEVNET_RPC_URL = 'https://api.devnet.solana.com';
const DEFAULT_MAINNET_RPC_URL = 'https://api.mainnet-beta.solana.com';

const addressEncoder = getAddressEncoder();
const base58Encoder = getBase58Encoder();

// --- RPC clients ---

/** HTTP + WebSocket clients for a single cluster, plus the resolved urls. */
export interface RpcClients {
   rpc: Rpc<SolanaRpcApi>;
   rpcSubscriptions: RpcSubscriptions<SolanaRpcSubscriptionsApi>;
   httpUrl: string;
   wsUrl: string;
}

function normalizeHttpUrl(raw: string): string {
   if (raw.startsWith('http://') || raw.startsWith('https://')) {
      return raw;
   }
   return `https://${raw}`;
}

/** Derive a websocket url from an http(s) url (or pass through an existing ws(s) url). */
function deriveWsUrl(raw: string): string {
   if (raw.startsWith('ws://') || raw.startsWith('wss://')) {
      return raw;
   }
   if (raw.startsWith('https://')) {
      return `wss://${raw.slice('https://'.length)}`;
   }
   if (raw.startsWith('http://')) {
      return `ws://${raw.slice('http://'.length)}`;
   }
   return `wss://${raw}`;
}

function makeClients(httpUrlRaw: string): RpcClients {
   const httpUrl = normalizeHttpUrl(httpUrlRaw);
   const wsUrl = deriveWsUrl(httpUrl);
   return {
      httpUrl,
      wsUrl,
      rpc: createSolanaRpc(httpUrl),
      rpcSubscriptions: createSolanaRpcSubscriptions(wsUrl),
   };
}

/**
 * Build RPC + WSS clients for both clusters.
 *
 * Pass your own endpoints (recommended for production); any omitted url falls
 * back to the public Solana RPC for that cluster. Websocket urls are derived
 * from the http urls automatically.
 *
 * @example
 * const clients = createClients('https://my-devnet-rpc', 'https://my-mainnet-rpc');
 * await subscribe(clients.devnet, ...);
 */
export function createClients(
   devnetUrl: string = DEFAULT_DEVNET_RPC_URL,
   mainnetUrl: string = DEFAULT_MAINNET_RPC_URL,
): Record<Network, RpcClients> {
   return {
      devnet: makeClients(devnetUrl),
      mainnet: makeClients(mainnetUrl),
   };
}

// --- PDA / ATA derivation ---

/** Generic PDA derivation against any program. */
export async function getPDA(
   programAddress: Address,
   seeds: readonly (string | ReadonlyUint8Array)[],
): Promise<readonly [Address, number]> {
   return getProgramDerivedAddress({ programAddress, seeds: [...seeds] });
}

/**
 * Derive an associated token account address for `owner`/`mint`.
 * Defaults to the SPL Token program; pass {@link TOKEN_2022_PROGRAM_ID} for Token-2022 mints.
 */
export async function getATA(
   owner: Address,
   mint: Address,
   tokenProgram: Address = TOKEN_PROGRAM_ID,
   associatedTokenProgram: Address = ASSOCIATED_TOKEN_PROGRAM_ID,
): Promise<Address> {
   const [ata] = await getProgramDerivedAddress({
      programAddress: associatedTokenProgram,
      seeds: [
         addressEncoder.encode(owner),
         addressEncoder.encode(tokenProgram),
         addressEncoder.encode(mint),
      ],
   });
   return ata;
}

/**
 * Build an idempotent "create associated token account" instruction.
 *
 * The TxLINE program expects the user's token ATA to already exist before
 * subscribing, so callers typically prepend this instruction. Idempotent means
 * it is a no-op if the ATA already exists (wire byte `1`).
 *
 * @param payer   funds account creation and signs
 * @param owner   wallet the ATA belongs to
 * @param mint    token mint
 * @param tokenProgram SPL Token or Token-2022 program for the mint
 */
export async function getCreateAtaIx(
   payer: Address,
   owner: Address,
   mint: Address,
   tokenProgram: Address = TOKEN_PROGRAM_ID,
): Promise<Instruction> {
   const ata = await getATA(owner, mint, tokenProgram);
   return {
      programAddress: ASSOCIATED_TOKEN_PROGRAM_ID,
      data: new Uint8Array([1]),
      accounts: [
         { address: payer, role: AccountRole.WRITABLE_SIGNER },
         { address: ata, role: AccountRole.WRITABLE },
         { address: owner, role: AccountRole.READONLY },
         { address: mint, role: AccountRole.READONLY },
         { address: SYSTEM_PROGRAM_ID, role: AccountRole.READONLY },
         { address: tokenProgram, role: AccountRole.READONLY },
      ],
   };
}

// --- Transactions ---

function resolveFeePayer(
   signers: readonly TransactionSigner[],
   feePayer?: Address | TransactionSigner,
): Address {
   if (feePayer) {
      return typeof feePayer === 'string' ? feePayer : feePayer.address;
   }
   const first = signers[0];
   if (!first) {
      throw new Error('A fee payer or at least one signer is required');
   }
   return first.address;
}

export interface SendOptions {
   /** Optional flat compute-unit limit (`SetComputeUnitLimit`). */
   computeUnitLimit?: number;
   /** Optional priority fee in micro-lamports (`SetComputeUnitPrice`). */
   priorityFeeMicroLamports?: bigint;
   /** Fee payer if not the first signer. */
   feePayer?: Address | TransactionSigner;
   commitment?: Commitment;
}

function withComputeBudget(
   instructions: readonly Instruction[],
   options: Pick<SendOptions, 'computeUnitLimit' | 'priorityFeeMicroLamports'>,
): Instruction[] {
   const budget: Instruction[] = [];
   if (options.computeUnitLimit !== undefined) {
      budget.push(getSetComputeUnitLimitInstruction({ units: options.computeUnitLimit }));
   }
   if (options.priorityFeeMicroLamports !== undefined && options.priorityFeeMicroLamports > 0n) {
      budget.push(
         getSetComputeUnitPriceInstruction({ microLamports: options.priorityFeeMicroLamports }),
      );
   }
   return [...budget, ...instructions];
}

export interface SimulationResult {
   err: unknown | null;
   unitsConsumed: number | null;
   logs: readonly string[] | null;
   /** Set when the simulated transaction completes without `err`. */
   returnData: { programId: Address; data: Uint8Array } | null;
}

/**
 * Simulate a set of instructions without broadcasting.
 *
 * Signs locally (so all required signers must be provided) but requests the RPC
 * to skip signature verification. Returns the program logs + units consumed,
 * which is handy for debugging instruction account/data mistakes.
 */
export async function simulateTransaction(
   clients: RpcClients,
   instructions: readonly Instruction[],
   signers: readonly TransactionSigner[],
   options: SendOptions = {},
): Promise<SimulationResult> {
   const feePayer = resolveFeePayer(signers, options.feePayer);
   const { value: latestBlockhash } = await clients.rpc.getLatestBlockhash().send();
   const message = pipe(
      createTransactionMessage({ version: 0 }),
      (t) => setTransactionMessageFeePayer(feePayer, t),
      (t) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, t),
      (t) => appendTransactionMessageInstructions(withComputeBudget(instructions, options), t),
      (t) => addSignersToTransactionMessage([...signers], t),
   );
   const signed = await signTransactionMessageWithSigners(message);
   const encoded = getBase64EncodedWireTransaction(signed);
   const sim = await clients.rpc
      .simulateTransaction(encoded, { encoding: 'base64', sigVerify: false })
      .send();
   const ret = sim.value.returnData;
   return {
      err: sim.value.err ?? null,
      unitsConsumed: sim.value.unitsConsumed === undefined ? null : Number(sim.value.unitsConsumed),
      logs: sim.value.logs ?? null,
      returnData: ret
         ? { programId: ret.programId as Address, data: new Uint8Array(Buffer.from(ret.data[0], 'base64')) }
         : null,
   };
}

/**
 * Build, sign, send, and confirm a transaction from raw instructions.
 *
 * Returns the transaction signature (Kit confirms via websocket, so the
 * `clients` must include a working `rpcSubscriptions`).
 */
export async function buildSignSendTransaction(
   clients: RpcClients,
   instructions: readonly Instruction[],
   signers: TransactionSigner[],
   options: SendOptions = {},
): Promise<Signature> {
   const feePayer = resolveFeePayer(signers, options.feePayer);
   const { value: latestBlockhash } = await clients.rpc.getLatestBlockhash().send();
   const message = pipe(
      createTransactionMessage({ version: 0 }),
      (t) => setTransactionMessageFeePayer(feePayer, t),
      (t) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, t),
      (t) => appendTransactionMessageInstructions(withComputeBudget(instructions, options), t),
      (t) => addSignersToTransactionMessage([...signers], t),

   );
   const signed = await signTransactionMessageWithSigners(message);
   const sendAndConfirm = sendAndConfirmTransactionFactory({
      rpc: clients.rpc,
      rpcSubscriptions: clients.rpcSubscriptions,
   });
   await sendAndConfirm(signed as Parameters<typeof sendAndConfirm>[0], {
      commitment: options.commitment ?? 'confirmed',
   });
   return getSignatureFromTransaction(signed);
}

function safeJsonReplacer(): (key: string, value: unknown) => unknown {
   const seen = new WeakSet<object>();

   return (_key: string, value: unknown): unknown => {
      if (typeof value === 'bigint') {
         return `${value}n`;
      }
      if (value instanceof Map) {
         return Object.fromEntries(
            [...value.entries()].map(([k, v]) => [
               typeof k === 'bigint' ? `${k}n` : k,
               v,
            ]),
         );
      }
      if (value instanceof Set) {
         return [...value];
      }
      if (typeof value === 'object' && value !== null) {
         if (seen.has(value)) {
            return '[Circular]';
         }
         seen.add(value);
      }
      return value;
   };
}

/**
 * Like `JSON.stringify`, but serializes `bigint`, `Map`, and `Set` instead of throwing.
 * BigInts become `"123n"` strings; maps become plain objects; sets become arrays.
 */
export function safeJSONStringify(value: unknown, space?: string | number): string {
   return JSON.stringify(value, safeJsonReplacer(), space);
}

/** Load a 64-byte secret key JSON array (Solana CLI keypair format). */
export async function loadKeypairSignerFromJsonFile(
   filePath: string,
): Promise<KeyPairSigner> {
   const raw = await readFile(filePath, 'utf8');
   const parsed = JSON.parse(raw) as number[];
   if (!Array.isArray(parsed) || parsed.length !== 64) {
      throw new Error(`Expected 64-byte Solana keypair JSON at ${filePath}`);
   }
   return createKeyPairSignerFromBytes(Uint8Array.from(parsed));
}

/** Load a keypair signer from a base58 string. */
export async function loadKeypairSignerFromBase58String(
   base58String: string,
): Promise<KeyPairSigner> {
   const parsed = base58Encoder.encode(base58String);
   return createKeyPairSignerFromBytes(parsed);
}