// scripts/check-minter.ts
import { Address } from "ton-core";
import { TonClient } from "ton";
import { getHttpEndpoint } from "@orbs-network/ton-access";

async function main() {
  const NETWORK = (process.env.NETWORK || "mainnet") as "mainnet" | "testnet";
  const MINTER = Address.parse(process.env.MAGT_MINTER!);

  const endpoint = await getHttpEndpoint({ network: NETWORK });
  const client = new TonClient({ endpoint });

  const state = await client.getContractState(MINTER);
  console.log("state:", state.state);
  if (state.state !== "active") {
    throw new Error("Контракт не активний. Адреса невірна або ще не деплойнута.");
  }

  try {
    // Більшість мінтерів має цей метод (Jetton v2)
    const res = await client.callGetMethod(MINTER, "get_jetton_data", []);
    // stack: total_supply, mintable, admin_address, jetton_content, jetton_wallet_code
    res.stack.readBigNumber(); // total_supply
    res.stack.readBoolean();   // mintable
    const admin = res.stack.readAddress();
    console.log("✅ Це схоже на JettonMinter. admin:", admin.toString());
  } catch (e) {
    throw new Error("Це не JettonMinter (або інша версія/нестандартний код). Замініть MAGT_MINTER на коректний root.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
