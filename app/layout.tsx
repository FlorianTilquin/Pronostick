import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pronostick",
  description: "Pronostics Coupe du Monde entre amis"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
