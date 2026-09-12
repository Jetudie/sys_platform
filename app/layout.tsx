import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'System Map｜系統架構協作圖',
  description: '以 2D 模組與暫存空間視覺化系統版本，協作整理討論、Review 與技術文件。',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-Hant"><body>{children}</body></html>;
}
