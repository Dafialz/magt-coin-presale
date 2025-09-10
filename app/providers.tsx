"use client";

import React from "react";
import { TonConnectUIProvider } from "@tonconnect/ui-react";

const manifestUrl =
  `${process.env.NEXT_PUBLIC_SITE_URL}/tonconnect-manifest.json`; // МАЄ бути абсолютний http://... або https://...

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TonConnectUIProvider manifestUrl={manifestUrl}>
      {children}
    </TonConnectUIProvider>
  );
}
