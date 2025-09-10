/**
 * Адмін-скрипт: встановити алокацію користувачу (внутрішній меседж на ClaimManager)
 *
 * Працює як з ENV, так і з CLI прапорцями.
 *
 * ENV (опційно, якщо не передаєш CLI):
 *  - NETWORK=mainnet|testnet              (дефолт: mainnet)
 *  - MNEMONIC="word1 ... word24"          (або --mnemonic "...")
 *  - CLAIM_ADDRESS="EQ..."                (або --claim EQ...)
 *  - USER_ADDRESS="EQ..."                 (або --user UQ... / EQ...)
 *  - AMOUNT_MAGT="100.123"                (або --human 100.123)
 *  - MAGT_DECIMALS="9"                    (або --decimals 9)
 *
 * CLI прапорці (переважні):
 *  --mnemonic    "word1 ... word24"
 *  --claim       EQ...
 *  --user        UQ... / EQ...
 *  --raw         80342795929              // кількість у мінімальних одиницях MAGT
 *  --human       80.342795929             // кількість у MAGT (десяткова крапка)
 *  --decimals    9
 *  --network     mainnet|testnet          // дефолт mainnet
 *  --gas         0.05                     // TON на газ (дефолт 0.05)
 */

import { Address, beginCell, toNano } from "ton-core";
import { TonClient, WalletContractV4, internal } from "ton";
import { mnemonicToPrivateKey } from "ton-crypto";
import { getHttpEndpoint } from "@orbs-network/ton-access";

// === helpers ===
function argvVal(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
function hasArg(name: string): boolean {
  return process.argv.includes(`--${name}`);
}
function toUnits(amount: string | number, decimals: number): bigint {
  const [int, frac = ""] = String(amount).replace(",", ".").split(".");
  const fracPadded = (frac + "0".repeat(decimals)).slice(0, decimals);
  const base = BigInt(10) ** BigInt(decimals);
  return BigInt(int || "0") * base + BigInt(fracPadded || "0");
}
function abort(msg: string): never {
  console.error(`❌ ${msg}`);
  process.exit(1);
}

async function main() {
  // ===== read config from CLI or ENV =====
  const NETWORK = (argvVal("network") || process.env.NETWORK || "mainnet") as
    | "mainnet"
    | "testnet";

  const MNEMONIC = argvVal("mnemonic") || process.env.MNEMONIC || "";
  if (!MNEMONIC.trim()) abort("MNEMONIC is required (env MNEMONIC or --mnemonic \"word1 ... word24\").");

  const CLAIM_RAW =
    argvVal("claim") ||
    process.env.CLAIM_ADDRESS ||
    process.env.NEXT_PUBLIC_CLAIM_ADDRESS ||
    "";
  if (!CLAIM_RAW) abort("CLAIM_ADDRESS is required (env CLAIM_ADDRESS / NEXT_PUBLIC_CLAIM_ADDRESS or --claim EQ...).");

  const USER_RAW = argvVal("user") || process.env.USER_ADDRESS || "";
  if (!USER_RAW) abort("USER_ADDRESS is required (env USER_ADDRESS or --user <address>).");

  const DECIMALS = Number(argvVal("decimals") || process.env.MAGT_DECIMALS || "9") || 9;

  // amount: prefer --raw, else --human, else ENV AMOUNT_MAGT
  const RAW_STR = argvVal("raw");
  const HUMAN_STR = argvVal("human") || process.env.AMOUNT_MAGT;

  let amountUnits: bigint;
  if (RAW_STR !== undefined) {
    try {
      amountUnits = BigInt(RAW_STR);
    } catch {
      abort(`--raw must be a bigint string (got "${RAW_STR}")`);
      return; // TS narrow
    }
  } else if (HUMAN_STR !== undefined) {
    amountUnits = toUnits(HUMAN_STR, DECIMALS);
  } else {
    abort("Provide amount via --raw <units> or --human <MAGT> (or env AMOUNT_MAGT).");
    return;
  }

  const GAS_TON = argvVal("gas") || "0.05";

  // ===== parse addresses =====
  let CLAIM_ADDRESS: Address;
  let USER_ADDRESS: Address;
  try {
    CLAIM_ADDRESS = Address.parse(CLAIM_RAW);
  } catch {
    abort(`CLAIM_ADDRESS is invalid: "${CLAIM_RAW}"`);
    return;
  }
  try {
    USER_ADDRESS = Address.parse(USER_RAW);
  } catch {
    abort(`USER_ADDRESS is invalid: "${USER_RAW}"`);
    return;
  }

  // ===== client =====
  console.log(`🌐 Network: ${NETWORK}`);
  const endpoint = await getHttpEndpoint({ network: NETWORK });
  const client = new TonClient({ endpoint });

  // ===== admin wallet (sender) =====
  const words = MNEMONIC.trim().split(/\s+/);
  if (words.length < 12) abort("MNEMONIC looks invalid — expected 12/24 words.");
  const keys = await mnemonicToPrivateKey(words);
  const wallet = WalletContractV4.create({ workchain: 0, publicKey: keys.publicKey });
  const openedWallet = client.open(wallet);

  // ==== build body for AdminSet ====
  // OP = 0x0AC10A11 (32 bits), then: address user, int amount(257 bits)
  const body = beginCell()
    .storeUint(0x0ac10a11, 32)
    .storeAddress(USER_ADDRESS)
    .storeInt(amountUnits, 257)
    .endCell();

  console.log(
    `➡️  Set allocation for ${USER_ADDRESS.toString()} = ${amountUnits.toString()} units (decimals=${DECIMALS})`
  );

  // ==== send internal message ====
  const seqno = await openedWallet.getSeqno();
  await openedWallet.sendTransfer({
    secretKey: keys.secretKey,
    seqno,
    messages: [
      internal({
        to: CLAIM_ADDRESS,
        value: toNano(GAS_TON),
        body,
      }),
    ],
  });

  console.log("✅ AdminSet sent. Wait for the transaction to be included.");
  console.log("   Tip: check via /api/alloc?user=<your_friendly_address> or Tonviewer.");
}

main().catch((e) => {
  console.error("❌ Error:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
