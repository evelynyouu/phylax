# Real-data eval (spec)

Source: project brief from the author, 2026-11-09. This spec covers next step 3 only.

## Goal

Label 150 to 200 of the author's real billing emails and report precision and recall. Resume value comes from "an eval with real numbers". The current 100% score is on fixtures the author wrote and tuned, so it is a regression check, not real accuracy.

## Constraints from the brief

- Gmail scope is gmail.readonly only.
- Email is untrusted input.
- Only merchant, amount, dates and cancel link are stored by the app, not email text. (The eval corpus is an explicit, local, opt-in exception; see plan.)
- Tokens are AES-256-GCM encrypted.
- Cancel links must be https.
- Stack: TypeScript, Zod, Vitest, tsx scripts. The Anthropic SDK is used only for the LLM fallback.
- Commands that must keep working: `npm test`, `npm run eval`, `npm run eval:llm`.
- Author preference: no em dashes in copy.

## What the eval must report

- Precision and recall, with and without the LLM fallback.
- Numbers honest enough to quote on a resume.
