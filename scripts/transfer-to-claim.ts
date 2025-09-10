/**
 * Перекинути MAGT з твого JettonWallet → на JettonWallet ClaimManager’а.
 *
 * ENV:
 *  - MNEMONIC
 *  - NETWORK=mainnet|testnet
 *  - MAGT_MINTER="EQ..."
 *  - CLAIM_ADDRESS="EQ..."
 *  - AMOUNT_MAGT="1000"
 *  - MAGT_DECIMALS=9
 */

import { Address, Cell, beginCell, toNano } from "ton-core";
import { TonClient, WalletContractV4, internal } from "ton";
import { getHttpEndpoint } from "@orbs-network/ton-access";
import { mnemonicToPrivateKey } from "ton-crypto";

function toUnits(amount: string | number, decimals: number): bigint {
  const [int, frac = ""] = String(amount).split(".");
  const fracPadded = (frac + "0".repeat(decimals)).slice(0, decimals);
  return BigInt(int) * (BigInt(10) ** BigInt(decimals)) + BigInt(fracPadded || "0");
}

// Виклик get-метода мінтера "get_wallet_address(owner)"
async function getJettonWallet(
  client: TonClient,
  minter: Address,
  owner: Address
): Promise<Address> {
  const res = await client.callGetMethod(minter, "get_wallet_address", [
    { type: "slice", cell: beginCell().storeAddress(owner).endCell() },
  ]);
  return res.stack.readAddress();
}

// Побудова тіла transfer для JettonWallet (TIP-3 / Jetton v2)
function buildJettonTransfer(
  amountUnits: bigint,
  to: Address,
  responseTo: Address
): Cell {
  return beginCell()
    .storeUint(0x0f8a7ea5, 32)       // op::transfer
    .storeUint(0, 64)                // query_id
    .storeCoins(amountUnits)         // amount (units)
    .storeAddress(to)                // to owner
    .storeAddress(responseTo)        // response_destination
    .storeBit(0)                     // custom_payload = null
    .storeCoins(0)                   // forward_amount
    .storeBit(0)                     // forward_payload = null
    .endCell();
}

async function main() {
  const MNEMONIC = process.env.MNEMONIC!;
  const NETWORK = process.env.NETWORK || "mainnet";
  const MINTER = Address.parse(process.env.MAGT_MINTER!);
  const CLAIM_ADDRESS = Address.parse(process.env.CLAIM_ADDRESS!);
  const AMOUNT_MAGT = process.env.AMOUNT_MAGT || "0";
  const DECIMALS = Number(process.env.MAGT_DECIMALS || "9");

  if (!MNEMONIC || !MINTER || !CLAIM_ADDRESS) {
    throw new Error("Потрібні ENV: MNEMONIC, MAGT_MINTER, CLAIM_ADDRESS, AMOUNT_MAGT, MAGT_DECIMALS");
  }

  const endpoint = await getHttpEndpoint({ network: NETWORK as any });
  const client = new TonClient({ endpoint });

  const keys = await mnemonicToPrivateKey(MNEMONIC.trim().split(/\s+/));
  const wallet = WalletContractV4.create({ workchain: 0, publicKey: keys.publicKey });
  const sender = client.open(wallet);

  // JW відправника (твій), та JW ClaimManager’а
  const myJW = await getJettonWallet(client, MINTER, wallet.address);
  const claimJW = await getJettonWallet(client, MINTER, CLAIM_ADDRESS);

  const amountUnits = toUnits(AMOUNT_MAGT, DECIMALS);
  const body = buildJettonTransfer(amountUnits, CLAIM_ADDRESS, wallet.address);

  console.log("👛 My JW:", myJW.toString());
  console.log("🏦 Claim JW:", claimJW.toString());
  console.log("➡️  Transfer", AMOUNT_MAGT, "MAGT → ClaimManager");

  await sender.sendTransfer({
    secretKey: keys.secretKey,
    seqno: await sender.getSeqno(),
    messages: [
      internal({
        to: myJW,
        value: toNano("0.2"), // газ на пересилання
        body,
      }),
    ],
  });

  console.log("✅ Відправлено transfer із вашого JW на JW ClaimManager.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
