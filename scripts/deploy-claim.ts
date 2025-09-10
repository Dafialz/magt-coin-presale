/**
 * Деплой ClaimManager:
 *  - code: читаємо з .code.boc (Tact артефакт)
 *  - data: через claimManagerConfigToCell({ owner, jettonMaster })
 *  - відправка: прямий internal з stateInit з Wallet V4
 *
 * ENV:
 *  - MNEMONIC="word1 ... word24"
 *  - NETWORK=mainnet|testnet
 *  - OWNER_ADDRESS="EQ..."
 *  - JETTON_WALLET="EQ..."   (тимчасово можна OWNER)
 */

import fs from "fs";
import path from "path";
import { Address, Cell, contractAddress, toNano, internal, beginCell } from "ton-core";
import { TonClient, WalletContractV4 } from "ton";
import { mnemonicToPrivateKey } from "ton-crypto";
import { getHttpEndpoint } from "@orbs-network/ton-access";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const W: any = require("../wrappers/ClaimManager"); // { ClaimManager, claimManagerConfigToCell }

type InitData = { code: Cell; data: Cell };

function loadCodeFromArtifacts(): Cell {
  const candidates = [
    path.join(__dirname, "..", "contracts", "contracts", "build", "ClaimManager.tact_ClaimManager.code.boc"),
    path.join(__dirname, "..", "contracts", "build", "ClaimManager.tact_ClaimManager.code.boc"),
    path.join(__dirname, "..", "build", "ClaimManager.code.boc"),
  ];
  for (const p of candidates) {
    try {
      const bytes = fs.readFileSync(p);
      const cell = Cell.fromBoc(bytes)[0];
      if (cell && typeof (cell as any).toBoc === "function") return cell;
    } catch {}
  }
  throw new Error("Не знайшов .code.boc у стандартних шляхах. Перевір, що файл існує.");
}

function buildInit(owner: Address, jw: Address): InitData {
  const configToCell = W.claimManagerConfigToCell;
  if (!configToCell) {
    throw new Error("Очікую wrappers/ClaimManager експорт claimManagerConfigToCell");
  }
  const code = loadCodeFromArtifacts();
  const data = configToCell({ owner, jettonMaster: jw }) as Cell; // у твоїй обгортці поле називається jettonMaster
  return { code, data };
}

async function main() {
  const MNEMONIC = process.env.MNEMONIC!;
  const NETWORK = (process.env.NETWORK || "mainnet") as "mainnet" | "testnet";
  const OWNER = Address.parse(process.env.OWNER_ADDRESS!);
  const JW = Address.parse(process.env.JETTON_WALLET!);

  if (!MNEMONIC || !OWNER || !JW) {
    throw new Error("Потрібні ENV: MNEMONIC, OWNER_ADDRESS, JETTON_WALLET, NETWORK");
  }

  const endpoint = await getHttpEndpoint({ network: NETWORK });
  const client = new TonClient({ endpoint });

  const keys = await mnemonicToPrivateKey(MNEMONIC.trim().split(/\s+/));
  const wallet = WalletContractV4.create({ workchain: 0, publicKey: keys.publicKey });
  const openedWallet = client.open(wallet);

  // Пакуємо init і адресy
  const init = buildInit(OWNER, JW);
  const address = contractAddress(0, init);

  console.log("🧱 ClaimManager address:", address.toString());

  // Ручний деплой: internal із stateInit (init), пусте тіло
  const seqno = await openedWallet.getSeqno();
  await openedWallet.sendTransfer({
    seqno,
    secretKey: keys.secretKey,
    messages: [
      internal({
        to: address,
        value: toNano("0.05"),
        init,                 // <<<<<< ВАЖЛИВО: тут code+data
        body: new Cell(),     // порожнє тіло
        bounce: false,
      }),
    ],
  });

  console.log("✅ Деплой відправлено. Адреса:", address.toString());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
