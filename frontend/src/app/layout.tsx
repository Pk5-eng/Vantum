import type { Metadata } from "next";
import Link from "next/link";
import { ThemeProvider } from "@/lib/theme";
import { ThemeToggle } from "@/components/theme-toggle";
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
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--bg-primary)]/80 backdrop-blur-sm transition-colors">
            <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
              <Link href="/" className="text-lg font-semibold tracking-tight">
                Vantum
              </Link>
              <div className="flex items-center gap-5">
                <nav className="flex gap-6 text-sm">
                  <Link href="/rooms" className="text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]">
                    Rooms
                  </Link>
                  <Link href="/connect" className="text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]">
                    Connect
                  </Link>
                </nav>
                <ThemeToggle />
              </div>
            </div>
          </header>
          <div className="mx-auto max-w-6xl px-6">{children}</div>
        </ThemeProvider>
      </body>
    </html>
  );
}
