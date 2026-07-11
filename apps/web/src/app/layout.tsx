import "@fontsource-variable/space-grotesk";
import "@fontsource-variable/plus-jakarta-sans";
import "./globals.css";

import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: {
    default: "VendaFlow — Máquina de Vendas",
    template: "%s · VendaFlow",
  },
  description: "CRM com SDR de IA operando 24/7 no WhatsApp.",
};

export const viewport: Viewport = {
  themeColor: "#08080B",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark">
      <body>
        <div className="app-halos" aria-hidden />
        {children}
      </body>
    </html>
  );
}
