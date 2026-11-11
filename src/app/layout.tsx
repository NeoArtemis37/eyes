import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AES CERT · Cyberenseignement",
  description:
    "AES CERT · système de cyberenseignement : surveillance OSINT, threat intelligence et commandes vocales pour apprendre la cybersécurité en conditions réelles.",
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90' fill='%2335e0ff'>◉</text></svg>",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning className="dark">
      <body className={`${geistMono.variable} antialiased bg-[#0a0a0f] text-gray-300 overflow-hidden`}>
        {children}
      </body>
    </html>
  );
}
