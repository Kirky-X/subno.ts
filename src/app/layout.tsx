// SPDX-License-Identifier: Apache-2.0 
// Copyright (c) 2026 Kirky X. All rights reserved. 

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SecureNotify - Encrypted Push Notification Service",
  description: "Secure, encrypted push notification service with end-to-end encryption",
};

// Force dynamic rendering to avoid prerendering issues with Next.js 16 + styled-jsx
export const dynamic = 'force-dynamic';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
