import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "katex/dist/katex.min.css";
import "./globals.css";

export const metadata: Metadata = { title: "EduQuas", description: "Portal ujian EduQuas" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id"><body>{children}</body></html>;
}
