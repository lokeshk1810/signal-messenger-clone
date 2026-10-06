import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Signal Messenger",
  description: "Secure Messaging Platform - Signal Clone",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-canvas text-white antialiased h-screen w-screen overflow-hidden select-none">
        {children}
      </body>
    </html>
  );
}
