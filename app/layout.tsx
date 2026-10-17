import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cutlume — Make your product feel like a launch",
  description:
    "Turn real product recordings into cinematic launch-video storyboards, guided by the visual style you love.",
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