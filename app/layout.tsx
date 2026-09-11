import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '容器視圖｜內容物數量工具',
  description: '設定大容器、小容器與內容物數量，立即查看清楚的圖像化分布。',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
