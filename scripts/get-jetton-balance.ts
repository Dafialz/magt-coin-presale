/**
 * Показує баланс MAGT для OWNER через його JettonWallet.
 *
 * ENV:
 *  - NETWORK=mainnet|testnet
 *  - MAGT_MINTER="EQ..."
 *  - OWNER="EQ..."             (чий баланс дивимось)
 *  - MAGT_DECIMALS=9
 */

import { Address, beginCell } from "ton-core";
import { TonClient } from "ton";
import { getHttpEndpoint } from "@orbs-network/ton-access";

// обов'язкова змінна ENV з явною помилкою, якщо її нема
function req(name: string): string {
  const v = process.env[name];
  if (!v || !v.trim()) throw new Error(`ENV ${name} is required`);
  return v.trim();
}

function human(amountUnits: bigint, decimals: number) {
  const base = BigInt(10) ** BigInt(decimals);
  const int = amountUnits / base;
  const fracRaw = (amountUnits % base).toString().padStart(decimals, "0");
  const frac = fracRaw.replace(/0+$/, "");
  return frac ? `${int}.${frac}` : `${int}`;
}

async function main() {
  const NETWORK = (process.env.NETWORK?.trim() || "mainnet") as "mainnet" | "testnet";
  const MINTER = Address.parse(req("MAGT_MINTER")); // кине помилку, якщо невалідний/порожній
  const OWNER = Address.parse(req("OWNER"));
  const DECIMALS = Number(process.env.MAGT_DECIMALS?.trim() || "9");

  const endpoint = await getHttpEndpoint({ network: NETWORK });
  const client = new TonClient({ endpoint });

  // 1) дізнаємось адресу JW
  const jwRes = await client.callGetMethod(MINTER, "get_wallet_address", [
    { type: "slice", cell: beginCell().storeAddress(OWNER).endCell() },
  ]);
  const jw = jwRes.stack.readAddress();

  // 2) читаємо get_wallet_data() у JW: (balance, owner, master, code)
  const data = await client.callGetMethod(jw, "get_wallet_data", []);
  const balanceUnits = data.stack.readBigNumber(); // bigint

  console.log("OWNER:  ", OWNER.toString());
  console.log("JW:     ", jw.toString());
  console.log("Balance:", human(balanceUnits, DECIMALS), "MAGT");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
