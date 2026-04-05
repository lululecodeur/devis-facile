import type { Metadata } from 'next';
import { Inter, Geist_Mono } from 'next/font/google';
import './globals.css';
import ThemeProvider from '@/components/ThemeProvider';
import NavBar from '@/components/NavBar';
import { ToastProvider } from '@/context/ToastContext';
import { CartProvider } from '@/context/CartContext';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'DevisPro — Générateur de devis professionnel',
  description: 'Créez des devis professionnels en quelques minutes',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className={`${inter.variable} ${geistMono.variable}`} style={{ backgroundColor: 'var(--bg)', color: 'var(--fg)', minHeight: '100vh' }}>
        <ThemeProvider>
          <ToastProvider>
            <CartProvider>
              <NavBar />
              <div style={{ minHeight: 'calc(100vh - 56px)' }}>
                {children}
              </div>
            </CartProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
