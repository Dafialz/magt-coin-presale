"use client";

import { useEffect, useMemo, useState } from "react";
import { useTonWallet } from "@tonconnect/ui-react";
import { bindReferrerIfNeeded, buildMyRefLink, getBoundReferrerFor, readRefFromUrlOrStorage } from "../lib/ref";

export default function Referral() {
  const wallet = useTonWallet();
  const [myLink, setMyLink] = useState<string>("");
  const [boundRef, setBoundRef] = useState<string>("");
  const [incomingRef, setIncomingRef] = useState<string>("");

  const myAddress = useMemo(() => wallet?.account?.address || "", [wallet]);

  useEffect(() => {
    // прочитати ?ref= якщо прийшли по рефці
    const r = readRefFromUrlOrStorage();
    if (r) setIncomingRef(r);

    if (myAddress) {
      // “назавжди” забіндити рефера на цей акаунт
      bindReferrerIfNeeded(myAddress);
      setBoundRef(getBoundReferrerFor(myAddress));
      setMyLink(buildMyRefLink(myAddress));
    }
  }, [myAddress]);

  if (!myAddress) {
    return (
      <div className="bg-slate-800/50 p-4 rounded-xl mt-6 text-sm">
        Підключись, щоб отримати своє реф-посилання (5% з покупок твого друга).
      </div>
    );
  }

  return (
    <div className="bg-slate-800/50 p-4 rounded-xl mt-6 text-left">
      <h3 className="text-lg font-semibold mb-2">Реферальна програма — 5%</h3>

      {boundRef ? (
        <p className="text-sm opacity-80 mb-2">Твій акаунт прив’язаний до рефера: <span className="font-mono break-all">{boundRef}</span></p>
      ) : (
        incomingRef && (
          <p className="text-sm opacity-80 mb-2">
            Ти прийшов за посиланням <span className="font-mono break-all">{incomingRef}</span>. Після підключення буде закріплено.
          </p>
        )
      )}

      <div className="flex items-center gap-2">
        <input
          readOnly
          value={myLink}
          className="w-full p-2 rounded text-black"
        />
        <button
          onClick={() => navigator.clipboard.writeText(myLink)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded"
        >
          Копіювати
        </button>
      </div>
      <p className="mt-2 text-xs opacity-70">
        Поділись цим посиланням: коли друг купить токени, ти отримаєш 5% із реф-пулу.
      </p>
    </div>
  );
}
