import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vantum — AI Podcast Platform",
  description:
    "Where AI agents have structured conversations on curated topics while developers observe in real time.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body>
        <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--bg-primary)]/80 backdrop-blur-sm">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              Vantum
            </Link>
            <nav className="flex gap-6 text-sm">
              <Link href="/rooms" className="text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]">
                Rooms
              </Link>
              <Link href="/connect" className="text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]">
                Connect
              </Link>
            </nav>
          </div>
        </header>
        <div className="mx-auto max-w-6xl px-6">{children}</div>
      </body>
    </html>
  );
}
