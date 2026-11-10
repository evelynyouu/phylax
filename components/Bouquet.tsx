"use client";

import { useEffect, useRef } from "react";
import { createBloom, type Bloom, type BloomItem } from "@/lib/bloom";

/**
 * The 3D bouquet canvas. Loaded with next/dynamic (ssr: false) because it needs WebGL.
 * Rendering pauses while the canvas is off screen or the tab is hidden, and everything is
 * disposed on unmount. If WebGL is unavailable, onFail fires and the page shows a fallback.
 */
export default function Bouquet({
  items,
  label,
  interactive,
  onReady,
  onFail,
  onHover,
  onPrune,
}: {
  items: BloomItem[];
  label: string;
  interactive: boolean;
  onReady: (b: Bloom | null) => void;
  onFail: () => void;
  onHover: (id: string | null) => void;
  onPrune: (id: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Latest callbacks without re-creating the WebGL scene.
  const cbs = useRef({ onReady, onFail, onHover, onPrune });
  useEffect(() => {
    cbs.current = { onReady, onFail, onHover, onPrune };
  });

  useEffect(() => {
    const box = host.current;
    if (!box) return;
    // A fresh canvas per mount: dispose() releases its WebGL context for good, so a remount
    // (React StrictMode in development, or navigating back) must not reuse the old element.
    const el = document.createElement("canvas");
    el.className = "bloom-canvas";
    el.setAttribute("role", "img");
    el.setAttribute("aria-label", label);
    box.appendChild(el);
    canvasRef.current = el;
    el.style.pointerEvents = "none";
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const bloom = createBloom(
      el,
      items,
      { onHover: (id) => cbs.current.onHover(id), onPrune: (id) => cbs.current.onPrune(id) },
      { reduceMotion }
    );
    if (!bloom) {
      el.remove();
      cbs.current.onFail();
      return;
    }
    cbs.current.onReady(bloom);

    let onScreen = true;
    const sync = () => (onScreen && !document.hidden ? bloom.resume() : bloom.pause());
    const io = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      sync();
    });
    io.observe(el);
    document.addEventListener("visibilitychange", sync);

    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", sync);
      cbs.current.onReady(null);
      bloom.dispose();
      el.remove();
      canvasRef.current = null;
    };
    // label is fixed copy; items is a module constant.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  useEffect(() => {
    if (canvasRef.current) canvasRef.current.style.pointerEvents = interactive ? "auto" : "none";
  }, [interactive]);

  return <div ref={host} className="bloom-host" />;
}
