import type { Metadata } from "next";
import { Geist, Geist_Mono, Montserrat } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "./context/LanguageContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-montserrat",
});

export const metadata: Metadata = {
  title: "Netra AI — Clinical Retinopathy Diagnosis Portal",
  description: "AI-powered diabetic retinopathy staging and multimodal diagnostic interface.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${montserrat.variable} ${montserrat.className} h-screen antialiased`}
      suppressHydrationWarning
    >
      <body className={`${montserrat.className} h-screen w-screen bg-black text-white overflow-hidden select-none`}>
        <LanguageProvider>
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
