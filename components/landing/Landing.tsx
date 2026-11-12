"use client";

// The landing page from the "Phylax Mockup.html" design export (Home page), converted to JSX.
// Styles live in app/landing.css; the canvases, receipt and section paging run from ./motion.js.
import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { money, SUBS } from "./data";
import { LandingMotion } from "./motion";

const BAR_H = [30, 18, 62, 22, 14, 40, 26, 90, 20, 34, 16, 48, 28, 70, 18, 24, 52, 12, 36, 44, 20, 58, 16, 30];
const bars = BAR_H.map((v, i) => ({ h: v, c: v > 60 ? "#D8959B" : i % 3 === 0 ? "#829672" : "#D0DBE7" }));
const MARKS: Record<number, string> = {
  1: "#829672",
  4: "#D8959B",
  8: "#829672",
  11: "#D0DBE7",
  13: "#829672",
  17: "#D8959B",
  19: "#829672",
  20: "#D0DBE7",
  24: "#829672",
  27: "#D8959B",
  30: "#829672",
};
const cal = Array.from({ length: 35 }, (_, d) => ({ c: MARKS[d] || "#F1ECEF" }));
const lines = SUBS.map(([name, cad, amt, flag]) => ({ name, cad, amt, amtText: money(amt), flag, flagged: flag ? 1 : 0 }));
const total = lines.reduce((s, l) => s + l.amt, 0);
const flagCount = lines.filter((l) => l.flagged).length;
const lineCount = lines.length;
const totalText = money(total);
const monthText = money(total / 12);
const receiptAria = `A receipt listing ${lineCount} subscriptions found in a year of billing email, totaling $${totalText}, with ${flagCount} flagged for a second look.`;

export default function Landing() {
  const [run, setRun] = useState(0);
  const motion = useRef<LandingMotion | null>(null);
  useEffect(() => {
    const m = new LandingMotion();
    motion.current = m;
    m.start();
    return () => {
      m.dispose();
      motion.current = null;
    };
  }, []);
  const blurClass = run % 2 ? "blur-b" : "blur-a";
  const fadeClass = run % 2 ? "fade-b" : "fade-a";
  const replay = () => {
    motion.current?.replay();
    setRun((r) => r + 1);
  };

  return (
    <div className="lp">
      <div id="page" style={{ boxSizing: "border-box", width: "100%", overflowX: "clip" }}>
        <section
          id="hero"
          className="on-dark"
          aria-labelledby="hero-h"
          style={{
            position: "relative",
            height: "880px",
            overflow: "hidden",
            background: "linear-gradient(180deg, #6A8CB3 0%, #9AB4CD 45%, #D5DEE0 64%, #4C6B2C 75%, #F7F3F5 100%)",
          }}
        >
          <canvas
            id="meadow-hero"
            role="img"
            aria-label="A grass field dotted with dandelion clocks under a deep blue sky. Big white clouds drift overhead and the grass moves in the wind."
            style={{ position: "absolute", inset: "0", width: "100%", height: "100%", display: "block" }}
          />
          <div aria-hidden="true" className="scrim" style={{ position: "absolute", inset: "0", pointerEvents: "none" }} />
          <div
            aria-hidden="true"
            className="hero-fade"
            style={{ position: "absolute", left: "0", right: "0", bottom: "0", height: "170px", pointerEvents: "none" }}
          />

          <header
            className={fadeClass}
            style={{
              position: "relative",
              zIndex: "2",
              maxWidth: "1240px",
              margin: "0 auto",
              padding: "22px 24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "16px",
              flexWrap: "wrap",
              animationDelay: "1.3s",
            }}
          >
            <Link href="/" style={{ display: "flex", alignItems: "center", gap: "10px", textDecoration: "none", color: "#FFFFFF" }}>
              <span
                aria-hidden="true"
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "9px",
                  background: "#FFFFFF",
                  display: "grid",
                  placeItems: "center",
                  boxShadow: "0 4px 12px rgba(30,50,80,0.2)",
                }}
              >
                <svg width="22" height="22" viewBox="0 0 32 32">
                  <g fill="none" stroke="#344C3D" strokeWidth="2">
                    <path d="M16 16c-4-6-4-11 0-13 4 2 4 7 0 13z" fill="#D8959B" />
                    <path d="M16 16c6-4 11-4 13 0-2 4-7 4-13 0z" fill="#D0DBE7" />
                    <path d="M16 16c4 6 4 11 0 13-4-2-4-7 0-13z" fill="#E3DADE" />
                    <path d="M16 16c-6 4-11 4-13 0 2-4 7-4 13 0z" fill="#829672" />
                  </g>
                </svg>
              </span>
              <span style={{ fontWeight: "600", fontSize: "18px" }}>Phylax</span>
            </Link>
            <nav aria-label="Main" style={{ display: "flex", alignItems: "center", gap: "24px" }}>
              <a className="nl navx" href="#how" style={{ fontSize: "14px", fontWeight: "500", color: "#FFFFFF" }}>
                How it works
              </a>
              <a className="nl navx" href="#privacy" style={{ fontSize: "14px", fontWeight: "500", color: "#FFFFFF" }}>
                Privacy
              </a>
              <Link className="nl navx" href="/signin" style={{ fontSize: "14px", fontWeight: "500", color: "#FFFFFF" }}>
                Sign in
              </Link>
              <Link
                className="w-btn"
                href="/signup"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  minHeight: "40px",
                  padding: "0 18px",
                  borderRadius: "999px",
                  background: "#FFFFFF",
                  color: "#1E2B22",
                  fontSize: "14px",
                  fontWeight: "600",
                  textDecoration: "none",
                }}
              >
                Get started
              </Link>
            </nav>
          </header>

          <div
            id="hero-copy"
            style={{ position: "relative", zIndex: "2", maxWidth: "1240px", margin: "0 auto", padding: "64px 24px 0", willChange: "transform" }}
          >
            <h1
              id="hero-h"
              style={{
                margin: "0",
                maxWidth: "11em",
                fontFamily: "var(--font-gloock), Georgia, serif",
                fontWeight: "400",
                fontSize: "clamp(50px, 6.6vw, 94px)",
                lineHeight: "1.02",
                letterSpacing: "-0.01em",
                color: "#FFFFFF",
                textShadow: "0 2px 30px rgba(24,42,66,0.32)",
              }}
            >
              <span className={blurClass} style={{ display: "inline-block", animationDelay: "0.95s" }}>
                Prune
              </span>{" "}
              <span className={blurClass} style={{ display: "inline-block", animationDelay: "1.03s" }}>
                what
              </span>{" "}
              <span className={blurClass} style={{ display: "inline-block", animationDelay: "1.11s" }}>
                you
              </span>{" "}
              <span className={blurClass} style={{ display: "inline-block", animationDelay: "1.19s" }}>
                forgot
              </span>{" "}
              <span className={blurClass} style={{ display: "inline-block", animationDelay: "1.27s" }}>
                you
              </span>{" "}
              <span
                className={blurClass}
                aria-hidden="true"
                style={{ display: "inline-block", verticalAlign: "-0.1em", margin: "0 0.06em", animationDelay: "1.35s" }}
              >
                <span
                  style={{
                    position: "relative",
                    display: "grid",
                    placeItems: "center",
                    width: "0.86em",
                    height: "0.86em",
                    borderRadius: "0.22em",
                    background: "#FFFFFF",
                    transform: "rotate(-7deg)",
                    boxShadow: "0 8px 22px rgba(28,46,76,0.28)",
                  }}
                >
                  <svg width="62%" height="62%" viewBox="0 0 32 32">
                    <g fill="none" stroke="#344C3D" strokeWidth="2">
                      <path d="M16 16c-4-6-4-11 0-13 4 2 4 7 0 13z" fill="#D8959B" />
                      <path d="M16 16c6-4 11-4 13 0-2 4-7 4-13 0z" fill="#D0DBE7" />
                      <path d="M16 16c4 6 4 11 0 13-4-2-4-7 0-13z" fill="#E3DADE" />
                      <path d="M16 16c-6 4-11 4-13 0 2-4 7-4 13 0z" fill="#829672" />
                    </g>
                  </svg>
                  <span
                    style={{
                      position: "absolute",
                      right: "-0.08em",
                      top: "-0.08em",
                      width: "0.22em",
                      height: "0.22em",
                      borderRadius: "50%",
                      background: "#D8959B",
                      boxShadow: "0 0 0 0.05em #FFFFFF",
                    }}
                  />
                </span>
              </span>{" "}
              <span className={blurClass} style={{ display: "inline-block", animationDelay: "1.43s" }}>
                planted.
              </span>
            </h1>
            <p
              className={blurClass}
              style={{
                margin: "24px 0 0",
                maxWidth: "29em",
                fontSize: "18px",
                lineHeight: "1.55",
                color: "#FFFFFF",
                textShadow: "0 1px 14px rgba(24,42,66,0.45)",
                animationDelay: "1.55s",
              }}
            >
              Phylax reads the receipts and renewals in your Gmail and shows every subscription, when it renews, and where to cancel.
            </p>
            <div className={blurClass} style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "28px", animationDelay: "1.67s" }}>
              <Link
                className="w-btn"
                href="/signup"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "10px",
                  minHeight: "50px",
                  padding: "0 24px",
                  borderRadius: "999px",
                  background: "#FFFFFF",
                  color: "#1E2B22",
                  fontWeight: "600",
                  fontSize: "16px",
                  textDecoration: "none",
                  boxShadow: "0 10px 24px rgba(28,46,76,0.22)",
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <path d="M3 7l9 6 9-6" />
                </svg>
                Connect Gmail
              </Link>
            </div>
          </div>

          <a
            className={`${fadeClass} lp-cue`}
            href="#year"
            style={{
              position: "absolute",
              zIndex: "2",
              left: "50%",
              bottom: "190px",
              transform: "translateX(-50%)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "8px",
              color: "#FFFFFF",
              textDecoration: "none",
              fontSize: "12px",
              fontWeight: "600",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              animationDelay: "2.1s",
            }}
          >
            <span>Scroll</span>
            <span aria-hidden="true" className="cue-line" />
          </a>
          <button
            type="button"
            className={`${fadeClass} g-btn`}
            onClick={replay}
            aria-label="Replay the intro"
            style={{
              position: "absolute",
              zIndex: "2",
              right: "24px",
              bottom: "190px",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              minHeight: "40px",
              padding: "0 14px",
              borderRadius: "999px",
              border: "1px solid rgba(255,255,255,0.6)",
              background: "rgba(30,43,34,0.22)",
              color: "#FFFFFF",
              font: "inherit",
              fontSize: "13px",
              fontWeight: "600",
              cursor: "pointer",
              animationDelay: "2.1s",
              WebkitBackdropFilter: "blur(6px)",
              backdropFilter: "blur(6px)",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
              <path d="M4 12a8 8 0 1 0 2.3-5.7" />
              <path d="M4 4v5h5" />
            </svg>
            Replay
          </button>
        </section>

        <section id="year" aria-labelledby="year-h" style={{ position: "relative", height: "900px", background: "#F7F3F5" }}>
          <div id="year-stage" style={{ position: "sticky", top: "0", height: "900px", overflow: "hidden" }}>
            <div
              style={{
                boxSizing: "border-box",
                height: "100%",
                maxWidth: "1240px",
                margin: "0 auto",
                padding: "0 24px",
                display: "grid",
                gridTemplateColumns: "minmax(0, 1.05fr) minmax(0, 0.95fr)",
                gap: "32px",
                alignItems: "center",
              }}
              className="year-grid"
            >
              <div id="year-copy" style={{ position: "relative", zIndex: "2" }}>
                <p
                  style={{
                    margin: "0",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "10px",
                    fontSize: "13px",
                    fontWeight: "600",
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: "#5E6B62",
                  }}
                >
                  <span aria-hidden="true" style={{ width: "8px", height: "8px", background: "#D8959B" }} />
                  Your year, printed
                </p>
                <h2
                  id="year-h"
                  style={{
                    margin: "16px 0 0",
                    fontFamily: "var(--font-gloock), Georgia, serif",
                    fontWeight: "400",
                    fontSize: "clamp(54px, 7.4vw, 118px)",
                    lineHeight: "0.94",
                    letterSpacing: "-0.02em",
                    color: "#1E2B22",
                  }}
                >
                  <span id="yh-1" style={{ display: "block", willChange: "transform, filter" }}>
                    A quick look
                  </span>
                  <span id="yh-2" style={{ display: "block", willChange: "transform, filter" }}>
                    at your year
                  </span>
                </h2>
                <dl id="year-stats" style={{ margin: "40px 0 0", display: "grid", gridTemplateColumns: "repeat(3, minmax(0, max-content))", gap: "18px 40px" }}>
                  <div>
                    <dt style={{ fontSize: "13px", color: "#5E6B62" }}>Subscriptions found</dt>
                    <dd
                      id="st-count"
                      style={{
                        margin: "4px 0 0",
                        fontFamily: "var(--font-gloock), Georgia, serif",
                        fontSize: "44px",
                        lineHeight: "1",
                        color: "#1E2B22",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      0
                    </dd>
                  </div>
                  <div>
                    <dt style={{ fontSize: "13px", color: "#5E6B62" }}>Paid this year</dt>
                    <dd
                      id="st-total"
                      style={{
                        margin: "4px 0 0",
                        fontFamily: "var(--font-gloock), Georgia, serif",
                        fontSize: "44px",
                        lineHeight: "1",
                        color: "#1E2B22",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      $0
                    </dd>
                  </div>
                  <div>
                    <dt style={{ fontSize: "13px", color: "#5E6B62" }}>Worth a second look</dt>
                    <dd
                      id="st-flag"
                      style={{
                        margin: "4px 0 0",
                        fontFamily: "var(--font-gloock), Georgia, serif",
                        fontSize: "44px",
                        lineHeight: "1",
                        color: "#93434C",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      0
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="year-right" style={{ position: "relative", height: "100%" }}>
                <div id="rc-wrap" style={{ position: "absolute", left: "50%", top: "70px", width: "360px", marginLeft: "-180px", willChange: "transform" }}>
                  <div
                    id="rc-printer"
                    aria-hidden="true"
                    style={{
                      position: "relative",
                      zIndex: "3",
                      height: "96px",
                      borderRadius: "26px 26px 16px 16px",
                      background: "linear-gradient(180deg, #46624F 0%, #344C3D 60%, #2C4133 100%)",
                      boxShadow: "0 24px 40px rgba(30,43,34,0.28), inset 0 1px 0 rgba(255,255,255,0.18)",
                    }}
                  >
                    <span
                      style={{
                        position: "absolute",
                        left: "22px",
                        top: "20px",
                        fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                        fontSize: "11px",
                        letterSpacing: "0.3em",
                        color: "rgba(247,243,245,0.7)",
                      }}
                    >
                      PHYLAX
                    </span>
                    <span
                      id="rc-led"
                      style={{
                        position: "absolute",
                        right: "24px",
                        top: "22px",
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        background: "#9FD08C",
                        boxShadow: "0 0 10px #9FD08C",
                      }}
                    />
                    <span
                      style={{
                        position: "absolute",
                        right: "42px",
                        top: "21px",
                        width: "26px",
                        height: "10px",
                        borderRadius: "5px",
                        background: "rgba(0,0,0,0.25)",
                      }}
                    />
                    <span
                      style={{
                        position: "absolute",
                        left: "18px",
                        right: "18px",
                        bottom: "16px",
                        height: "8px",
                        borderRadius: "4px",
                        background: "#16231A",
                        boxShadow: "inset 0 2px 3px rgba(0,0,0,0.6)",
                      }}
                    />
                  </div>
                  <div
                    id="rc-stub"
                    aria-hidden="true"
                    className="zig-down"
                    style={{ position: "relative", zIndex: "2", width: "316px", height: "14px", margin: "-20px auto 0", background: "#FBFAF6", opacity: "0" }}
                  />
                  <div
                    id="rc-clip"
                    style={{
                      position: "relative",
                      zIndex: "1",
                      width: "316px",
                      height: "0",
                      margin: "-34px auto 0",
                      overflow: "hidden",
                      transformOrigin: "50% 0",
                    }}
                  >
                    <div
                      id="rc-paper"
                      role="img"
                      aria-label={receiptAria}
                      style={{
                        background: "#FBFAF6",
                        padding: "36px 22px 0",
                        fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                        fontSize: "12px",
                        lineHeight: "1.5",
                        color: "#2B332D",
                        textTransform: "uppercase",
                        boxShadow: "inset 0 18px 18px -14px rgba(0,0,0,0.18)",
                      }}
                    >
                      <div aria-hidden="true">
                        <div style={{ textAlign: "center", fontSize: "15px", fontWeight: "600", letterSpacing: "0.24em" }}>PHYLAX</div>
                        <div style={{ textAlign: "center", marginTop: "2px", color: "#6B746D" }}>Annual inbox scan</div>
                        <div style={{ textAlign: "center", color: "#6B746D" }}>Nov 2025 to Nov 2026</div>
                        <div style={{ margin: "12px 0 8px", borderTop: "1px dashed #B9B6AE" }} />
                        <div style={{ display: "flex", justifyContent: "space-between", color: "#6B746D" }}>
                          <span>Item</span>
                          <span>Per year</span>
                        </div>
                        <div style={{ margin: "8px 0 6px", borderTop: "1px dashed #B9B6AE" }} />
                        {lines.map((ln, i) => (
                          <div key={i} className="rc-line" data-amt={ln.amt} data-flag={ln.flagged} style={{ padding: "3px 0" }}>
                            <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
                              <span style={{ whiteSpace: "nowrap" }}>{ln.name}</span>
                              <span style={{ flex: "1", borderBottom: "1px dotted #C9C5BC", transform: "translateY(-3px)" }} />
                              <span style={{ whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>${ln.amtText}</span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10.5px", color: "#8A918B" }}>
                              <span>{ln.cad}</span>
                              <span style={{ color: "#93434C" }}>{ln.flag}</span>
                            </div>
                          </div>
                        ))}
                        <div style={{ margin: "10px 0 8px", borderTop: "1px dashed #B9B6AE" }} />
                        <div className="rc-line" data-amt="0" data-flag="0" style={{ display: "flex", justifyContent: "space-between" }}>
                          <span>Subscriptions</span>
                          <span>{lineCount}</span>
                        </div>
                        <div className="rc-line" data-amt="0" data-flag="0" style={{ display: "flex", justifyContent: "space-between", color: "#93434C" }}>
                          <span>Flagged</span>
                          <span>{flagCount}</span>
                        </div>
                        <div
                          className="rc-line"
                          data-amt="0"
                          data-flag="0"
                          style={{ display: "flex", justifyContent: "space-between", marginTop: "6px", fontSize: "16px", fontWeight: "600" }}
                        >
                          <span>Total</span>
                          <span>${totalText}</span>
                        </div>
                        <div className="rc-line" data-amt="0" data-flag="0" style={{ textAlign: "center", marginTop: "4px", color: "#6B746D" }}>
                          That is ${monthText} a month
                        </div>
                        <div style={{ margin: "12px 0 10px", borderTop: "1px dashed #B9B6AE" }} />
                        <div
                          className="rc-line"
                          data-amt="0"
                          data-flag="0"
                          style={{
                            height: "38px",
                            background:
                              "repeating-linear-gradient(90deg, #2B332D 0 2px, transparent 2px 4px, #2B332D 4px 5px, transparent 5px 8px, #2B332D 8px 11px, transparent 11px 12px)",
                          }}
                        />
                        <div className="rc-line" data-amt="0" data-flag="0" style={{ textAlign: "center", marginTop: "8px", color: "#6B746D" }}>
                          Read from 1,284 emails
                        </div>
                        <div className="rc-line" data-amt="0" data-flag="0" style={{ textAlign: "center", paddingBottom: "26px" }}>
                          Keep what you use
                        </div>
                      </div>
                    </div>
                    <div aria-hidden="true" className="zig-down" style={{ height: "10px", background: "#FBFAF6" }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          id="how"
          aria-labelledby="how-h"
          style={{ position: "relative", background: "linear-gradient(180deg, #F7F3F5 0%, #EEF0E8 45%, #F7F3F5 100%)" }}
        >
          <div style={{ position: "relative", zIndex: "1", maxWidth: "1240px", margin: "0 auto", padding: "72px 24px 64px" }}>
            <p
              data-rv=""
              className="rvf"
              style={{
                margin: "0",
                display: "inline-flex",
                alignItems: "center",
                gap: "10px",
                fontSize: "13px",
                fontWeight: "600",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "#5E6B62",
              }}
            >
              <span aria-hidden="true" style={{ width: "8px", height: "8px", background: "#829672" }} />
              How it works
            </p>
            <h2
              id="how-h"
              data-rv=""
              className="rvt"
              style={{
                margin: "14px 0 0",
                fontFamily: "var(--font-gloock), Georgia, serif",
                fontWeight: "400",
                fontSize: "clamp(36px, 4.4vw, 60px)",
                lineHeight: "1.02",
                letterSpacing: "-0.01em",
                color: "#1E2B22",
              }}
            >
              <span className="ln">
                <span>Three steps from a messy inbox</span>
              </span>
              <span className="ln">
                <span style={{ "--d": "90ms" } as CSSProperties}>to a clear list.</span>
              </span>
            </h2>
            <ol className="lp-steps">
              <li data-rv="" className="rv" style={{ "--d": "0ms" } as CSSProperties}>
                <div
                  className="lp-card"
                  style={{
                    background: "#FFFFFF",
                    borderRadius: "26px",
                    padding: "12px",
                    boxShadow: "0 1px 0 rgba(30,43,34,0.04), 0 18px 40px rgba(52,76,61,0.10)",
                  }}
                >
                  <div style={{ height: "168px", borderRadius: "18px", background: "#F4F0E6", position: "relative", overflow: "hidden" }}>
                    <canvas id="dither-1" aria-hidden="true" style={{ position: "absolute", inset: "0", width: "100%", height: "100%" }} />
                    <span
                      style={{
                        position: "absolute",
                        left: "12px",
                        top: "12px",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "4px 9px",
                        borderRadius: "6px",
                        background: "#344C3D",
                        color: "#F4F0E6",
                        fontSize: "12px",
                        fontWeight: "600",
                        letterSpacing: "0.06em",
                      }}
                    >
                      01
                    </span>
                  </div>
                  <div style={{ padding: "18px 14px 14px" }}>
                    <h3 style={{ margin: "0", fontSize: "22px", fontWeight: "600", color: "#1E2B22" }}>Connect Gmail</h3>
                    <p style={{ margin: "8px 0 0", fontSize: "15px", lineHeight: "1.6", color: "#3F4D44" }}>
                      Sign in with Google and grant read-only access. Phylax only looks at billing emails: receipts, invoices, renewal notices and trial
                      reminders.
                    </p>
                    <div
                      style={{
                        marginTop: "16px",
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        padding: "10px 12px",
                        borderRadius: "14px",
                        background: "#F7F3F5",
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#344C3D" strokeWidth="2" aria-hidden="true">
                        <rect x="5" y="11" width="14" height="10" rx="2" />
                        <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                      </svg>
                      <span style={{ flex: "1", fontSize: "14px", fontWeight: "600", color: "#1E2B22" }}>Gmail access</span>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "3px 10px",
                          borderRadius: "999px",
                          background: "#E4EBDD",
                          color: "#344C3D",
                          fontSize: "12px",
                          fontWeight: "600",
                        }}
                      >
                        <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#829672" }} />
                        Read-only
                      </span>
                    </div>
                  </div>
                </div>
              </li>
              <li data-rv="" className="rv" style={{ "--d": "120ms" } as CSSProperties}>
                <div
                  className="lp-card"
                  style={{
                    background: "#FFFFFF",
                    borderRadius: "26px",
                    padding: "12px",
                    boxShadow: "0 1px 0 rgba(30,43,34,0.04), 0 18px 40px rgba(52,76,61,0.10)",
                  }}
                >
                  <div style={{ height: "168px", borderRadius: "18px", background: "#F4F0E6", position: "relative", overflow: "hidden" }}>
                    <canvas id="dither-2" aria-hidden="true" style={{ position: "absolute", inset: "0", width: "100%", height: "100%" }} />
                    <span
                      style={{
                        position: "absolute",
                        left: "12px",
                        top: "12px",
                        padding: "4px 9px",
                        borderRadius: "6px",
                        background: "#344C3D",
                        color: "#F4F0E6",
                        fontSize: "12px",
                        fontWeight: "600",
                        letterSpacing: "0.06em",
                      }}
                    >
                      02
                    </span>
                  </div>
                  <div style={{ padding: "18px 14px 14px" }}>
                    <h3 style={{ margin: "0", fontSize: "22px", fontWeight: "600", color: "#1E2B22" }}>We find what repeats</h3>
                    <p style={{ margin: "8px 0 0", fontSize: "15px", lineHeight: "1.6", color: "#3F4D44" }}>
                      Charges are matched to the company that sent them, grouped into subscriptions and bills, and checked for price changes and trials about to
                      convert.
                    </p>
                    <div style={{ marginTop: "16px", display: "flex", flexWrap: "wrap", gap: "6px" }}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "6px 10px",
                          borderRadius: "999px",
                          background: "#F7F3F5",
                          fontSize: "13px",
                          fontWeight: "600",
                          color: "#1E2B22",
                        }}
                      >
                        <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#D8959B" }} />
                        Netflix <span style={{ fontWeight: "500", color: "#5E6B62" }}>monthly</span>
                      </span>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "6px 10px",
                          borderRadius: "999px",
                          background: "#F7F3F5",
                          fontSize: "13px",
                          fontWeight: "600",
                          color: "#1E2B22",
                        }}
                      >
                        <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#829672" }} />
                        Adobe <span style={{ fontWeight: "500", color: "#5E6B62" }}>yearly</span>
                      </span>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "6px 10px",
                          borderRadius: "999px",
                          background: "#F7F3F5",
                          fontSize: "13px",
                          fontWeight: "600",
                          color: "#1E2B22",
                        }}
                      >
                        <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#9FB3CC" }} />
                        PG&amp;E <span style={{ fontWeight: "500", color: "#5E6B62" }}>bill</span>
                      </span>
                    </div>
                  </div>
                </div>
              </li>
              <li data-rv="" className="rv" style={{ "--d": "240ms" } as CSSProperties}>
                <div
                  className="lp-card"
                  style={{
                    background: "#FFFFFF",
                    borderRadius: "26px",
                    padding: "12px",
                    boxShadow: "0 1px 0 rgba(30,43,34,0.04), 0 18px 40px rgba(52,76,61,0.10)",
                  }}
                >
                  <div style={{ height: "168px", borderRadius: "18px", background: "#F4F0E6", position: "relative", overflow: "hidden" }}>
                    <canvas id="dither-3" aria-hidden="true" style={{ position: "absolute", inset: "0", width: "100%", height: "100%" }} />
                    <span
                      style={{
                        position: "absolute",
                        left: "12px",
                        top: "12px",
                        padding: "4px 9px",
                        borderRadius: "6px",
                        background: "#344C3D",
                        color: "#F4F0E6",
                        fontSize: "12px",
                        fontWeight: "600",
                        letterSpacing: "0.06em",
                      }}
                    >
                      03
                    </span>
                  </div>
                  <div style={{ padding: "18px 14px 14px" }}>
                    <h3 style={{ margin: "0", fontSize: "22px", fontWeight: "600", color: "#1E2B22" }}>Keep or cancel</h3>
                    <p style={{ margin: "8px 0 0", fontSize: "15px", lineHeight: "1.6", color: "#3F4D44" }}>
                      See what is due and when, then cancel straight from the link in the company&apos;s own email. Phylax warns you if a link points anywhere
                      else.
                    </p>
                    <div
                      style={{
                        marginTop: "16px",
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        padding: "10px 10px 10px 12px",
                        borderRadius: "14px",
                        background: "#F7F3F5",
                      }}
                    >
                      <span style={{ flex: "1", minWidth: "0", fontSize: "14px", fontWeight: "600", color: "#1E2B22" }}>
                        Hulu trial ends <span style={{ color: "#93434C" }}>in 3 days</span>
                      </span>
                      <span
                        style={{ padding: "5px 12px", borderRadius: "999px", background: "#F6E0E2", color: "#93434C", fontSize: "13px", fontWeight: "600" }}
                      >
                        Cancel
                      </span>
                    </div>
                  </div>
                </div>
              </li>
            </ol>
          </div>
        </section>

        <section id="see" aria-labelledby="see-h" style={{ position: "relative", maxWidth: "1240px", margin: "0 auto", padding: "48px 24px 130px" }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "end", justifyContent: "space-between", gap: "20px" }}>
            <h2
              id="see-h"
              data-rv=""
              className="rvt"
              style={{
                margin: "0",
                fontFamily: "var(--font-gloock), Georgia, serif",
                fontWeight: "400",
                fontSize: "clamp(40px, 5.2vw, 72px)",
                lineHeight: "1.02",
                letterSpacing: "-0.01em",
              }}
            >
              <span className="ln">
                <span>What you&apos;ll see</span>
              </span>
            </h2>
            <p
              data-rv=""
              className="rvf"
              style={{ "--d": "150ms", margin: "0 0 8px", maxWidth: "24em", fontSize: "17px", lineHeight: "1.55", color: "#3F4D44" } as CSSProperties}
            >
              Four views built from your billing email.
            </p>
          </div>
          <div style={{ marginTop: "44px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))", gap: "20px" }}>
            <div
              data-rv=""
              className="lp-tile rv"
              style={
                {
                  "--d": "0ms",
                  display: "flex",
                  flexDirection: "column",
                  gap: "18px",
                  background: "#FFFFFF",
                  borderRadius: "26px",
                  padding: "22px",
                  color: "#1E2B22",
                } as CSSProperties
              }
            >
              <div
                className="peek"
                aria-hidden="true"
                style={{
                  height: "150px",
                  background: "#F7F3F5",
                  borderRadius: "16px",
                  padding: "18px",
                  boxSizing: "border-box",
                  display: "flex",
                  alignItems: "flex-end",
                  gap: "5px",
                }}
              >
                {bars.map((b, i) => (
                  <span key={i} style={{ flex: "1", borderRadius: "4px 4px 0 0", height: `${b.h}%`, background: b.c }} />
                ))}
              </div>
              <div>
                <h3 style={{ margin: "0", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "21px", fontWeight: "600" }}>
                  Dashboard
                </h3>
                <p style={{ margin: "6px 0 0", fontSize: "15px", lineHeight: "1.55", color: "#3F4D44" }}>
                  Everything leaving your account in the next 30 days, and what your subscriptions cost a month.
                </p>
              </div>
            </div>

            <div
              data-rv=""
              className="lp-tile rv"
              style={
                {
                  "--d": "100ms",
                  display: "flex",
                  flexDirection: "column",
                  gap: "18px",
                  background: "#E3DADE",
                  borderRadius: "26px",
                  padding: "22px",
                  color: "#1E2B22",
                } as CSSProperties
              }
            >
              <div
                className="peek"
                aria-hidden="true"
                style={{
                  height: "150px",
                  background: "#FFFFFF",
                  borderRadius: "16px",
                  padding: "14px 18px",
                  boxSizing: "border-box",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#D8959B" }} />
                  <span style={{ flex: "1", fontSize: "14px", fontWeight: "600" }}>Netflix</span>
                  <span style={{ fontSize: "14px" }}>$15.49</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#829672" }} />
                  <span style={{ flex: "1", fontSize: "14px", fontWeight: "600" }}>ChatGPT Plus</span>
                  <span style={{ fontSize: "14px" }}>$20</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#D0DBE7" }} />
                  <span style={{ flex: "1", fontSize: "14px", fontWeight: "600" }}>Dropbox Plus</span>
                  <span style={{ fontSize: "14px" }}>$119.88</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#829672" }} />
                  <span style={{ flex: "1", fontSize: "14px", fontWeight: "600" }}>GitHub Copilot</span>
                  <span style={{ fontSize: "14px" }}>$10</span>
                </div>
              </div>
              <div>
                <h3 style={{ margin: "0", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "21px", fontWeight: "600" }}>
                  Recurring
                </h3>
                <p style={{ margin: "6px 0 0", fontSize: "15px", lineHeight: "1.55", color: "#3F4D44" }}>
                  Subscriptions grouped by category, with the cancel link from each company&apos;s own email.
                </p>
              </div>
            </div>

            <div
              data-rv=""
              className="lp-tile rv"
              style={
                {
                  "--d": "200ms",
                  display: "flex",
                  flexDirection: "column",
                  gap: "18px",
                  background: "#D0DBE7",
                  borderRadius: "26px",
                  padding: "22px",
                  color: "#1E2B22",
                } as CSSProperties
              }
            >
              <div
                className="peek"
                aria-hidden="true"
                style={{
                  height: "150px",
                  background: "#FFFFFF",
                  borderRadius: "16px",
                  padding: "14px",
                  boxSizing: "border-box",
                  display: "grid",
                  gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
                  gap: "5px",
                }}
              >
                {cal.map((d, i) => (
                  <span key={i} style={{ borderRadius: "5px", background: d.c }} />
                ))}
              </div>
              <div>
                <h3 style={{ margin: "0", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "21px", fontWeight: "600" }}>
                  Calendar
                </h3>
                <p style={{ margin: "6px 0 0", fontSize: "15px", lineHeight: "1.55", color: "#3F4D44" }}>
                  Every charge and due date on a month view, so the heavy weeks don&apos;t surprise you.
                </p>
              </div>
            </div>

            <div
              data-rv=""
              className="lp-tile rv"
              style={
                {
                  "--d": "300ms",
                  display: "flex",
                  flexDirection: "column",
                  gap: "18px",
                  background: "#FFFFFF",
                  borderRadius: "26px",
                  padding: "22px",
                  color: "#1E2B22",
                } as CSSProperties
              }
            >
              <div
                className="peek"
                aria-hidden="true"
                style={{
                  height: "150px",
                  background: "#F7F3F5",
                  borderRadius: "16px",
                  padding: "16px 18px",
                  boxSizing: "border-box",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  gap: "10px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px" }}>
                  <span style={{ fontWeight: "600" }}>Hulu trial ends</span>
                  <span style={{ color: "#93434C", fontWeight: "600" }}>in 3 days</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px" }}>
                  <span style={{ fontWeight: "600" }}>PG&amp;E bill due</span>
                  <span style={{ color: "#3F4D44" }}>in 11 days</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px" }}>
                  <span style={{ fontWeight: "600" }}>Adobe auto-renews</span>
                  <span style={{ color: "#3F4D44" }}>in 22 days</span>
                </div>
              </div>
              <div>
                <h3 style={{ margin: "0", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "21px", fontWeight: "600" }}>
                  Bills and deadlines
                </h3>
                <p style={{ margin: "6px 0 0", fontSize: "15px", lineHeight: "1.55", color: "#3F4D44" }}>
                  Bills to pay, free trials about to convert, and renewals you can still stop.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="privacy" className="on-dark" aria-labelledby="privacy-h" style={{ position: "relative", background: "#344C3D", color: "#F7F3F5" }}>
          <canvas
            id="edge-grass"
            aria-hidden="true"
            style={{ position: "absolute", left: "0", right: "0", top: "-96px", width: "100%", height: "98px", display: "block", pointerEvents: "none" }}
          />
          <div style={{ maxWidth: "1240px", margin: "0 auto", padding: "64px 24px 56px", display: "flex", flexWrap: "wrap", gap: "48px" }}>
            <div style={{ flex: "1 1 360px", minWidth: "0" }}>
              <h2
                id="privacy-h"
                data-rv=""
                className="rvt"
                style={{
                  margin: "0",
                  fontFamily: "var(--font-gloock), Georgia, serif",
                  fontWeight: "400",
                  fontSize: "clamp(36px, 4.4vw, 56px)",
                  lineHeight: "1.02",
                }}
              >
                <span className="ln">
                  <span>Your email stays</span>
                </span>
                <span className="ln">
                  <span style={{ "--d": "90ms" } as CSSProperties}>your email</span>
                </span>
              </h2>
              <p
                data-rv=""
                className="rvf"
                style={{ "--d": "150ms", margin: "20px 0 0", fontSize: "18px", lineHeight: "1.6", color: "#E3DADE", maxWidth: "30em" } as CSSProperties}
              >
                Phylax is built to read as little as it can and keep even less.
              </p>
            </div>
            <ul
              style={{
                flex: "1 1 520px",
                minWidth: "0",
                listStyle: "none",
                margin: "0",
                padding: "0",
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: "28px 32px",
              }}
            >
              <li data-rv="" className="rv" style={{ "--d": "0ms" } as CSSProperties}>
                <h3 style={{ margin: "0", fontSize: "18px", fontWeight: "600", color: "#FFFFFF" }}>Read-only Gmail access</h3>
                <p style={{ margin: "8px 0 0", fontSize: "15px", lineHeight: "1.6", color: "#E3DADE" }}>
                  It can&apos;t send, label, archive or delete anything. Disconnect at any time and access is revoked.
                </p>
              </li>
              <li data-rv="" className="rv" style={{ "--d": "90ms" } as CSSProperties}>
                <h3 style={{ margin: "0", fontSize: "18px", fontWeight: "600", color: "#FFFFFF" }}>No email text stored</h3>
                <p style={{ margin: "8px 0 0", fontSize: "15px", lineHeight: "1.6", color: "#E3DADE" }}>
                  Only the merchant, amount, dates and cancel link from each billing email are saved.
                </p>
              </li>
              <li data-rv="" className="rv" style={{ "--d": "180ms" } as CSSProperties}>
                <h3 style={{ margin: "0", fontSize: "18px", fontWeight: "600", color: "#FFFFFF" }}>Look-alike senders ignored</h3>
                <p style={{ margin: "8px 0 0", fontSize: "15px", lineHeight: "1.6", color: "#E3DADE" }}>
                  An email that claims to be Netflix but comes from another domain never reaches your list.
                </p>
              </li>
              <li data-rv="" className="rv" style={{ "--d": "270ms" } as CSSProperties}>
                <h3 style={{ margin: "0", fontSize: "18px", fontWeight: "600", color: "#FFFFFF" }}>Cancel links checked</h3>
                <p style={{ margin: "8px 0 0", fontSize: "15px", lineHeight: "1.6", color: "#E3DADE" }}>
                  A link that leaves the sender&apos;s own website shows you the real address before it opens.
                </p>
              </li>
            </ul>
          </div>
          <div data-rv="" className="rv" style={{ maxWidth: "1240px", margin: "0 auto", padding: "0 24px" }}>
            <div
              style={{
                position: "relative",
                overflow: "hidden",
                borderRadius: "32px",
                background: "#F7F3F5",
                color: "#1E2B22",
                padding: "clamp(28px, 5vw, 56px)",
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "28px",
              }}
            >
              <div style={{ flex: "1 1 420px", minWidth: "0" }}>
                <h2
                  id="cta-h"
                  style={{
                    margin: "0",
                    fontFamily: "var(--font-gloock), Georgia, serif",
                    fontWeight: "400",
                    fontSize: "clamp(38px, 4.8vw, 64px)",
                    lineHeight: "1",
                    maxWidth: "11em",
                  }}
                >
                  Find out what you&apos;re paying for
                </h2>
                <p style={{ margin: "16px 0 0", fontSize: "17px", lineHeight: "1.55", color: "#3F4D44", maxWidth: "30em" }}>
                  The first scan reads the last 13 months of billing email. It takes about a minute.
                </p>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                <Link
                  className="b-primary"
                  href="/signup"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "10px",
                    minHeight: "52px",
                    padding: "0 26px",
                    borderRadius: "999px",
                    background: "#344C3D",
                    color: "#FFFFFF",
                    fontWeight: "600",
                    fontSize: "16px",
                    textDecoration: "none",
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <path d="M3 7l9 6 9-6" />
                  </svg>
                  Get started
                </Link>
              </div>
            </div>
          </div>

          <footer
            style={{
              maxWidth: "1240px",
              margin: "0 auto",
              padding: "36px 24px 36px",
              display: "flex",
              justifyContent: "space-between",
              gap: "16px",
              flexWrap: "wrap",
              fontSize: "14px",
              color: "#C9D1C8",
            }}
          >
            <span>
              <span style={{ fontFamily: "var(--font-gloock), Georgia, serif", fontSize: "18px", color: "#FFFFFF" }}>Phylax</span> is a student project and
              isn&apos;t affiliated with Google.
            </span>
            <nav aria-label="Footer" style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
              <Link href="/signin" style={{ color: "#E3DADE" }}>
                Sign in
              </Link>
              <Link href="/privacy" style={{ color: "#E3DADE" }}>
                Privacy
              </Link>
              <Link href="/terms" style={{ color: "#E3DADE" }}>
                Terms
              </Link>
              <Link href="/style" style={{ color: "#E3DADE" }}>
                Style guide
              </Link>
            </nav>
          </footer>
        </section>
      </div>
    </div>
  );
}
