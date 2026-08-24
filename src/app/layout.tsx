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
  title: "High-Performance 3D Interface",
  description: "A responsive, high-performance 3D interface built with Next.js, R3F, Framer Motion, and Tailwind CSS.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-screen antialiased`}
      suppressHydrationWarning
    >
      <body className="h-screen w-screen bg-black text-white overflow-hidden select-none">
        {children}
      </body>
    </html>
  );
}
