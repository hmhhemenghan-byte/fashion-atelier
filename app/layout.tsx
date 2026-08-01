import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NÉRA ATELIER — Second Skin 2027",
  description: "NÉRA ATELIER 2027 秋冬高级时装系列：结构、流动与身体边界。",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
