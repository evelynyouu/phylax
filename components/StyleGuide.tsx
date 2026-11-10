"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, Chip, Field, MerchantMark, Tag } from "./ui";

// Port of design/pages/StyleGuide.dc.html. Contrast ratios are the mockup's measured values.
const CORE = [
  { id: "lavender", name: "Lavender", hex: "#E3DADE", job: "Soft surfaces: secondary panels, the recurring list background, empty calendar cells. Never for text.", pairs: [["Evergreen ink", "#1E2B22", "10.8 : 1"], ["Moss text", "#3F4D44", "6.5 : 1"]] },
  { id: "sky", name: "Sky", hex: "#D0DBE7", job: "One-off bills, focus halos and informational panels. Pairs with slate text.", pairs: [["Evergreen ink", "#1E2B22", "10.5 : 1"], ["Slate text", "#2E3E48", "7.9 : 1"]] },
  { id: "mauve", name: "Mauve", hex: "#D8959B", job: "Attention: due soon, trials ending, price increases. As a fill or dot only. Text on light grounds uses Mauve ink.", pairs: [["Evergreen ink", "#1E2B22", "6.1 : 1"], ["White fails", "#FFFFFF", "2.4 : 1, avoid"]] },
  { id: "sage", name: "Sage", hex: "#829672", job: "Recurring subscriptions: calendar dots, category marks, chart bars. Large shapes only. Small text uses Sage ink.", pairs: [["Evergreen ink", "#1E2B22", "4.6 : 1"], ["White", "#FFFFFF", "3.2 : 1, 24px+ only"]] },
  { id: "evergreen", name: "Evergreen", hex: "#344C3D", job: "The action color: primary buttons, selected states, focus rings, the privacy band and the 3D stage.", pairs: [["White", "#FFFFFF", "9.4 : 1"], ["Lavender", "#E3DADE", "6.8 : 1"]] },
] as const;

const DERIVED = [
  ["Paper", "#F7F3F5"], ["Surface", "#FFFFFF"], ["Evergreen ink", "#1E2B22"], ["Moss text", "#3F4D44"], ["Muted text", "#5E6B62"],
  ["Mauve ink", "#93434C"], ["Sage ink", "#3D4F33"], ["Slate text", "#2E3E48"], ["Hairline", "#ECE4E8"],
] as const;

export default function StyleGuide() {
  const [pick, setPick] = useState<string>("mauve");
  const [chip, setChip] = useState("All");
  const sel = CORE.find((c) => c.id === pick) ?? CORE[0];

  return (
    <div className="sg">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <Link href="/" className="display" style={{ fontSize: 24, textDecoration: "none", color: "var(--ink)" }}>
          Subwatch
        </Link>
        <Link href="/" style={{ fontSize: 15, fontWeight: 600 }}>
          Back to the site
        </Link>
      </div>

      <h1>Style guide</h1>
      <p className="lede">
        A garden palette for a money tool. Evergreen carries actions and structure, mauve marks anything that needs attention soon, sage means
        recurring, and sky means a one-off bill.
      </p>

      <section aria-labelledby="c-h">
        <h2 id="c-h">Color</h2>
        <p style={{ marginTop: 8, color: "var(--moss)" }}>Select a swatch for its job and the text colors that pass contrast on it.</p>
        <div className="swatches">
          {CORE.map((c) => (
            <button key={c.id} type="button" className="swatch" aria-pressed={c.id === pick} onClick={() => setPick(c.id)}>
              <span className="chipcolor" style={{ background: c.hex }} />
              <span className="lbl">
                <span>{c.name}</span>
                <span>{c.hex}</span>
              </span>
            </button>
          ))}
        </div>
        <div aria-live="polite" className="sel-card">
          <div style={{ flex: "1 1 320px", minWidth: 0 }}>
            <p className="display" style={{ fontSize: 28 }}>
              {sel.name}
            </p>
            <p style={{ marginTop: 6, lineHeight: 1.55, color: "var(--moss)" }}>{sel.job}</p>
          </div>
          <div className="pairs">
            {sel.pairs.map(([label, fg, ratio]) => (
              <span key={label} className="pair" style={{ background: sel.hex, color: fg }}>
                <span style={{ fontWeight: 600, fontSize: 15 }}>{label}</span>
                <span style={{ fontSize: 13 }}>{ratio}</span>
              </span>
            ))}
          </div>
        </div>
        <h3 style={{ marginTop: 36, fontSize: 18, fontWeight: 600 }}>Working colors</h3>
        <p style={{ marginTop: 6, fontSize: 15, color: "var(--moss)" }}>
          Derived from the palette for text and surfaces, so mauve and sage never carry small text on light grounds.
        </p>
        <div className="derived">
          {DERIVED.map(([name, hex]) => (
            <div key={name}>
              <i style={{ background: hex }} />
              <span>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{name}</span>
                <span style={{ fontSize: 13, color: "var(--muted)" }}>{hex}</span>
              </span>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="t-h">
        <h2 id="t-h">Type</h2>
        <div style={{ marginTop: 28, display: "flex", flexWrap: "wrap", gap: 20 }}>
          <div style={{ flex: "1 1 420px", minWidth: 0, background: "var(--evergreen)", color: "var(--paper)", borderRadius: 26, padding: 28 }}>
            <p style={{ fontSize: 14, color: "var(--lavender)" }}>Display: Gloock</p>
            <p className="display" style={{ marginTop: 12, fontSize: 96, lineHeight: 0.9 }}>
              Aa Gg 42
            </p>
            <p style={{ marginTop: 16, fontSize: 15, lineHeight: 1.55, color: "var(--lavender)" }}>
              High-contrast serif for headlines, big totals and merchant names in detail views. One weight. Never below 24px.
            </p>
          </div>
          <div style={{ flex: "1 1 420px", minWidth: 0, background: "var(--surface)", borderRadius: 26, padding: 28 }}>
            <p style={{ fontSize: 14, color: "var(--muted)" }}>Text: Hanken Grotesk</p>
            <p style={{ marginTop: 12, fontSize: 96, lineHeight: 0.9, fontWeight: 600 }}>Aa Gg 42</p>
            <p style={{ marginTop: 16, fontSize: 15, lineHeight: 1.55, color: "var(--moss)" }}>
              Everything else: interface, tables and amounts. Tabular figures so columns of prices line up. 400, 500 and 600.
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="k-h">
        <h2 id="k-h">Components</h2>
        <div className="sg-cards">
          <div>
            <h3>Buttons</h3>
            <p className="cap">Pill shaped, 44px minimum. One primary per view.</p>
            <div className="demo">
              <Button>Connect Gmail</Button>
              <Button variant="ghost">Sync now</Button>
              <Button variant="danger">Cancel subscription</Button>
              <Button disabled>Syncing</Button>
            </div>
          </div>
          <div>
            <h3>Fields</h3>
            <p className="cap">Label always visible. Focus adds a sky halo.</p>
            <div style={{ marginTop: 20 }}>
              <Field id="sg-email" label="Email" type="email" placeholder="you@berkeley.edu" error="Enter an email address with an @." />
            </div>
          </div>
          <div>
            <h3>Status tags</h3>
            <p className="cap">Fill from the palette, text from the working colors.</p>
            <div className="demo">
              <Tag tone="active">Active</Tag>
              <Tag tone="trial">Free trial</Tag>
              <Tag tone="attention">Due in 3 days</Tag>
              <Tag tone="attention">Price went up</Tag>
              <Tag tone="neutral">Cancelled</Tag>
            </div>
          </div>
          <div>
            <h3>Filter chips</h3>
            <p className="cap">Try them. Selected fills with evergreen.</p>
            <div role="group" aria-label="Example filter" className="demo">
              {["All", "Streaming", "Software and AI", "Storage"].map((c) => (
                <Chip key={c} pressed={c === chip} onClick={() => setChip(c)}>
                  {c}
                </Chip>
              ))}
            </div>
          </div>
          <div>
            <h3>Subscription row</h3>
            <p className="cap">The leaf mark shows category. Amount right-aligned.</p>
            <div style={{ marginTop: 18, display: "flex", alignItems: "center", gap: 14, padding: "14px 0", borderTop: "1px solid var(--hairline)", borderBottom: "1px solid var(--hairline)" }}>
              <MerchantMark merchant="Netflix" category="streaming" />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontWeight: 600 }}>Netflix</span>
                <span style={{ display: "block", fontSize: 14, color: "var(--moss)" }}>Next charge Nov 14</span>
              </span>
              <span style={{ fontWeight: 600 }}>$15.49</span>
            </div>
          </div>
          <div>
            <h3>Calendar day</h3>
            <p className="cap">Dots by type, total underneath. Today gets the evergreen ring.</p>
            <div style={{ marginTop: 18, display: "flex", gap: 10 }}>
              {(
                [
                  [9, ["var(--sage)"], "$10", true],
                  [12, ["var(--sage)", "var(--mauve)"], "$24.99", false],
                  [20, ["var(--bill-dot)"], "$142.18", false],
                ] as const
              ).map(([n, dots, t, today]) => (
                <span key={n} className={`cell${today ? " today" : ""}`} style={{ width: 92, minHeight: 92, cursor: "default" }}>
                  <span className="n">{n}</span>
                  <span className="dots">
                    {dots.map((d, i) => (
                      <span key={i} className="dot" style={{ background: d }} />
                    ))}
                  </span>
                  <span className="t">{t}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
