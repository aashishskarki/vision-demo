import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vision — AI Visibility Demo",
  description:
    "See how AI answer engines (ChatGPT, Gemini, Perplexity, Google AI) talk about your brand versus your competitors.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
