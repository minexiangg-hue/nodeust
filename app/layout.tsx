import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'NODE — HKUST anonymous exchange map',
  description:
    'An anonymous campus exchange and reciprocal matching platform for the HKUST community.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
