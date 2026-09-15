import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Spark — SPARK your creativity",
  description: "Turn your ideas into Roblox games with an AI building partner.",
  icons: { icon: "/favicon.svg?v=3" },
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
