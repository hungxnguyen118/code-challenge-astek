import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Asset Sheet Parser",
  description: "Make sense of messy IT asset spreadsheets — in your browser.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
