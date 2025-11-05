import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Tandem - Environment Coordination',
  description: 'Resource booking and environment coordination platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
