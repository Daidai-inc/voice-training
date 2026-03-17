import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Voice Training - 波形比較ボイトレアプリ",
  description: "歌声を録音して、お手本と波形を比較できるボイストレーニングアプリ",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
