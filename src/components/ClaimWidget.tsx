"use client";

import React, { useEffect, useMemo, useState } from "react";
import { TonConnectButton, useTonConnectUI, useTonWallet } from "@tonconnect/ui-react";
import { beginCell } from "ton-core";

/**
 * Конфіг із ENV:
 *  - NEXT_PUBLIC_CLAIM_ADDRESS=EQCC7f2wrXcMQEW_VClMaitpipeGuxKEORyS2sj-9dYWQQmD
 *  - NEXT_PUBLIC_MAGT_DECIMALS=9
 *  - NETWORK=mainnet | testnet (для бекенду /api/alloc)
 */
const CLAIM_ADDRESS = process.env.NEXT_PUBLIC_CLAIM_ADDRESS!;
const DECIMALS = Number(process.env.NEXT_PUBLIC_MAGT_DECIMALS || "9");

// OP-код user claim: має збігатися з твоїм контрактом
const OP_USER_CLAIM = 0xC1A10001; // 32-біт

function formatHuman(units: bigint, decimals: number) {
  const base = BigInt(10) ** BigInt(decimals);
  const i = units / base;
  const f = (units % base).toString().padStart(decimals, "0").replace(/0+$/, "");
  return f ? `${i}.${f}` : `${i}`;
}

export default function ClaimWidget() {
  const wallet = useTonWallet();
  const [tonConnectUI] = useTonConnectUI();

  const [allocRaw, setAllocRaw] = useState<bigint>(0n);
  const [isLoading, setIsLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const userAddressFriendly = useMemo(() => {
    const a = wallet?.account?.address;
    return a && typeof a === "string" && a.length > 0 ? a : null;
  }, [wallet?.account?.address]);

  // Підтягнути алокацію при підключенні/зміні гаманця
  useEffect(() => {
    let stop = false;
    async function loadAlloc() {
      if (!userAddressFriendly) {
        setAllocRaw(0n);
        return;
      }
      try {
        setErr(null);
        const url = `/api/alloc?user=${encodeURIComponent(userAddressFriendly)}`;
        const r = await fetch(url, { cache: "no-store" });
        const j = (await r.json()) as { raw: string };
        if (r.ok) {
          if (!stop) setAllocRaw(BigInt(j.raw));
        } else {
          throw new Error((j as unknown as { error?: string })?.error ?? "Failed to load allocation");
        }
      } catch (e: unknown) {
        if (!stop) {
          const message = e instanceof Error ? e.message : String(e);
          setErr(message);
          setAllocRaw(0n);
        }
      }
    }
    loadAlloc();
    return () => {
      stop = true;
    };
  }, [userAddressFriendly]);

  // Побудова payload для user-claim
  const claimPayloadB64 = useMemo(() => {
    const cell = beginCell().storeUint(OP_USER_CLAIM, 32).endCell();
    // TonConnect чекає base64 BOC без URL-safe
    return cell.toBoc().toString("base64");
  }, []);

  async function onClaim() {
    if (!wallet || !userAddressFriendly) return;
    setIsLoading(true);
    setErr(null);
    try {
      // На газ: ~0.05 TON (50m nanoTON)
      const gas = "50000000"; // nanotons

      const validUntil = Math.floor(Date.now() / 1000) + 60; // 60s
      await tonConnectUI.sendTransaction({
        validUntil,
        messages: [
          {
            address: CLAIM_ADDRESS,
            amount: gas,
            payload: claimPayloadB64,
          },
        ],
      });

      // Дамо мережі 2–3 сек і перезчитаємо алокацію
      await new Promise((r) => setTimeout(r, 2500));
      const url = `/api/alloc?user=${encodeURIComponent(userAddressFriendly)}`;
      const r = await fetch(url, { cache: "no-store" });
      const j = (await r.json()) as { raw: string };
      if (r.ok) setAllocRaw(BigInt(j.raw));
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setErr(message);
    } finally {
      setIsLoading(false);
    }
  }

  const canClaim = !!wallet && allocRaw > 0n && !isLoading;

  return (
    <div className="flex flex-col gap-4 max-w-md p-5 rounded-2xl shadow-md bg-white/70 backdrop-blur">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold">Claim MAGT</h3>
        <TonConnectButton />
      </div>

      <div className="text-sm text-gray-600">
        ClaimManager:&nbsp;
        <span className="font-mono break-all">{CLAIM_ADDRESS}</span>
      </div>

      <div className="rounded-lg border p-3 bg-white">
        <div className="text-sm text-gray-500">Your allocation</div>
        <div className="text-2xl font-bold">
          {formatHuman(allocRaw, DECIMALS)} <span className="text-base font-medium">MAGT</span>
        </div>
      </div>

      {err && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-2">
          {err}
        </div>
      )}

      <button
        onClick={onClaim}
        disabled={!canClaim}
        className={`px-4 py-3 rounded-xl text-white font-medium ${
          canClaim ? "bg-blue-600 hover:bg-blue-700" : "bg-gray-400 cursor-not-allowed"
        }`}
      >
        {isLoading ? "Submitting…" : "Claim to my wallet"}
      </button>

      {!wallet && (
        <div className="text-xs text-gray-500">
          Під’єднай гаманець через кнопку вгорі, щоб побачити алокацію та виконати Claim.
        </div>
      )}
    </div>
  );
}
