import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import type { Category } from "@/lib/categories";

type Variant = "primary" | "ghost" | "danger";

function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

export function Button({
  variant = "primary",
  small,
  className,
  type = "button",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; small?: boolean }) {
  return <button type={type} className={cx("btn", `btn-${variant}`, small && "btn-sm", className)} {...rest} />;
}

export function ButtonLink({
  variant = "primary",
  small,
  className,
  href,
  ...rest
}: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; variant?: Variant; small?: boolean }) {
  const cls = cx("btn", `btn-${variant}`, small && "btn-sm", className);
  // Internal routes use client navigation; API routes and external links are plain anchors.
  if (href.startsWith("/") && !href.startsWith("/api/")) return <Link href={href} className={cls} {...rest} />;
  return <a href={href} className={cls} {...rest} />;
}

export function Chip({
  pressed,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { pressed: boolean }) {
  return <button type="button" aria-pressed={pressed} className={cx("chip", className)} {...rest} />;
}

export type TagTone = "active" | "trial" | "attention" | "neutral";

export function Tag({ tone, children }: { tone: TagTone; children: ReactNode }) {
  return <span className={`tag tag-${tone}`}>{children}</span>;
}

export function Field({
  id,
  label,
  error,
  hint,
  ...input
}: InputHTMLAttributes<HTMLInputElement> & { id: string; label: string; error?: string | null; hint?: string }) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...input} />
      {error ? (
        <p id={`${id}-error`} className="field-error">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="field-hint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

const CAT_FILL: Record<Category, string> = {
  streaming: "var(--cat-streaming)",
  software: "var(--cat-software)",
  storage: "var(--cat-storage)",
  shopping: "var(--cat-shopping)",
  learning: "var(--cat-learning)",
  other: "var(--cat-other)",
  housing: "var(--cat-housing)",
  utilities: "var(--cat-utilities)",
  phone: "var(--cat-phone)",
  music: "var(--cat-music)",
  gaming: "var(--cat-gaming)",
  health: "var(--cat-health)",
  insurance: "var(--cat-insurance)",
};

/** Leaf-cornered square in the category color. Decorative: the merchant name is always shown next to it. */
export function MerchantMark({ merchant, category, size = 40 }: { merchant: string; category: Category; size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="mark"
      data-cat={category}
      style={{ width: size, height: size, background: CAT_FILL[category], fontSize: Math.round(size * 0.4) }}
    >
      {merchant.trim().charAt(0).toUpperCase()}
    </span>
  );
}
