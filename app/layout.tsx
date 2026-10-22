import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Studio Admin | Humor Project",
  description: "Private administration for the Humor Project media database.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
