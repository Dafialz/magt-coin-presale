import { Address, beginCell } from "ton-core";
import { TonClient } from "ton";
import { getHttpEndpoint } from "@orbs-network/ton-access";

async function main() {
  const NETWORK = (process.env.NETWORK || "mainnet") as "mainnet" | "testnet";
  const CLAIM   = Address.parse(process.env.CLAIM_ADDRESS!);
  const USER    = Address.parse(process.env.USER_ADDRESS!);

  const endpoint = await getHttpEndpoint({ network: NETWORK });
  const client = new TonClient({ endpoint });

  // get_alloc(user: address) -> int
  const res = await client.callGetMethod(CLAIM, "get_alloc", [
    { type: "slice", cell: beginCell().storeAddress(USER).endCell() },
  ]);
  const amount = res.stack.readBigNumber(); // bigint (мін. юніти)

  console.log("alloc (units):", amount.toString());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
