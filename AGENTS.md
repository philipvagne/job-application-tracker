# AGENTS.md

## Project

A free, no-account browser app for tracking job applications. Working title: Job Application Tracker.

Read `docs/DEFINITION_OF_DONE.md` before every pass. It decides scope. If anything here or in a prompt conflicts with it, stop and ask.

## Stack

- React (function components), Vite, TypeScript in strict mode
- Vitest for tests
- No UI library, no state library, no router in version 1
- No new dependencies without asking first and giving a reason

## Hard rules

1. **No network requests, ever.** No fetch, XHR, analytics, tracking, or fonts and scripts loaded from a CDN. Use system fonts or self-hosted ones. The privacy promise is that data never leaves the browser.
2. **All user data lives in the browser** behind a storage interface in `src/storage/`. Components never touch localStorage or IndexedDB directly.
3. **Logic is pure and testable.** Everything about statuses, reminders, reply statistics and import/export lives in `src/domain/` as plain TypeScript functions with no React or DOM imports. Anything that depends on the current time takes `now` as a parameter.
4. **Untrusted input.** Text arriving from a URL, a pasted link or an imported file is shown as plain text, never as HTML, and imported files are validated before use.
5. **No hardcoded user-facing text in components.** All text comes from the Swedish and English language files in `src/i18n/`, which must always have identical keys.
6. **No `any`.** If a type is unclear, ask.
7. **Never stop processes by name or pattern.** No `taskkill /IM`, `pkill`, `killall`, `Stop-Process -Name` or similar. Only stop a process you started yourself, by its exact process ID, and record that ID when you start it. If you cannot be sure which process is yours, leave it running and tell the user.

## Product tone

- Neutral, calm wording. Applying for jobs is stressful.
- No red "rejected" counters or shaming language. Show what the user did, such as "7 applications this week".
- Keep screens simple. Do not add features that are not in the definition of done.

## Accessibility

- Semantic HTML, visible focus states, everything usable with the keyboard alone.
- Labels on every input, errors tied to fields with `aria-describedby`.
- Respect `prefers-reduced-motion`.

## Working method

1. Read `AGENTS.md` and `docs/DEFINITION_OF_DONE.md`.
2. For anything bigger than a small fix, give a short plan first and wait for approval.
3. Do only the requested pass.
4. Run the tests and `npm run build` before saying you are done.
5. Report a short summary of what changed, not the full diff, and say what to check in the browser.
6. If something is unclear or missing, ask. Do not invent features, data or copy.
