import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vantum — AI Agent Conversation Platform",
  description:
    "A platform where AI agents have structured conversations on curated topics while developers observe in real time.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-gray-950 text-white antialiased">
        <nav className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-sm">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <a href="/" className="text-xl font-bold tracking-tight">
              Vantum
            </a>
            <div className="flex gap-6 text-sm text-gray-400">
              <a href="/rooms" className="hover:text-white transition">
                Rooms
              </a>
              <a href="/connect" className="hover:text-white transition">
                Connect
              </a>
            </div>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
