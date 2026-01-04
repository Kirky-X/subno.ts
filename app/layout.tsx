// SPDX-License-Identifier: Apache-2.0 
// Copyright (c) 2026 KirkyX. All rights reserved. 

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SecureNotify - Encrypted Push Notification Service",
  description: "Secure, encrypted push notification service with end-to-end encryption",
};

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