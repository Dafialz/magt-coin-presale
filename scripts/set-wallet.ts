/**
 * Одноразово встановити правильний JettonWallet для ClaimManager.
 *
 * ENV:
 *  - MNEMONIC="word1 ... word24"
 *  - NETWORK=mainnet|testnet
 *  - CLAIM_ADDRESS="EQ..."
 *  - NEW_WALLET="EQ..."   (JettonWallet контракту ClaimManager'а для MAGT)
 *
 * Як отримати NEW_WALLET:
 *   це JettonWallet(paired: owner = CLAIM_ADDRESS, master = MAGT_MINTER)
 *   Можна порахувати офчейн або через інструменти TON.
 */

import { Address, beginCell, toNano } from "ton-core";
import { TonClient, WalletContractV4 } from "ton";
import { mnemonicToPrivateKey } from "ton-crypto";
import { getHttpEndpoint } from "@orbs-network/ton-access";

async function main() {
  const MNEMONIC = process.env.MNEMONIC!;
  const NETWORK = (process.env.NETWORK || "mainnet") as "mainnet" | "testnet";
  const CLAIM = Address.parse(process.env.CLAIM_ADDRESS!);
  const NEW_WALLET = Address.parse(process.env.NEW_WALLET!);

  if (!MNEMONIC || !CLAIM || !NEW_WALLET) {
    throw new Error("ENV потрібні: MNEMONIC, CLAIM_ADDRESS, NEW_WALLET, NETWORK");
  }

  const endpoint = await getHttpEndpoint({ network: NETWORK });
  const client = new TonClient({ endpoint });

  // відкриваємо наш гаманець-адмін
  const keys = await mnemonicToPrivateKey(MNEMONIC.trim().split(/\s+/));
  const wallet = WalletContractV4.create({ workchain: 0, publicKey: keys.publicKey });
  const sender = client.open(wallet);

  // тіло повідомлення: op (32 біти) + адреса jw
  // має відповідати OP_ADMIN_SET_WALLET у контракті (0x0AC10A12)
  const body = beginCell()
    .storeUint(0x0ac10a12, 32)
    .storeAddress(NEW_WALLET)
    .endCell();

  console.log("➡️  AdminSetWallet:", NEW_WALLET.toString());

  // відправляємо внутрішнє повідомлення на контракт
  await sender.sendTransfer({
    secretKey: keys.secretKey,
    messages: [
      {
        value: toNano("0.05"),
        to: CLAIM,
        body,
      },
    ],
  });

  console.log("✅ Відправлено AdminSetWallet.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
