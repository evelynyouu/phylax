"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Bloom } from "@/lib/bloom";
import { heroLayers, SAMPLE, scrollProgress, yearlyOf } from "@/lib/hero";

const Bouquet = dynamic(() => import("./Bouquet"), { ssr: false, loading: () => null });

const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

export default function LandingHero({ sampleHref, sampleLabel }: { sampleHref: string; sampleLabel: string }) {
  const section = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const bloom = useRef<Bloom | null>(null);
  const [p, setP] = useState(0);
  const [forced, setForced] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const [pruned, setPruned] = useState<string[]>([]);
  const [noGL, setNoGL] = useState(false);

  const eff = forced ? 1 : p;
  const L = heroLayers(eff);

  const onScroll = useCallback(() => {
    const s = section.current;
    const st = stage.current;
    if (!s || !st) return;
    const r = s.getBoundingClientRect();
    const next = scrollProgress(r.top, r.height, st.clientHeight);
    if (next > 0.02) setForced(false);
    setP((prev) => (Math.abs(next - prev) > 0.004 || next === 0 || next === 1 ? next : prev));
  }, []);

  useEffect(() => {
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [onScroll]);

  useEffect(() => {
    bloom.current?.setProgress(eff);
  }, [eff]);

  const onReady = useCallback(
    (b: Bloom | null) => {
      bloom.current = b;
      b?.setProgress(eff);
    },
    // eff is read once at mount; later changes go through the effect above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  const onFail = useCallback(() => setNoGL(true), []);
  const onPrune = useCallback((id: string) => {
    setPruned((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setHover(id);
  }, []);

  function prune(id: string) {
    if (bloom.current) bloom.current.prune(id);
    else onPrune(id);
  }

  function regrow() {
    bloom.current?.regrow();
    setPruned([]);
    setHover(null);
  }

  function dive() {
    const s = section.current;
    const st = stage.current;
    if (!s || !st) return;
    const before = window.scrollY;
    const r = s.getBoundingClientRect();
    const target = window.scrollY + r.top + (r.height - st.clientHeight) * 0.6;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: target, behavior: reduce ? "auto" : "smooth" });
    // If the page could not scroll (short viewport), jump straight to the close-up.
    setTimeout(() => {
      if (Math.abs(window.scrollY - before) < 4) setForced(true);
    }, 450);
  }

  const kept = SAMPLE.filter((s) => !pruned.includes(s.id));
  const gone = SAMPLE.filter((s) => pruned.includes(s.id));
  const keptYear = kept.reduce((a, s) => a + yearlyOf(s), 0);
  const savedYear = gone.reduce((a, s) => a + yearlyOf(s), 0);
  const hov = SAMPLE.find((s) => s.id === hover);
  let kicker = "Point at a petal";
  let name = "Every petal is a subscription";
  let price = "Netflix, Spotify, ChatGPT and twelve more.";
  if (hov) {
    const isGone = pruned.includes(hov.id);
    kicker = isGone ? "Cancelled" : hov.trial ? "Free trial, converts soon" : "Subscription";
    name = hov.name;
    price = `${usd(hov.amt)} a ${hov.per}${hov.per === "month" ? `, ${usd(hov.amt * 12)} a year` : ""}${isGone ? ". Saved." : ""}`;
  }

  return (
    <section id="scrolly" ref={section} aria-labelledby="hero-h" className="scrolly">
      <div ref={stage} className="stage">
        {!noGL && (
          <Bouquet
            items={SAMPLE}
            label="A 3D bouquet with small bluebirds flying past. Each outer petal of the pink peony is one subscription from a sample inbox."
            interactive={L.interactive}
            onReady={onReady}
            onFail={onFail}
            onHover={setHover}
            onPrune={onPrune}
          />
        )}

        <div className="intro-layer">
          <div className="intro" style={{ opacity: L.introOpacity, transform: `translateY(${L.introShift}px)` }}>
            <h1 id="hero-h">Prune what you forgot you planted.</h1>
            <p className="intro-lede">
              Subwatch reads the receipts, renewal notices and bills in your Gmail, then shows every subscription, every upcoming charge and the
              link to cancel, in one place.
            </p>
            <div className="intro-actions" style={{ pointerEvents: L.introClickable ? "auto" : "none" }}>
              <a className="btn btn-primary" href="/signup" tabIndex={L.introClickable ? undefined : -1}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <path d="M3 7l9 6 9-6" />
                </svg>
                Connect Gmail
              </a>
              <a className="btn btn-ghost btn-glass" href={sampleHref} tabIndex={L.introClickable ? undefined : -1}>
                {sampleLabel}
              </a>
            </div>
            <p className="ro-note">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <rect x="5" y="11" width="14" height="10" rx="2" />
                <path d="M8 11V7a4 4 0 0 1 8 0v4" />
              </svg>
              Read-only access. Subwatch can&apos;t send, change or delete mail.
            </p>
          </div>
        </div>

        <button
          type="button"
          className="btn btn-light cue"
          onClick={dive}
          style={{ opacity: L.cueOpacity, pointerEvents: L.introClickable ? "auto" : "none" }}
          tabIndex={L.introClickable ? undefined : -1}
        >
          Scroll to hold the bouquet
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M12 5v14M6 13l6 6 6-6" />
          </svg>
        </button>

        <div className="play-layer" style={{ opacity: L.playOpacity }} aria-hidden={L.playOpacity === 0 ? true : undefined}>
          <div className="play">
            <div className="play-top">
              <p className="play-hint">
                A sample inbox with 15 subscriptions. Drag to turn the bouquet, then select a petal on the pink peony to cancel that subscription.
              </p>
              {forced && (
                <button type="button" className="btn btn-light btn-row" style={{ pointerEvents: "auto" }} onClick={() => setForced(false)}>
                  Back to the intro
                </button>
              )}
            </div>
            <div className="play-bottom" style={{ pointerEvents: L.interactive ? "auto" : "none" }}>
              <div className="play-cards">
                <div aria-live="polite" className="readout-card">
                  <p>{kicker}</p>
                  <p className="display">{name}</p>
                  <p>{price}</p>
                </div>
                <div className="saved-card">
                  <p>Cancelled so far</p>
                  <p className="display">{usd(savedYear)} a year</p>
                  <div>
                    <span>
                      {kept.length} left, {usd(keptYear)} a year
                    </span>
                    {gone.length > 0 && (
                      <button type="button" className="btn btn-light btn-row" onClick={regrow} tabIndex={L.interactive ? undefined : -1}>
                        Regrow
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div role="group" aria-label="Subscriptions in the bouquet" className="pchips">
                {SAMPLE.map((s) => {
                  const on = pruned.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      className="pchip"
                      aria-pressed={on}
                      disabled={on}
                      tabIndex={L.interactive ? undefined : -1}
                      onClick={() => prune(s.id)}
                      onMouseEnter={() => setHover(s.id)}
                      onFocus={() => setHover(s.id)}
                    >
                      {s.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {noGL && <p className="nogl">The 3D bouquet needs WebGL, which this browser has turned off.</p>}
      </div>
    </section>
  );
}
