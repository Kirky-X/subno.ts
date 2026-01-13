import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'subno.ts - SecureNotify',
  description: '加密推送通知服务 - 公钥存储与消息分发',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
