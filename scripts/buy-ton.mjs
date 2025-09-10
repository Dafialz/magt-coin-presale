// scripts/buy-ton.mjs
// Відправляє TON на адресу продажу з вашого seed (mnemonic) гаманця.
// ПРАЦЮЙТЕ ЛИШЕ З ТЕСТОВИМИ ФРАЗАМИ АБО З КИШЕНЕЮ БЕЗПЕЧНОЮ ДЛЯ ВАС.

import { TonClient, WalletContractV4, internal, toNano, Address, beginCell } from "ton";
import { mnemonicToPrivateKey } from "ton-crypto";
import { getHttpEndpoint } from "@orbs-network/ton-access";

async function main() {
  const {
    MNEMONIC,               // 24 слова (або 12) через пробіл
    SALE_ADDRESS,           // адреса-одержувач (EQ.. / UQ..)
    AMOUNT_TON,             // сума в TON, напр. "0.3"
    COMMENT = "",           // коментар (необов’язково)
    NETWORK = "mainnet",    // "mainnet" або "testnet"
  } = process.env;

  if (!MNEMONIC || !SALE_ADDRESS || !AMOUNT_TON) {
    console.error("❌ Потрібні змінні оточення: MNEMONIC, SALE_ADDRESS, AMOUNT_TON [, COMMENT] [, NETWORK]");
    process.exit(1);
  }

  // Вибір публічного ендпойнту мережі
  const endpoint = await getHttpEndpoint({ network: NETWORK });
  const client = new TonClient({ endpoint });

  // Ключі з мнемоніки
  const keyPair = await mnemonicToPrivateKey(MNEMONIC.trim().split(/\s+/));

  // Створюємо Wallet v4
  const wallet = WalletContractV4.create({ workchain: 0, publicKey: keyPair.publicKey });
  const contract = client.open(wallet);

  // Перевіримо адресу гаманця відправника
  const senderAddr = wallet.address.toString({ testOnly: NETWORK === "testnet" });
  console.log("👤 Ваш гаманець:", senderAddr);

  // Перевіримо баланс (інформативно)
  const bal = await client.getBalance(wallet.address);
  console.log("💰 Баланс:", Number(bal) / 1e9, "TON");

  // Підготовка повідомлення
  const to = Address.parse(SALE_ADDRESS);
  const value = toNano(AMOUNT_TON);

  let body;
  if (COMMENT) {
    // Коментар як text comment (опкод 0)
    body = beginCell().storeUint(0, 32).storeStringTail(COMMENT).endCell();
  }

  const seqno = await contract.getSeqno();

  console.log(`➡️  Відправляємо ${AMOUNT_TON} TON → ${to.toString()}`);
  if (COMMENT) console.log(`📝 Коментар: ${COMMENT}`);

  await contract.sendTransfer({
    secretKey: keyPair.secretKey,
    seqno,
    messages: [
      internal({
        to,
        value,
        body,          // може бути undefined, якщо без коменту
        bounce: false, // на випадок, якщо це зовнішній гаманець
      }),
    ],
  });

  console.log("✅ Транзакція відправлена. Перевір через explorer.");
}

main().catch((e) => {
  console.error("❌ Помилка:", e);
  process.exit(1);
});
