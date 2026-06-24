/**
 * Example 1 — Sign-up flow (devnet).
 *
 *   1. Get an anonymous guest JWT.
 *   2. Build a `subscribe` transaction, prepending a create-ATA instruction
 *      only if the wallet's TxL associated token account doesn't exist yet.
 *   3. Send + confirm the transaction on-chain.
 *   4. Sign the activation message and exchange it for a long-lived API token.
 *
 * Responses are recorded under `example_responses/` for reference.
 *
 * Run: `bun run examples/01-signup.ts`
 */

import { createSignableMessage, type Instruction } from '@solana/kit';
import {
   buildSignSendTransaction,
   getATA,
   getCreateAtaIx,
   getSubscribeIx,
   TOKEN_2022_PROGRAM_ID,
   TOKEN_MINT,
} from '..';
import { API_BASE, DEVNET, NETWORK, apiRequestHeaders, exampleClients, getGuestToken, loadSigner, optionalEnv, recordResponse } from './_shared';

// --- Subscription parameters (tweak as needed) ---
const SERVICE_LEVEL_ID = 1;
/** Duration in weeks — must be a multiple of 4. */
const DURATION_WEEKS = 4;
/** League ids for a custom selection; empty = standard/legacy bundle. */
const SELECTED_LEAGUES: number[] = [];

async function getGuestJwt(): Promise<string> {
   return getGuestToken();
}

async function activate(txSig: string, walletSignature: string, jwt: string): Promise<string> {
   const res = await fetch(`${API_BASE}/api/token/activate`, {
      method: 'POST',
      headers: apiRequestHeaders({
         'Content-Type': 'application/json',
         Authorization: `Bearer ${jwt}`,
      }),
      body: JSON.stringify({ txSig, walletSignature, leagues: SELECTED_LEAGUES }),
   });
   if (!res.ok) {
      throw new Error(`activate ${res.status}: ${await res.text()}`);
   }
   // The activation endpoint returns the API token as plain text.
   const apiToken = (await res.text()).trim();
   await recordResponse('token_activate', { apiToken });
   return apiToken;
}

async function main(): Promise<void> {
   const signer = await loadSigner();
   const clients = exampleClients();
   console.log(`network: ${NETWORK}`);
   console.log(`wallet:  ${signer.address}`);

   // 1. Guest JWT
   const jwt = optionalEnv(`JWT_${NETWORK}`) ?? await getGuestJwt();
   console.log(`\n[1] guest JWT acquired: ${jwt}`);

   // 2. Build subscribe tx, creating the TxL ATA only if it's missing.
   const userAta = await getATA(signer.address, TOKEN_MINT[NETWORK], TOKEN_2022_PROGRAM_ID);
   const { value: ataAccount } = await clients.rpc.getAccountInfo(userAta, { encoding: 'base64' }).send();
   const ataExists = ataAccount !== null;
   console.log(`\n[2] TxL ATA ${userAta} ${ataExists ? 'exists' : 'missing — will create'}`);

   const instructions: Instruction[] = [];
   if (!ataExists) {
      instructions.push(await getCreateAtaIx(signer.address, signer.address, TOKEN_MINT[NETWORK], TOKEN_2022_PROGRAM_ID));
   }
   instructions.push(await getSubscribeIx(signer.address, SERVICE_LEVEL_ID, DURATION_WEEKS, DEVNET));

   // 3. Send + confirm
   const txSig = optionalEnv(`TX_SIG_${NETWORK}`) ?? await buildSignSendTransaction(clients, instructions, [signer]);
   console.log(`\n[3] subscribe tx confirmed: ${txSig}`);
   await recordResponse('subscribe_tx', { txSig, serviceLevelId: SERVICE_LEVEL_ID, weeks: DURATION_WEEKS, leagues: SELECTED_LEAGUES, createdAta: !ataExists });

   // 4. Sign activation message ("<txSig>:<leaguesCsv>:<jwt>") and activate.
   const messageString = `${txSig}:${SELECTED_LEAGUES.join(',')}:${jwt}`;
   const [signatureDict] = await signer.signMessages([createSignableMessage(messageString)]);
   const signatureBytes = signatureDict?.[signer.address];
   if (!signatureBytes) {
      throw new Error('wallet did not return a signature for the activation message');
   }
   const walletSignature = Buffer.from(signatureBytes).toString('base64');
   const apiToken = optionalEnv(`API_KEY_${NETWORK}`) ?? await activate(txSig, walletSignature, jwt);
   console.log(`\n[4] API token activated: ${apiToken}`);

   console.log(`\nDone. Save these to .env to reuse:`);
   console.log(`JWT_${NETWORK}=${jwt}`);
   console.log(`TX_SIG_${NETWORK}=${txSig}`);
   console.log(`API_KEY_${NETWORK}=${apiToken}`);
}

main().catch((err) => {
   console.error(err);
   process.exit(1);
});
