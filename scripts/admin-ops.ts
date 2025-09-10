import { Address, beginCell, toNano } from "ton-core";
import { TonClient, WalletContractV4, internal } from "ton";
import { mnemonicToPrivateKey } from "ton-crypto";
import { getHttpEndpoint } from "@orbs-network/ton-access";

async function send(ownerMnemonic: string, to: string, body: Buffer | null, valueTon: string, network: "mainnet"|"testnet") {
  const endpoint = await getHttpEndpoint({ network });
  const client = new TonClient({ endpoint });
  const keys = await mnemonicToPrivateKey(ownerMnemonic.trim().split(/\s+/));
  const wallet = WalletContractV4.create({ workchain: 0, publicKey: keys.publicKey });
  const opened = client.open(wallet);
  const seqno = await opened.getSeqno();
  await opened.sendTransfer({
    secretKey: keys.secretKey,
    seqno,
    messages: [ internal({ to: Address.parse(to), value: toNano(valueTon), body: body ? beginCell().storeBuffer(body).endCell() : undefined }) ]
  });
}

function msgAdminSetWallet(jw: string): Buffer {
  const cell = beginCell()
    .storeUint(0x0AC10A12, 32) // AdminSetWallet
    .storeAddress(Address.parse(jw))
    .endCell();
  return cell.toBoc();
}

function msgAdminSetPrice(priceNanoPerMAGT: number): Buffer {
  const cell = beginCell()
    .storeUint(0x0AC10A13, 32) // AdminSetPrice (наш умовний код для зовнішнього повідомлення)
    .storeCoins(BigInt(priceNanoPerMAGT))
    .endCell();
  return cell.toBoc();
}

(async () => {
  const MNEMONIC = process.env.MNEMONIC!;         // сид АДМІНА (не юзера!)
  const CLAIM    = process.env.CLAIM_ADDRESS!;    // адреса ClaimManager
  const NETWORK  = (process.env.NETWORK || "mainnet") as "mainnet"|"testnet";

  // 1) встановити JW:
  // await send(MNEMONIC, CLAIM, msgAdminSetWallet(process.env.JW_ADDRESS!), "0.05", NETWORK);

  // 2) встановити ціну (наприклад 0.003734 TON/MAGT -> 3_734_000):
  // await send(MNEMONIC, CLAIM, msgAdminSetPrice(3_734_000), "0.05", NETWORK);

  console.log("OK");
})();
