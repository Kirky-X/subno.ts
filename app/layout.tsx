// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import type { Metadata } from 'next';
import './globals.css';
import GlobalHeader from './components/GlobalHeader';
import StarField from './components/StarField';
import { I18nProvider } from './context/I18nContext';

export const metadata: Metadata = {
  title: {
    default: 'subno.ts - SecureNotify',
    template: '%s | SecureNotify',
  },
  description: 'Encrypted push notification service - Public key hosting and message distribution',
  icons: {
    icon: '/favicon.png',
    shortcut: '/favicon.png',
    apple: '/favicon.png',
  },
  other: {
    'icon': '/favicon.webp',
    'mask-icon': '/favicon.svg',
  },
};

function Footer() {
  const currentYear = new Date().getFullYear();
  return (
    <footer className="site-footer">
      <p>Copyright © {currentYear} Kirky.X · SecureNotify · Encrypted Push Service</p>
    </footer>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <I18nProvider>
          <StarField />
          <GlobalHeader />
          <div className="main-content">
            {children}
          </div>
          <Footer />
        </I18nProvider>
      </body>
    </html>
  );
}