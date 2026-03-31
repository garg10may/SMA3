import type { Metadata } from "next";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "SMA3 | Brief to Post",
  description:
    "Turn a rough topic or short brief into a concise X-ready post with OpenAI.",
};

const rootClassName = [
  spaceGrotesk.variable,
  ibmPlexMono.variable,
  "h-full antialiased",
].join(" ");

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={rootClassName}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
