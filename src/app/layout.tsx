import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PodScribe",
  description: "Transcribe podcast audio and generate show notes and social posts."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
