import type { Metadata } from 'next';
import './globals.css';
import './overrides.css';

export const metadata: Metadata = {
  title: 'TOCFL Practice — Reading mock tests',
  description: 'Level-aware TOCFL Reading practice designed around the rhythm of the exam.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
