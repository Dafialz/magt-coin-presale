"use client";

import { useState, useEffect } from "react";
import { beginCell } from "ton-core";
import { useTonConnectUI, useTonWallet } from "@tonconnect/ui-react";

const CLAIM_CONTRACT = process.env.NEXT_PUBLIC_CLAIM_ADDRESS!; // адреса ClaimManager (raw)

export default function ClaimButton() {
  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonWallet();
  const [isConnected, setConnected] = useState(false);

  useEffect(() => {
    setConnected(!!wallet?.account);
  }, [wallet]);

  const handleClaim = async () => {
    if (!isConnected) {
      await tonConnectUI.openModal();
      return;
    }

    if (!CLAIM_CONTRACT) {
      alert("Не задано NEXT_PUBLIC_CLAIM_ADDRESS");
      return;
    }

    // Тіло: op = 0xC1A10001 (UserClaim), 32 біти — валідний hex
    const body = beginCell().storeUint(0xC1A10001, 32).endCell();

    try {
      await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 300,
        messages: [
          {
            address: CLAIM_CONTRACT,
            amount: (0.05 * 1e9).toFixed(0), // 0.05 TON на газ
            payload: body.toBoc({ idx: false }).toString("base64"),
          },
        ],
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      console.error("Claim tx error:", message);
      alert(message || "Не вдалося надіслати транзакцію Claim.");
    }
  };

  return (
    <button
      onClick={handleClaim}
      className="mt-4 w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2 px-4 rounded-lg"
    >
      Claim MAGT
    </button>
  );
}
