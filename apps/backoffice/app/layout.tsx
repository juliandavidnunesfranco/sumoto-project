import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Barlow_Condensed } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const suzukiStyleFont = Barlow_Condensed({
  subsets: ["latin"],
  weight:["600", "700"],
  variable: "--font-headline"
})

export const metadata: Metadata = {
  title: "SUMOTO Crédito · Plataforma de financiación",
  description:
    "Plataforma interna de SUMOTO para originar, evaluar y administrar créditos que financian la venta de motos.",
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable} ${suzukiStyleFont.variable} antialiased`}>
      <body className="bg-background font-sans text-foreground antialiased">
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
