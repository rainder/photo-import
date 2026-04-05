import Image from "next/image";
import Link from "next/link";
import { currentVersion } from "@/content/changelog";

const DOWNLOAD_URL = `/releases/Photo-Import_${currentVersion.version}_aarch64.dmg`;

const features = [
  {
    title: "Auto-detect SD Cards",
    description:
      "Plug in your camera's SD card and Photo Import finds it automatically. No setup needed.",
    icon: "💾",
  },
  {
    title: "Keyboard-First",
    description:
      "Navigate, select, preview, and import — all without touching the mouse. Arrow keys, Space, Enter, and more.",
    icon: "⌨️",
  },
  {
    title: "Quick Preview",
    description:
      "Full-size preview with left/right navigation. Select photos for import without leaving preview mode.",
    icon: "🔍",
  },
  {
    title: "Import to Photos.app",
    description:
      "Selected photos go straight into Apple Photos. Optionally delete originals from the SD card after import.",
    icon: "📸",
  },
  {
    title: "Date-Grouped Grid",
    description:
      "Photos organized by date with section headers. Select entire days at once or pick individual shots.",
    icon: "📅",
  },
  {
    title: "Review Before Import",
    description:
      "A dedicated review screen lets you double-check your selection before committing to the import.",
    icon: "✅",
  },
];

const shortcuts = [
  { keys: "← → ↑ ↓", action: "Navigate grid" },
  { keys: "Space", action: "Select / deselect" },
  { keys: "Enter", action: "Open preview" },
  { keys: "⌘ Enter", action: "Review & import" },
  { keys: "⌘ ⌫", action: "Delete photo" },
  { keys: "⌘ +/−", action: "Zoom grid" },
  { keys: "⌘ A", action: "Select all" },
  { keys: "⌘ R", action: "Reload" },
];

export default function Home() {
  return (
    <main className="flex flex-col">
      {/* Hero */}
      <section className="flex flex-col items-center justify-center px-6 pt-24 pb-20">
        <Image
          src="/app-icon.svg"
          alt="Photo Import icon"
          width={120}
          height={120}
          className="rounded-[26px] mb-8 shadow-2xl shadow-indigo-500/20"
          priority
        />
        <h1 className="text-5xl font-bold tracking-tight text-center bg-gradient-to-b from-white to-neutral-400 bg-clip-text text-transparent">
          Photo Import
        </h1>
        <p className="mt-4 text-lg text-neutral-400 text-center max-w-xl">
          Browse, preview, and import photos from your camera&apos;s SD card
          directly into Apple Photos. Fast, keyboard-driven, and native.
        </p>
        <div className="flex items-center gap-4 mt-8">
          <a
            href={DOWNLOAD_URL}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors"
          >
            Download for macOS
            <span className="text-indigo-200 text-sm font-normal">
              v{currentVersion.version}
            </span>
          </a>
          <Link
            href="/changelog"
            className="text-sm text-neutral-500 hover:text-neutral-300 transition-colors"
          >
            Changelog →
          </Link>
        </div>
        <p className="mt-3 text-xs text-neutral-600">
          Requires macOS 12+. Apple Silicon.
        </p>
      </section>

      {/* Features */}
      <section className="px-6 py-20 max-w-5xl mx-auto w-full">
        <h2 className="text-2xl font-bold text-center mb-12 text-neutral-200">
          Everything you need, nothing you don&apos;t
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="p-6 rounded-2xl border border-neutral-800 bg-neutral-900/50 hover:border-neutral-700 transition-colors"
            >
              <span className="text-2xl">{feature.icon}</span>
              <h3 className="mt-3 font-semibold text-neutral-100">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm text-neutral-400 leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Keyboard shortcuts */}
      <section className="px-6 py-20 max-w-2xl mx-auto w-full">
        <h2 className="text-2xl font-bold text-center mb-12 text-neutral-200">
          Keyboard shortcuts
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {shortcuts.map((s) => (
            <div
              key={s.keys}
              className="flex items-center justify-between px-4 py-3 rounded-xl border border-neutral-800 bg-neutral-900/50"
            >
              <span className="text-sm text-neutral-400">{s.action}</span>
              <kbd className="px-2 py-1 rounded-md bg-neutral-800 text-xs font-mono text-neutral-300">
                {s.keys}
              </kbd>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-20 text-center">
        <h2 className="text-3xl font-bold bg-gradient-to-b from-white to-neutral-400 bg-clip-text text-transparent">
          Ready to import?
        </h2>
        <p className="mt-3 text-neutral-400">
          Download Photo Import and start managing your photos faster.
        </p>
        <a
          href={DOWNLOAD_URL}
          className="inline-flex items-center gap-2 mt-6 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors"
        >
          Download for macOS
        </a>
      </section>

      {/* Footer */}
      <footer className="px-6 py-8 border-t border-neutral-800 text-center text-sm text-neutral-600">
        <div className="flex items-center justify-center gap-4">
          <span>Photo Import v{currentVersion.version}</span>
          <span>·</span>
          <Link
            href="/changelog"
            className="hover:text-neutral-400 transition-colors"
          >
            Changelog
          </Link>
        </div>
      </footer>
    </main>
  );
}
