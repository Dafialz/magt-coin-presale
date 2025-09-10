"use client";

import { TonConnectUIProvider } from "@tonconnect/ui-react";
import "./globals.css";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const MANIFEST_URL = `${SITE_URL.replace(/\/$/, "")}/tonconnect-manifest.json`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="uk">
      <body>
        <TonConnectUIProvider manifestUrl={MANIFEST_URL}>
          {children}
        </TonConnectUIProvider>
      </body>
    </html>
  );
}
