/**
 * Замінтити MAGT на адресу ClaimManager (його owner), щоб у ClaimManager’а з’явилися токени.
 *
 * ENV:
 *  - MNEMONIC
 *  - NETWORK=mainnet|testnet
 *  - MAGT_MINTER="EQ..."
 *  - CLAIM_ADDRESS="EQ..."           (owner для get_wallet_address)
 *  - AMOUNT_MAGT="1000"
 *  - MAGT_DECIMALS=9
 *
 * Увага: цей скрипт використовує стандартний метод mint мінтера, який доступний лише власнику.
 * Якщо твій мінтер має інший інтерфейс — краще скористайся твоїм готовим scripts/mint-jetton.ts.
 */

import { Address, beginCell, toNano } from "ton-core";
import { TonClient, WalletContractV4, internal } from "ton";
import { mnemonicToPrivateKey } from "ton-crypto";
import { getHttpEndpoint } from "@orbs-network/ton-access";

function toUnits(amount: string | number, decimals: number): bigint {
  const [int, frac = ""] = String(amount).split(".");
  const fracPadded = (frac + "0".repeat(decimals)).slice(0, decimals);
  return BigInt(int) * BigInt(10 ** decimals) + BigInt(fracPadded);
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

  // Стандартний mint (може відрізнятись у твоєму мінтері):
  // op = 0x178d4519, поля: amount, receiver, response_address, forward_amount, forward_payload
  const amountUnits = toUnits(AMOUNT_MAGT, DECIMALS);

  const body = beginCell()
    .storeUint(0x178d4519, 32) // MINT op (може відрізнятися у твоїй реалізації!)
    .storeCoins(amountUnits)
    .storeAddress(CLAIM_ADDRESS)     // власник (owner) для JW ClaimManager
    .storeAddress(wallet.address)    // відповідь
    .storeCoins(0)                   // fwd amount
    .storeBit(0)                     // fwd payload null
    .endCell();

  await sender.sendTransfer({
    secretKey: keys.secretKey,
    seqno: await sender.getSeqno(),
    messages: [
      internal({
        to: MINTER,
        value: toNano("0.2"),
        body,
      }),
    ],
  });

  console.log("✅ Запит на mint відправлено.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
