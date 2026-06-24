/**
 * Example 2 — Purchase TxL with USDT (devnet).
 *
 *   1. Get a guest JWT.
 *   2. Request a partially signed purchase quote for `PURCHASE_AMOUNT` TxL.
 *   3. Inspect the returned transaction; with `SEND=true`, co-sign as the buyer
 *      and broadcast it.
 *
 * Run: `bun run examples/02-purchase.ts`   (dry run)
 *      `SEND=true bun run examples/02-purchase.ts`
 */

import {
   getBase64EncodedWireTransaction,
   getTransactionDecoder,
   partiallySignTransaction,
} from '@solana/kit';
import type { ApiPurchaseQuoteResponse } from '..';
import { API_BASE, apiRequestHeaders, exampleClients, getGuestToken, loadSigner, recordResponse } from './_shared';

const TXLINE_AMOUNT = Number(process.env.PURCHASE_AMOUNT ?? 50);
const SEND = process.env.SEND === 'true';

async function requestQuote(jwt: string, buyerPubkey: string): Promise<ApiPurchaseQuoteResponse> {
   const res = await fetch(`${API_BASE}/api/guest/purchase/quote`, {
      method: 'POST',
      headers: apiRequestHeaders({ 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` }),
      body: JSON.stringify({ buyerPubkey, txlineAmount: TXLINE_AMOUNT }),
   });
   if (!res.ok) {
      throw new Error(`purchase quote ${res.status}: ${await res.text()}`);
   }
   const data = (await res.json()) as ApiPurchaseQuoteResponse;
   await recordResponse('purchase_quote', data);
   return data;
}

async function main(): Promise<void> {
   const signer = await loadSigner();
   const jwt = await getGuestToken();
   console.log(`buyer: ${signer.address}`);

   const quote = await requestQuote(jwt, signer.address);
   console.log(
      `quote for ${TXLINE_AMOUNT} TxL: base ${quote.baseUsdtCost} + fee ${quote.feeUsdtAmount} = ${quote.totalUsdtCharged} USDT`,
   );

   // The backend returns a partially signed transaction; decode to inspect it.
   const txBytes = new Uint8Array(Buffer.from(quote.transactionBase64, 'base64'));
   const decoded = getTransactionDecoder().decode(txBytes);
   console.log('tx signers:', Object.keys(decoded.signatures));

   if (!SEND) {
      console.log('\nDry run — set SEND=true to co-sign as the buyer and broadcast.');
      return;
   }

   // Add the buyer's signature to the backend-signed transaction and broadcast.
   const signed = await partiallySignTransaction([signer.keyPair], decoded);
   const encoded = getBase64EncodedWireTransaction(signed);
   const signature = await exampleClients().rpc.sendTransaction(encoded, { encoding: 'base64' }).send();
   console.log('purchase tx sent:', signature);
}

main().catch((err) => {
   console.error(err);
   process.exit(1);
});
