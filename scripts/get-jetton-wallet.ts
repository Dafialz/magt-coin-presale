/**
 * Повертає адресу JettonWallet для (minter, owner).
 *
 * ENV:
 *  - NETWORK=mainnet|testnet
 *  - MAGT_MINTER="EQ..."   (адреса JettonMinter MAGT)
 *  - OWNER="EQ..."         (чий JW шукаємо; може бути твій або ClaimManager)
 */

import { Address, beginCell } from "ton-core";
import { TonClient } from "ton";
import { getHttpEndpoint } from "@orbs-network/ton-access";

// обов'язкова змінна ENV з підказкою, якщо забули задати
function req(name: string): string {
  const v = process.env[name];
  if (!v || !v.trim()) {
    throw new Error(`ENV ${name} is required`);
  }
  return v.trim();
}

async function main() {
  const NETWORK = (process.env.NETWORK?.trim() || "mainnet") as "mainnet" | "testnet";
  const MINTER = Address.parse(req("MAGT_MINTER")); // кине помилку, якщо рядок порожній/невалідний
  const OWNER = Address.parse(req("OWNER"));

  const endpoint = await getHttpEndpoint({ network: NETWORK });
  const client = new TonClient({ endpoint });

  // get_wallet_address(owner)
  const res = await client.callGetMethod(MINTER, "get_wallet_address", [
    { type: "slice", cell: beginCell().storeAddress(OWNER).endCell() },
  ]);

  const jw = res.stack.readAddress();
  console.log("JettonWallet(OWNER):", jw.toString());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
