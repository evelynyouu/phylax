"use client";

import { CATEGORY_LABELS, CATEGORY_ORDER, type Category } from "@/lib/categories";

/** A select of the 13 categories. The label is the accessible name; callers add a visible label if they want one. */
export default function CategorySelect({
  id,
  label,
  value,
  onChange,
  disabled,
  className = "pill-input",
}: {
  id: string;
  label: string;
  value: Category;
  onChange: (c: Category) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <select id={id} className={className} aria-label={label} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value as Category)}>
      {CATEGORY_ORDER.map((c) => (
        <option key={c} value={c}>
          {CATEGORY_LABELS[c]}
        </option>
      ))}
    </select>
  );
}
