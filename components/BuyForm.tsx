"use client";

import { useEffect, useMemo, useState } from "react";
import { beginCell } from "ton-core";
import { useTonConnectUI, useTonWallet } from "@tonconnect/ui-react";

import { SALE_WALLET } from "../lib/config";
import { currentLevelInfo, estimateMagtByTon } from "../lib/pricing";
import { getBoundReferrerFor, readRefFromUrlOrStorage } from "../lib/ref";

export default function BuyForm() {
  const [tonAmount, setTonAmount] = useState("");
  const [magtAmount, setMagtAmount] = useState("0");
  const [levelText, setLevelText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonWallet();
  const myAddress = useMemo(() => wallet?.account?.address || "", [wallet]);

  // TODO: під’єднай реальний показник проданих токенів з бекенду / індексера
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
    if (!SALE_WALLET) {
      alert("Не задано адресу одержувача TON (NEXT_PUBLIC_SALE_WALLET).");
      return;
    }
    const ton = parseFloat(tonAmount);
    if (!ton || ton <= 0) {
      alert("Введи коректну суму в TON.");
      return;
    }

    // реф у коментар: спочатку забінджений, інакше — з URL/LocalStorage
    let ref = "";
    if (myAddress) ref = getBoundReferrerFor(myAddress);
    if (!ref) ref = readRefFromUrlOrStorage();

    const comment = `MAGT presale${ref ? ` | ref=${ref}` : ""}`;
    const payload = beginCell().storeUint(0, 32).storeStringTail(comment).endCell();
    const nanoTon = BigInt(Math.round(ton * 1e9));

    try {
      setSubmitting(true);
      await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 300,
        messages: [
          {
            address: SALE_WALLET,
            amount: nanoTon.toString(),
            payload: payload.toBoc({ idx: false }).toString("base64"),
          },
        ],
      });
      alert("Запит на оплату відправлено в гаманець. Підтверди транзакцію.");
      setTonAmount("");
      setMagtAmount("0");
    } catch (err: any) {
      console.error("sendTransaction error:", err);
      alert(err?.message || "Не вдалося надіслати транзакцію.");
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
    </div>
  );
}
