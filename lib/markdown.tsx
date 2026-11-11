import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import type { ReactNode } from "react";

// A tiny Markdown renderer for the subset docs/legal/*.md use: #, ## and ### headings,
// paragraphs, "- " lists, pipe tables, "---" rules, **bold**, `code` and [text](url) links.
// It builds React elements, so text is escaped by React and no raw HTML is ever injected.

const INLINE = /\*\*(.+?)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)/g;

function href(raw: string): string {
  // Links written against the [APP URL] placeholder point at this site.
  return raw.startsWith("[APP URL]") ? raw.slice("[APP URL]".length) || "/" : raw;
}

function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(INLINE)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const k = `${key}-${i++}`;
    if (m[1] !== undefined) out.push(<strong key={k}>{inline(m[1], k)}</strong>);
    else if (m[2] !== undefined) out.push(<code key={k}>{m[2]}</code>);
    else {
      const to = href(m[4]);
      out.push(
        to.startsWith("/") ? (
          <Link key={k} href={to}>
            {inline(m[3], k)}
          </Link>
        ) : (
          <a key={k} href={to}>
            {inline(m[3], k)}
          </a>
        ),
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const cells = (line: string) =>
  line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());

export function renderMarkdown(src: string): ReactNode[] {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const out: ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const key = `b${i}`;
    if (!line.trim()) {
      i++;
      continue;
    }
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      const Tag = (["h1", "h2", "h3"] as const)[h[1].length - 1];
      out.push(<Tag key={key}>{inline(h[2], key)}</Tag>);
      i++;
      continue;
    }
    if (/^-{3,}\s*$/.test(line)) {
      out.push(<hr key={key} />);
      i++;
      continue;
    }
    if (line.startsWith("|")) {
      const rows: string[] = [];
      while (i < lines.length && lines[i].startsWith("|")) rows.push(lines[i++]);
      const [head, , ...body] = rows;
      out.push(
        <div key={key} style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                {cells(head).map((c, j) => (
                  <th key={j} scope="col" style={{ textAlign: "left" }}>
                    {inline(c, `${key}-h${j}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((r, n) => (
                <tr key={n}>
                  {cells(r).map((c, j) => (
                    <td key={j}>{inline(c, `${key}-${n}-${j}`)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    if (line.startsWith("- ")) {
      const items: string[] = [];
      while (i < lines.length && lines[i].startsWith("- ")) items.push(lines[i++].slice(2));
      out.push(
        <ul key={key}>
          {items.map((t, n) => (
            <li key={n}>{inline(t, `${key}-${n}`)}</li>
          ))}
        </ul>,
      );
      continue;
    }
    // A paragraph runs until a blank line or the start of another block.
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,3}\s|-{3,}\s*$|\||- )/.test(lines[i])) para.push(lines[i++].trim());
    out.push(<p key={key}>{inline(para.join(" "), key)}</p>);
  }
  return out;
}

/**
 * A docs/legal file ready to publish: without the "Draft for review" line and without the
 * reviewer notes at the end (they say "delete before publishing"). Everything else, including
 * placeholders such as [CONTACT EMAIL], is kept as written.
 */
export function publicLegalText(src: string): string {
  return src
    .replace(/^Draft for review\. Not legal advice\.[^\S\n]*\n?/m, "")
    .replace(/\n-{3,}\s*\n+## Notes for the reviewer[\s\S]*$/, "\n")
    .trim();
}

/** Reads a docs/legal file. Synchronous, so the page prerenders at build time. */
export function legalDoc(file: "PRIVACY_POLICY.md" | "TERMS.md"): ReactNode[] {
  return renderMarkdown(publicLegalText(fs.readFileSync(path.join(process.cwd(), "docs", "legal", file), "utf8")));
}
