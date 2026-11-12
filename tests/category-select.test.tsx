import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import CategorySelect from "../components/CategorySelect";

describe("CategorySelect", () => {
  it("labels the select and marks the current value", () => {
    const html = renderToStaticMarkup(<CategorySelect id="c" label="Category for PG&E" value="utilities" onChange={() => {}} />);
    expect(html).toContain('aria-label="Category for PG&amp;E"');
    expect(html).toContain('<option value="utilities" selected="">Utilities</option>');
    expect(html.match(/<option /g)).toHaveLength(13);
  });
});
