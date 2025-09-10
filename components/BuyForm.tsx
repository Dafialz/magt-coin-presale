"use client";

import { useEffect, useMemo, useState } from "react";
import { Address, beginCell } from "ton-core";
import { useTonConnectUI, useTonWallet } from "@tonconnect/ui-react";

import { currentLevelInfo, estimateMagtByTon } from "../lib/pricing";
import { getBoundReferrerFor, readRefFromUrlOrStorage } from "../lib/ref";

// ❗️ Тепер платимо на ClaimManager, а не на SALE_WALLET
const CLAIM_ADDRESS = process.env.NEXT_PUBLIC_CLAIM_ADDRESS!;
const OP_BUY = 0x42555931; // 'BUY1' як 32-бітний op-код (будь-який унікальний, але цей зафіксували)

export default function BuyForm() {
  const [tonAmount, setTonAmount] = useState("");
  const [magtAmount, setMagtAmount] = useState("0");
  const [levelText, setLevelText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonWallet();
  const myAddress = useMemo(() => wallet?.account?.address || "", [wallet]);

  // TODO: під’єднати реальний soldSoFar з бекенду
  const soldSoFar = 0;

  useEffect(() => {
    const info = currentLevelInfo(soldSoFar);
    setLevelText(
      `Ціна зараз: ${info.price} TON (Рівень ${info.index}, залишок у рівні ${info.leftInLevel.toLocaleString()} MAGT)`
    );
  }, [soldSoFar]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setTonAmount(v);

    const ton = parseFloat(v);
    if (!isNaN(ton) && ton > 0) {
      const { magtOut } = estimateMagtByTon(ton, soldSoFar);
      setMagtAmount(Math.floor(magtOut).toLocaleString());
    } else {
      setMagtAmount("0");
    }
  };

  const handleBuy = async () => {
    if (!CLAIM_ADDRESS) {
      alert("NEXT_PUBLIC_CLAIM_ADDRESS не заданий.");
      return;
    }
    const ton = parseFloat(tonAmount);
    if (!ton || ton <= 0) {
      alert("Введи коректну суму в TON.");
      return;
    }

    // 1) реферал (опційний): спочатку забінджений, інакше з URL/LocalStorage
    let ref = "";
    if (myAddress) ref = getBoundReferrerFor(myAddress);
    if (!ref) ref = readRefFromUrlOrStorage();

    // 2) payload для контракту: OP_BUY + maybe(ref address)
    //    Якщо реферала немає — кладемо null-адресу (maybe address)
    const refAddr = ref ? Address.parse(ref) : null;
    const payloadCell = beginCell()
      .storeUint(OP_BUY, 32)
      .storeAddress(refAddr) // maybe address
      .endCell();

    // 3) сума в nanoTON
    const nanoTon = BigInt(Math.round(ton * 1e9));

    try {
      setSubmitting(true);
      await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 300,
        messages: [
          {
            address: CLAIM_ADDRESS,
            amount: nanoTon.toString(),
            payload: payloadCell.toBoc({ idx: false }).toString("base64"),
          },
        ],
      });

      alert(
        "Транзакцію відправлено. Контракт автоматично надішле MAGT на твій гаманець (як тільки отримає TON)."
      );
      setTonAmount("");
      setMagtAmount("0");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("sendTransaction error:", message);
      alert(message || "Не вдалося надіслати транзакцію.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-purple-900/40 p-6 rounded-xl mt-8">
      <h2 className="text-2xl font-semibold mb-3">Купити MAGT</h2>

      <p className="text-sm opacity-80 mb-3">{levelText}</p>

      <div className="space-y-2">
        <label className="block text-sm opacity-80">Сума в TON</label>
        <input
          type="number"
          placeholder="0.30"
          min="0"
          step="0.01"
          value={tonAmount}
          onChange={handleChange}
          className="w-full p-2 rounded text-black"
          disabled={submitting}
        />
      </div>

      <p className="mt-3">
        Отримаєш ≈ <span className="font-bold">{magtAmount}</span> MAGT
      </p>

      <button
        onClick={handleBuy}
        disabled={submitting}
        className="mt-4 w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-60 disabled:cursor-not-allowed text-white py-2 px-4 rounded-lg"
      >
        {submitting ? "Відправляємо..." : "Купити"}
      </button>

      <p className="text-xs opacity-80 mt-3">
        Після оплати контракт <b>автоматично</b> відправить MAGT на твій гаманець.
      </p>
    </div>
  );
}
