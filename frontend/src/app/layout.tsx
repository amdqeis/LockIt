import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LockIt — Platform Ujian Online dengan Proctoring",
  description: "Platform ujian online dengan sistem proctoring real-time untuk memastikan integritas akademik.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
