import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Button, ButtonLink, Chip, Field, MerchantMark, Tag } from "../components/ui";
import { CATEGORY_LABELS } from "../lib/categories";

describe("shared components", () => {
  it("renders button variants as real buttons with type=button by default", () => {
    const html = renderToStaticMarkup(<Button variant="danger">Cancel</Button>);
    expect(html).toContain('type="button"');
    expect(html).toContain("btn-danger");
    expect(renderToStaticMarkup(<ButtonLink href="/x" variant="primary">Go</ButtonLink>)).toContain('href="/x"');
  });

  it("exposes chip state with aria-pressed", () => {
    expect(renderToStaticMarkup(<Chip pressed>All</Chip>)).toContain('aria-pressed="true"');
    expect(renderToStaticMarkup(<Chip pressed={false}>All</Chip>)).toContain('aria-pressed="false"');
  });

  it("wires a field error to its input for screen readers", () => {
    const html = renderToStaticMarkup(<Field id="email" label="Email" error="Enter an email address with an @." />);
    expect(html).toContain('for="email"');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('aria-describedby="email-error"');
    expect(html).toContain('id="email-error"');
  });

  it("maps tag tones to classes", () => {
    expect(renderToStaticMarkup(<Tag tone="trial">Free trial</Tag>)).toContain("tag-trial");
  });

  it("draws a merchant mark with the category and an initial, hidden from screen readers", () => {
    const html = renderToStaticMarkup(<MerchantMark merchant="netflix" category="streaming" />);
    expect(html).toContain('data-cat="streaming"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain(">N<");
  });

  it("names every category in plain words", () => {
    expect(Object.values(CATEGORY_LABELS)).toEqual(["Housing and rent", "Utilities", "Phone and internet", "AI and technology", "Streaming", "Music", "Gaming", "Storage", "Shopping", "Learning", "Health and fitness", "Insurance", "Other"]);
  });
});

describe("merchant mark letters", () => {
  it("use a fixed dark letter on the fixed light fills in both themes, white only on software", async () => {
    const { readFileSync } = await import("node:fs");
    const css = readFileSync(`${process.cwd()}/app/ui.css`, "utf8");
    const rule = (sel: string) => css.match(new RegExp(`\\n${sel.replace(/[.[\]"=]/g, "\\$&")} \\{([^}]*)\\}`))?.[1] ?? "";
    expect(rule(".mark")).toMatch(/color: #1e2b22;/);
    expect(rule(".mark")).not.toContain("var(--ink)");
    expect(rule('.mark[data-cat="software"]')).toMatch(/color: #fff;/);
  });
});
