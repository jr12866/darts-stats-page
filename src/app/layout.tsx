import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DartLeague",
  description: "Track dart league standings, high scores and awards.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <header className="pub-header sticky top-0 z-20">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3">
            <Link href="/" className="group flex items-center gap-2.5">
              <span
                className="clover text-xl leading-none transition-transform group-hover:rotate-12"
                aria-hidden="true"
              >
                ☘
              </span>
              <span className="brass-text text-lg font-bold tracking-wide">
                DartLeague
              </span>
            </Link>
            <p className="hidden text-xs uppercase tracking-widest text-muted sm:block">
              Scorecards &amp; Standing
            </p>
          </div>
        </header>

        {children}

        <footer className="mt-auto border-t border-border bg-surface/60">
          <div className="mx-auto w-full max-w-6xl px-4 py-6">
            <p className="text-center text-xs text-muted">
              <span className="clover" aria-hidden="true">
                ☘
              </span>{" "}
              Sláinte — DartLeague
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
