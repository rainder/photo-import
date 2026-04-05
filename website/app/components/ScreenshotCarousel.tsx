"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

const screenshots = [
  {
    src: "/screenshots/0.1.0-1.png",
    alt: "Photo Import grid view — browse and select photos from your SD card",
  },
  {
    src: "/screenshots/0.1.0-2.png",
    alt: "Photo Import preview mode — full-size photo preview with keyboard navigation",
  },
  {
    src: "/screenshots/0.1.0-3.png",
    alt: "Photo Import review screen — confirm selection before importing",
  },
];

const INTERVAL = 5000;
const TRANSITION_MS = 700;

export default function ScreenshotCarousel() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const advance = useCallback(() => {
    setActive((i) => (i + 1) % screenshots.length);
  }, []);

  useEffect(() => {
    if (paused) return;
    timerRef.current = setInterval(advance, INTERVAL);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [paused, advance]);

  const goTo = (i: number) => {
    setActive(i);
    // Reset timer on manual navigation
    if (timerRef.current) clearInterval(timerRef.current);
    if (!paused) {
      timerRef.current = setInterval(advance, INTERVAL);
    }
  };

  return (
    <div
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Image container */}
      <div className="relative aspect-[16/10] rounded-2xl overflow-hidden border border-neutral-800 shadow-2xl shadow-black/50 bg-neutral-900">
        {screenshots.map((shot, i) => (
          <div
            key={shot.src}
            className="absolute inset-0"
            style={{
              opacity: i === active ? 1 : 0,
              transition: `opacity ${TRANSITION_MS}ms ease-in-out`,
              pointerEvents: i === active ? "auto" : "none",
            }}
          >
            <Image
              src={shot.src}
              alt={shot.alt}
              fill
              className="object-cover object-top"
              sizes="(max-width: 1024px) 100vw, 1024px"
              priority={i === 0}
            />
          </div>
        ))}
      </div>

      {/* Dots */}
      <div className="flex items-center justify-center gap-2 mt-6">
        {screenshots.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            aria-label={`Screenshot ${i + 1}`}
            className="group p-1"
          >
            <span
              className={`block rounded-full transition-all duration-300 ${
                i === active
                  ? "w-6 h-2 bg-white/80"
                  : "w-2 h-2 bg-white/20 group-hover:bg-white/40"
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
