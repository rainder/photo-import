import Image from "next/image";
import Link from "next/link";
import { currentVersion } from "@/content/changelog";
import ScreenshotCarousel from "./components/ScreenshotCarousel";

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
      "Navigate, select, preview, and import — all without touching the mouse. Full native macOS menu with shortcuts.",
    icon: "⌨️",
  },
  {
    title: "GPX Geotagging",
    description:
      "Drop GPX files to auto-match photos by timestamp. GPS coordinates are written to EXIF on import.",
    icon: "📍",
  },
  {
    title: "Burst Grouping",
    description:
      "Burst photos collapse into a single thumbnail. Expand in preview with a filmstrip to pick your best shot.",
    icon: "🎞️",
  },
  {
    title: "Smart Detection",
    description:
      "Automatically detects duplicates, timelapses, and panoramas with color-coded badges on thumbnails.",
    icon: "🔍",
  },
  {
    title: "Import to Photos.app",
    description:
      "Selected photos go straight into Apple Photos. Optionally delete originals from the SD card after import.",
    icon: "📸",
  },
  {
    title: "Full Map View",
    description:
      "Toggle a map showing all geotagged photos as pins with GPX track overlay. Click to jump to any photo.",
    icon: "🗺️",
  },
  {
    title: "Timeline & Histograms",
    description:
      "See photo density over time and exposure distribution (ISO, aperture, shutter) at a glance.",
    icon: "📊",
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
  { keys: "⌘ ⌫", action: "Delete focused" },
  { keys: "⌘ +/−", action: "Zoom grid" },
  { keys: "⌘ M", action: "Toggle map view" },
  { keys: "⌘ B", action: "Group bursts" },
  { keys: "⌘ I", action: "Toggle info panel" },
  { keys: "⌘ T", action: "Toggle timeline" },
  { keys: "⌘ G", action: "Load GPX file" },
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
          I got tired of every photo import app being either slow, clunky, or
          built for someone who doesn&apos;t use a keyboard. So I built the one
          I actually wanted — fast, keyboard-driven, and laser-focused on
          getting photos from your SD card into Apple Photos without the
          nonsense.
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

      {/* Screenshots */}
      <section className="px-6 py-20 max-w-5xl mx-auto w-full">
        <h2 className="text-2xl font-bold text-center mb-12 text-neutral-200">
          See it in action
        </h2>
        <ScreenshotCarousel />
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

      {/* Support */}
      <section className="px-6 py-16 max-w-md mx-auto w-full text-center">
        <p className="text-sm text-neutral-500 mb-4">
          If this app saved you some headaches, you can buy me a coffee.
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          {/* TODO: Replace # with your Buy Me a Coffee URL */}
          {/*
          <a
            href="https://buymeacoffee.com/yourusername"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-neutral-800 text-sm text-neutral-400 hover:text-neutral-200 hover:border-neutral-600 transition-colors"
          >
            ☕ Buy Me a Coffee
          </a>
          */}
          <a
            href="bitcoin:bc1ql4sjy9h60ea22rncaqn95zergef3mp62tjxgxf4wfljgz2dgs93sle6ptc"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-neutral-800 text-sm text-neutral-400 hover:text-neutral-200 hover:border-neutral-600 transition-colors"
          >
            ₿ Bitcoin
          </a>
          <a
            href="lightning:purpleparrot1@primal.net"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-neutral-800 text-sm text-neutral-400 hover:text-neutral-200 hover:border-neutral-600 transition-colors"
          >
            ⚡ Lightning
          </a>
        </div>
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
