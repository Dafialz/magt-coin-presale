/**
 * Встановити алокацію користувачу (адмін), надсилаючи внутрішній меседж прямо
 * з гаманця на ClaimManager (без provider.internal).
 *
 * ENV:
 *  - NETWORK=mainnet|testnet
 *  - MNEMONIC="word1 ... word24"
 *  - CLAIM_ADDRESS="EQ..."
 *  - USER_ADDRESS="EQ..."
 *  - AMOUNT_MAGT="1001"         // у MAGT
 *  - MAGT_DECIMALS="9"
 */

import { Address, beginCell, toNano } from "ton-core";
import { TonClient, WalletContractV4, internal } from "ton";
import { mnemonicToPrivateKey } from "ton-crypto";
import { getHttpEndpoint } from "@orbs-network/ton-access";

function toUnits(amount: string | number, decimals: number): bigint {
  const [int, frac = ""] = String(amount).replace(",", ".").split(".");
  const fracPadded = (frac + "0".repeat(decimals)).slice(0, decimals);
  return BigInt(int) * (10n ** BigInt(decimals)) + BigInt(fracPadded || "0");
}

async function main() {
  // ===== ENV =====
  const NETWORK = (process.env.NETWORK || "mainnet") as "mainnet" | "testnet";
  const MNEMONIC = process.env.MNEMONIC!;
  const CLAIM_ADDRESS = Address.parse(process.env.CLAIM_ADDRESS!);
  const USER_ADDRESS  = Address.parse(process.env.USER_ADDRESS!);
  const AMOUNT_MAGT   = process.env.AMOUNT_MAGT || "0";
  const DECIMALS      = Number(process.env.MAGT_DECIMALS || "9");

  if (!MNEMONIC) throw new Error("MNEMONIC is required");

  const amountUnits = toUnits(AMOUNT_MAGT, DECIMALS);

  // ===== client =====
  const endpoint = await getHttpEndpoint({ network: NETWORK });
  const client = new TonClient({ endpoint });

  // ===== admin wallet (sender) =====
  const keys = await mnemonicToPrivateKey(MNEMONIC.trim().split(/\s+/));
  const wallet = WalletContractV4.create({ workchain: 0, publicKey: keys.publicKey });
  const openedWallet = client.open(wallet);

  // ==== будуємо body для AdminSet ====
  // OP = 0x0AC10A11 (32 біти), далі: address user, int amount(257 біт)
  const body = beginCell()
    .storeUint(0x0AC10A11, 32)
    .storeAddress(USER_ADDRESS)
    .storeInt(amountUnits, 257)
    .endCell();

  console.log(
    `➡️  Set allocation: ${USER_ADDRESS.toString()} = ${AMOUNT_MAGT} MAGT (${amountUnits} units)`
  );

  // ==== надсилаємо внутрішнє повідомлення без провайдера ====
  const seqno = await openedWallet.getSeqno();

  await openedWallet.sendTransfer({
    secretKey: keys.secretKey,            // працювало у твоєму deploy-claim.ts
    seqno,
    messages: [
      internal({
        to: CLAIM_ADDRESS,
        value: toNano("0.05"),            // газ
        body,
      }),
    ],
  });

  console.log("✅ AdminSet відправлено.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
