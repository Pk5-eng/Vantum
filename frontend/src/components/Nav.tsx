"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Nav() {
  const pathname = usePathname();

  return (
    <header className="border-b border-border sticky top-0 z-50 bg-bg/80 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/rooms" className="text-lg font-semibold tracking-tight">
          Vantum
        </Link>
        <nav className="flex items-center gap-6">
          <Link
            href="/rooms"
            className={`text-sm transition-colors ${
              pathname === "/rooms"
                ? "text-text"
                : "text-text-muted hover:text-text"
            }`}
          >
            Rooms
          </Link>
          <Link
            href="/connect"
            className={`text-sm transition-colors ${
              pathname === "/connect"
                ? "text-text"
                : "text-text-muted hover:text-text"
            }`}
          >
            Connect
          </Link>
        </nav>
      </div>
    </header>
  );
}
