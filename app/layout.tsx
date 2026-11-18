import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { LanguageProvider } from "@/context/LanguageContext";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "My Diaries - Agenda Inteligente",
  description: "Sua agenda inteligente por voz e notificações push",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#080c10",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className={`${inter.className} bg-[#080c10] text-slate-100 min-h-screen antialiased selection:bg-emerald-500/30`}>
        <LanguageProvider>
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}