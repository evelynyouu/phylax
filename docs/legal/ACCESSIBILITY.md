Draft for review. Not legal advice.

# Accessibility: WCAG 2.1 AA checklist and current issues

## What the law does and does not settle

- **ADA Title III** covers "businesses open to the public". The Department of Justice says it "has consistently taken the position that the ADA's requirements apply to all the goods, services, privileges, or activities offered by public accommodations, including those offered on the web" ([ADA.gov web guidance](https://www.ada.gov/resources/web-guidance/)).
- There is **no Title III regulation with a technical web standard**. DOJ: "The Department of Justice does not have a regulation setting out detailed standards", and businesses "have flexibility in how they comply", while still having to make online services accessible. DOJ points to WCAG and the Section 508 Standards as "helpful guidance" (same source).
- **WCAG 2.1 Level AA is a legal standard only for state and local governments** under the 2024 Title II rule ([ADA.gov Title II web rule](https://www.ada.gov/resources/2024-03-08-web-rule/)). It is not a rule for private websites; for them it is the usual benchmark in practice.
- **Not settled:** whether a website with no physical location is a "public accommodation" under Title III. Federal courts have disagreed on this; that statement is from general knowledge and is unverified here against primary sources. Whether a free, non-commercial student project is a "business open to the public" at all is also unverified.
- WCAG 2.2 is a newer W3C Recommendation ([WCAG 2.2](https://www.w3.org/TR/WCAG22/)) that includes everything in 2.1 except 4.1.1 Parsing, plus new criteria such as 2.4.11 Focus Not Obscured, 2.5.7 Dragging Movements, 2.5.8 Target Size (Minimum), 3.2.6 Consistent Help, 3.3.7 Redundant Entry and 3.3.8 Accessible Authentication. Meeting 2.2 AA is a reasonable stretch goal.

Recommendation: build to WCAG 2.1 AA ([WCAG 2.1](https://www.w3.org/TR/WCAG21/)), add an accessibility statement with a contact address, and fix reported problems promptly.

## Checklist for the incoming frontend (WCAG 2.1 A and AA)

Each line is one success criterion from [WCAG 2.1](https://www.w3.org/TR/WCAG21/). "Subwatch note" says what it means here.

### Perceivable

- [ ] **1.1.1 Non-text Content (A).** Every meaningful icon, chart and image has a text alternative; decorative ones are `aria-hidden` or `alt=""`. Subwatch note: the WebGL bouquet, the dashboard bar chart and merchant marks.
- [ ] **1.2.1 to 1.2.5 Time-based media (A/AA).** Captions and alternatives for any video or audio. Subwatch note: none today; applies if a demo video is embedded.
- [ ] **1.3.1 Info and Relationships (A).** Headings, lists, tables, labels and groups are in the markup, not just the styling.
- [ ] **1.3.2 Meaningful Sequence (A).** Reading order in the DOM matches the visual order, including the layered landing hero.
- [ ] **1.3.3 Sensory Characteristics (A).** Instructions do not rely only on shape, color, position or sound ("select the pink petal" needs a non-visual path).
- [ ] **1.3.4 Orientation (AA).** Works in portrait and landscape.
- [ ] **1.3.5 Identify Input Purpose (AA).** `autocomplete` on name, email and password fields.
- [ ] **1.4.1 Use of Color (A).** Color is never the only way to show status (trial vs bill vs subscription, urgent vs not, trusted vs untrusted link).
- [ ] **1.4.2 Audio Control (A).** No auto-playing audio.
- [ ] **1.4.3 Contrast (Minimum) (AA).** Text 4.5:1, large text 3:1.
- [ ] **1.4.4 Resize Text (AA).** Usable at 200% zoom.
- [ ] **1.4.5 Images of Text (AA).** No text baked into images.
- [ ] **1.4.10 Reflow (AA).** No two-direction scrolling at 320 CSS px wide (except the calendar grid if truly needed).
- [ ] **1.4.11 Non-text Contrast (AA).** Input borders, button borders, focus rings, chart bars and status dots 3:1 against neighbors.
- [ ] **1.4.12 Text Spacing (AA).** No clipped text when line height, letter and word spacing are increased.
- [ ] **1.4.13 Content on Hover or Focus (AA).** Hover readouts are dismissible, hoverable and persistent.

### Operable

- [ ] **2.1.1 Keyboard (A).** Everything works by keyboard, including chart day details, petal pruning, dialogs and tabs.
- [ ] **2.1.2 No Keyboard Trap (A).** Focus can always leave a component; dialogs return focus on close.
- [ ] **2.1.4 Character Key Shortcuts (A).** No single-key shortcuts, or they can be turned off.
- [ ] **2.2.1 Timing Adjustable (A).** No time limits, or they can be extended. Subwatch note: OAuth state cookie expires after 10 minutes; tell the user and let them retry.
- [ ] **2.2.2 Pause, Stop, Hide (A).** Moving content that starts automatically and lasts more than 5 seconds has a pause control. Subwatch note: bluebird animation and any looping hero motion.
- [ ] **2.3.1 Three Flashes or Below Threshold (A).**
- [ ] **2.4.1 Bypass Blocks (A).** Skip link on every page with repeated navigation.
- [ ] **2.4.2 Page Titled (A).** Unique, descriptive `<title>` per page.
- [ ] **2.4.3 Focus Order (A).** Logical tab order; no focusable elements that are invisible.
- [ ] **2.4.4 Link Purpose (In Context) (A).** "Cancel subscription" links say which merchant (visually or with hidden text).
- [ ] **2.4.5 Multiple Ways (AA).** More than one way to reach pages (nav plus links), unless a page is a step in a process.
- [ ] **2.4.6 Headings and Labels (AA).** Descriptive headings and labels.
- [ ] **2.4.7 Focus Visible (AA).** A visible focus indicator on every control.
- [ ] **2.5.1 Pointer Gestures (A).** Anything needing drag or multi-point (turning the bouquet) has a single-pointer or button alternative.
- [ ] **2.5.2 Pointer Cancellation (A).** Actions fire on up-event, not down-event.
- [ ] **2.5.3 Label in Name (A).** Accessible name contains the visible label text.
- [ ] **2.5.4 Motion Actuation (A).** No shake or tilt controls.

### Understandable

- [ ] **3.1.1 Language of Page (A).** `lang="en"` on `<html>`.
- [ ] **3.1.2 Language of Parts (AA).** Mark any non-English text.
- [ ] **3.2.1 On Focus / 3.2.2 On Input (A).** Focusing or changing a control does not unexpectedly navigate or submit.
- [ ] **3.2.3 Consistent Navigation / 3.2.4 Consistent Identification (AA).** Same nav and same names for the same things on every page.
- [ ] **3.3.1 Error Identification (A).** Errors are described in text and tied to the field.
- [ ] **3.3.2 Labels or Instructions (A).** Every input has a visible label; requirements (password length) are stated up front.
- [ ] **3.3.3 Error Suggestion (AA).** Errors say how to fix them.
- [ ] **3.3.4 Error Prevention (Legal, Financial, Data) (AA).** Destructive or data-changing actions are reversible, checked, or confirmed. Subwatch note: account deletion (confirm), disconnect (confirm), mark paid and mark cancelled (undo).

### Robust

- [ ] **4.1.1 Parsing (A).** No duplicate IDs (the W3C now treats this as always satisfied for HTML, but duplicate IDs still break `aria-labelledby`).
- [ ] **4.1.2 Name, Role, Value (A).** Custom widgets (tabs, toggles, chips, dialogs, progress bars) expose correct roles, states and names.
- [ ] **4.1.3 Status Messages (AA).** Sync results, saved states and errors are announced with `role="status"` or `role="alert"` without moving focus.

### Also do

- [ ] Respect `prefers-reduced-motion` for every animation, including scroll-driven ones.
- [ ] Test with keyboard only, VoiceOver (macOS/iOS) and NVDA (Windows), and with an automated checker (axe or Lighthouse). Automated tools catch only part of WCAG.
- [ ] Publish an accessibility statement with a contact address.

## Issues seen in the current components (reported only, not fixed)

Contrast ratios below were computed from the color tokens in `app/globals.css:3-29` with the WCAG relative luminance formula.

| # | Issue | Evidence | Criterion | Severity |
|---|---|---|---|---|
| 1 | Text input, search, select, toggle and month-nav button borders use `--field-border` `#d6cbd0`, which is about 1.58:1 on white and 1.43:1 on the paper background. The field boundary is the only visual cue for where to type. | `app/ui.css:162-169`, `app/pages.css:69`, `:126`, `:130` | 1.4.11 Non-text Contrast | Medium |
| 2 | Dashboard chart: the per-day breakdown appears only on mouse hover over `<span>` bars, which are not focusable. Keyboard and screen reader users get only the summary label. The Calendar page has the same data, which may count as an alternative, but the chart itself is mouse-only. | `components/DashboardChart.tsx:48-69`, `:77-83` | 2.1.1 Keyboard, 1.4.13 | Medium |
| 3 | Landing hero: bluebirds fly across the scene automatically with no pause control (they are removed only under `prefers-reduced-motion`). | `lib/bloom.ts:357-415`, `components/Bouquet.tsx:48` | 2.2.2 Pause, Stop, Hide | Medium |
| 4 | Landing hero layers fade with opacity while staying in the accessibility tree. Intro links get `tabIndex=-1` when faded but are still reachable by screen reader browse mode; the play layer is `aria-hidden` only at opacity 0. Visible and announced content can drift apart. | `components/LandingHero.tsx:120-147`, `:162` | 1.3.2, 2.4.3 | Medium |
| 5 | Turning the bouquet needs a drag ("Drag to turn the bouquet"). Petal selection has chip buttons as an alternative, but turning does not. | `components/LandingHero.tsx:165-167`, `:196-214` | 2.5.1 Pointer Gestures (check whether turning is needed for any function) | Low |
| 6 | Sign-up step 2: the "Connect Gmail" link has `aria-disabled` when Google is not configured but stays a working link. | `app/signup/page.tsx:114` | 4.1.2 Name, Role, Value | Low |
| 7 | Cancel warning dialog IDs are built from the merchant name. Two items for the same merchant on one page (or names with no Latin letters, which all become `dlg-`) create duplicate IDs, so `aria-labelledby` can name the wrong dialog. | `components/CancelAction.tsx:51-52` | 4.1.2, 1.3.1 | Low |
| 8 | Trusted cancel links open a new tab with no warning; the Recurring panel does warn with hidden text, so behavior is inconsistent. | `components/CancelAction.tsx:37-40` vs `components/RecurringView.tsx:290-296` | Advisory (W3C technique G201), 3.2.4 consistency | Low |
| 9 | Calendar cells show item types only as colored dots; the cell's accessible name gives the count and total but not the types. Types are listed in text after selecting a day. Trial dots (`--mauve` `#d8959b`) are about 2.42:1 on white. | `components/CalendarView.tsx:136-145`, `:13-18` | 1.4.1 Use of Color, 1.4.11 | Low |
| 10 | Status tabs use `role="tab"` without arrow-key movement or roving `tabIndex`, which screen reader users expect from tabs. | `components/BillsView.tsx:105-111` | 4.1.2 (expected pattern per WAI-ARIA practices) | Low |
| 11 | First-scan live region updates about every 700 ms, which can flood screen reader output. | `components/FirstScan.tsx:27-36`, `:85-98` | 4.1.3 (usability) | Low |
| 12 | On screens under 600 px, the header's "Privacy" link is hidden. The footer link remains. Once a real privacy policy exists, keep a link to it reachable on mobile. | `app/pages.css:403` | 2.4.5 (and Google's "prominently displayed" rule) | Low |

Things already done well: skip link (`components/AppShell.tsx:9-11`), a global `:focus-visible` ring at 8.5:1 (`app/globals.css:115-118`), reduced-motion overrides (`app/globals.css:149-158`), labeled fields with `aria-describedby` and `aria-invalid` (`components/ui.tsx:48-71`), `aria-current` in nav, `aria-pressed` toggles, a labeled progress bar, `lang="en"` (`app/layout.tsx:17`), and per-page titles on sign-in and sign-up.
