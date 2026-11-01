import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cutlume — Replay product demos after UI changes",
  description:
    "Record a product workflow once, replay it after UI changes, and create a captioned, branded demo video. Early prototype: verify compatibility with your app before relying on it.",
  applicationName: "Cutlume",
};

export const viewport: Viewport = {
  themeColor: "#090b12",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}