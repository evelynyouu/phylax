"use client";

import { useSyncExternalStore } from "react";
import { applyTheme, readTheme, subscribeTheme, type Theme } from "@/lib/theme";

const OPTIONS: { value: Theme; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export default function AppearanceSection() {
  const theme = useSyncExternalStore(subscribeTheme, readTheme, () => "light" as Theme);
  return (
    <section className="card" aria-labelledby="set-appearance">
      <h2 id="set-appearance">Appearance</h2>
      <div role="radiogroup" aria-labelledby="set-appearance" className="radio-row">
        {OPTIONS.map((o) => (
          <label key={o.value} className="radio">
            <input type="radio" name="theme" value={o.value} checked={theme === o.value} onChange={() => applyTheme(o.value)} />
            {o.label}
          </label>
        ))}
      </div>
    </section>
  );
}
