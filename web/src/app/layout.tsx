import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Header from "@/components/layout/Header";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RailPulse — Indian Rail Live Intelligence",
  description: "Real-time and historical tracking, delay analytics, and Train Time Machine replay for Indian Railways trains.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-bg text-text font-sans">
        <Header />
        <div className="flex-1">{children}</div>
        <footer className="border-t border-border px-5 py-4 text-xs text-text-dim">
          ⚠️ Demo build with mock data — illustrates the design in{" "}
          <code>docs/rail-intelligence-platform/</code>. Not connected to live Indian Railways data. Map data ©
          OpenStreetMap contributors, © CARTO.
        </footer>
      </body>
    </html>
  );
}
