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
      <head>
        {/* Твій кастомний фавікон */}
        <link rel="icon" href="/assets/favicon.png" type="image/png" />
        <link rel="shortcut icon" href="/assets/favicon.png" />
        <link rel="apple-touch-icon" href="/assets/favicon.png" />
        <meta name="theme-color" content="#000000" />
      </head>
      <body>
        <TonConnectUIProvider manifestUrl={MANIFEST_URL}>
          {children}
        </TonConnectUIProvider>
      </body>
    </html>
  );
}
