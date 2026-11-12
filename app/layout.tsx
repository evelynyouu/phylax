import type { Metadata } from "next";
import { Gloock, Hanken_Grotesk } from "next/font/google";
import "./globals.css";
import "./ui.css";
import "./pages.css";

const gloock = Gloock({ weight: "400", subsets: ["latin"], variable: "--font-gloock", display: "swap" });
const hanken = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-hanken", display: "swap" });

export const metadata: Metadata = {
  title: "Phylax",
  description: "Recurring charges, upcoming payments, and deadlines found in your email.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${gloock.variable} ${hanken.variable}`}>
      <body>{children}</body>
    </html>
  );
}
