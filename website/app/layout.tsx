import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "Photo Import — Import SD card photos into Apple Photos",
  description:
    "A fast, keyboard-driven macOS app to browse, preview, and import photos from your camera's SD card directly into Apple Photos.",
  keywords: [
    "photo import",
    "sd card",
    "apple photos",
    "macos",
    "camera",
    "photo management",
  ],
  openGraph: {
    title: "Photo Import",
    description:
      "Browse, preview, and import photos from your SD card into Apple Photos.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-neutral-950 text-neutral-100">
        {children}
      </body>
    </html>
  );
}
