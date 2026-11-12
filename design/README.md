# Phylax design reference

Exported from the Phylax mockup canvas. These files are the source of truth for look and behavior.
They are mockups, not production code: port them into the Next.js app, don't copy them in as-is.

- pages/Main.dc.html: landing page (scroll-driven 3D hero, how it works, previews, privacy, CTA)
- pages/StyleGuide.dc.html: palette, working colors, type scale, components, radii
- pages/SignIn.dc.html, pages/SignUp.dc.html: auth screens (sign-up is 3 steps)
- pages/Dashboard.dc.html, Subscriptions.dc.html, Calendar.dc.html, Bills.dc.html: app screens
- bouquet-engine.js: the three.js (r160) bouquet + bluebirds engine used by the landing hero.
  createBloom(canvas, items, { onHover, onPrune }) returns { prune, regrow, setProgress, spawnFlock, dispose }.

Each .dc.html holds markup with {{holes}} plus a script block (class Component) with the data and interaction logic.
Ignore support.js, <x-dc>, <helmet>, <sc-for>, <sc-if>: they are the mockup tool's runtime.

## Tokens
Palette: Lavender #E3DADE, Sky #D0DBE7, Mauve #D8959B, Sage #829672, Evergreen #344C3D
Working: Paper #F7F3F5, Surface #FFFFFF, Ink #1E2B22, Moss text #3F4D44, Muted #5E6B62,
Mauve ink #93434C, Sage ink #3D4F33, Slate #2E3E48, Hairline #ECE4E8, Bill dot #7F9BB8
Roles: evergreen = actions/selected/focus; mauve = attention (fill only, text uses Mauve ink);
sage = recurring; sky = one-off bills.
Type: Gloock (display, 24px+), Hanken Grotesk (UI, tabular numbers)
Radii: fields 14, cards 22-26, stages 32, buttons and tags pills; merchant marks use a leaf corner (14 14 14 3).
