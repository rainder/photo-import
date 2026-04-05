import type { Metadata } from "next";
import Link from "next/link";
import { changelog } from "@/content/changelog";

export const metadata: Metadata = {
  title: "Changelog — Photo Import",
  description: "Release history and version notes for Photo Import.",
};

export default function ChangelogPage() {
  return (
    <main className="flex flex-col max-w-2xl mx-auto px-6 py-16 w-full">
      <Link
        href="/"
        className="text-sm text-neutral-500 hover:text-neutral-300 transition-colors mb-8"
      >
        ← Back
      </Link>
      <h1 className="text-3xl font-bold tracking-tight mb-12">Changelog</h1>

      <div className="flex flex-col gap-12">
        {changelog.map((entry) => (
          <article key={entry.version} className="relative">
            <div className="flex items-baseline gap-3 mb-4">
              <h2 className="text-xl font-semibold text-neutral-100">
                v{entry.version}
              </h2>
              <time className="text-sm text-neutral-500">{entry.date}</time>
            </div>
            <ul className="space-y-2">
              {entry.changes.map((change, i) => (
                <li
                  key={i}
                  className="text-sm text-neutral-400 leading-relaxed pl-4 relative before:content-[''] before:absolute before:left-0 before:top-[0.6em] before:w-1.5 before:h-1.5 before:rounded-full before:bg-neutral-700"
                >
                  {change}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      <footer className="mt-16 pt-8 border-t border-neutral-800 text-center text-sm text-neutral-600">
        <Link href="/" className="hover:text-neutral-400 transition-colors">
          Photo Import
        </Link>
      </footer>
    </main>
  );
}
