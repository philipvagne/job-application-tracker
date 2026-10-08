# Job Application Tracker: Definition of Done (revised)

Working title. Revised 2026-10-07 after the first manual tests. This replaces the earlier version.

A free browser app that makes applying for jobs faster, and keeps a reliable record of what you sent and said to each employer, with all data kept on the user's own device.

## Design rules

1. **It must save time, not cost it.** Adding a job takes under 10 seconds from a link or the bookmarklet. If a feature adds typing, it is cut.
2. **Every application is a record.** It holds the link, the exact CV file that was sent, notes and dates, so the user can stand by what they sent.
3. **No accounts, no server, no API keys.** Data never leaves the browser.
4. **Respect the user.** Neutral wording, no red "rejected" counters, counts of what the user did this week (shown only when the user turns on "Show weekly summary" in settings; off by default). Nothing nags: the user decides what happens next.

## Version 1: what is in

1. **Link-first quick add.** Paste a link, optionally choose a CV from a dropdown, then "Add to apply list" or "Add as applied". Company and role are optional and editable. From a pasted link only the website name can be filled in.
2. **Bookmarklet.** One click on a job page sends the link and page title, plus the job title and company when the page publishes them as structured data. No server, no AI.
3. **CV files.** Upload PDF files, stored in the browser. Each upload is its own entry and never changes; a revised CV is uploaded again. The CV used is linked to the application and opens from its row.
4. **Application record.** Link (opens from the row), CV file, notes, and dates.
5. **Lists and statuses.** Status tabs: To apply, Applied, Interview, Offer and Closed (reason: no reply, not selected, declined offer; older entries keep their old reason). One list is shown at a time, with the count on each tab. The layout was decided from an approved mockup (docs/mockups/): tabs, with a "My CVs" column.
6. **Reminders that compute themselves, and are optional.** "No reply after N days" can be switched on or off in settings, and N is a setting.
7. **Message templates.** A cover message with {company} and {role} filled in automatically and a copy button.
8. **Statistics per CV.** Replies and interviews per CV file or CV name, with the counts shown and a note that small numbers mislead. A reply is recorded automatically when an application moves to Interview or Offer; there is no manual "got a reply" action.
9. **Backup.** Export and import as JSON including the CV files, plus CSV export. The app asks the browser to keep its storage, and reminds the user when a backup is overdue. Built in two steps: first the application data and CV names and file details, **without the files themselves** (the app says so plainly), then a "full backup" pass that adds the files.
10. **CV deletion.** A CV entry and its file can be deleted, with a confirmation that names the applications using it. Must be done before release.
11. **Swedish and English** interface, desktop-first, keyboard accessible. It must work on a phone but is not optimised for one.

## Later (after version 1)

- Dark mode. The interface is light only for now; the old dark colours are parked in `src/styles/tokens.css`.

## Out of scope

- Accounts, login, sync between devices
- Any server, database or paid service
- AI features, summarising pages, or reading other websites' content
- Email or calendar integration
- A browser extension (the bookmarklet covers capture)
- Scraping or searching for jobs
- Push notifications and a native mobile app
- A polished phone layout (version 1.1)
- Sharing with other people

## Data and tech choices

- **Storage:** application data in the browser as now. CV files in IndexedDB behind the storage interface, as Blobs, with a size cap per file and in total. Nothing is sent anywhere, and a "delete all my data" button removes everything including files.
- **Files:** PDF only, at most 5 MB each, checked by name, size and the file's first bytes. Files open from a local object URL.
- **Backup with files:** one JSON file with the files encoded inside it (base64), with a total size limit and a clear message when it is exceeded. Decided and built in its own pass; until then the backup does not contain the files.
- **Stack:** React, Vite and TypeScript, deployed as a static site on Cloudflare. No backend.
- **Language files:** Swedish and English in two JSON files with the same keys, checked at build time.
- **Logic in plain functions,** so it can be tested without a browser.
- **Tests and CI:** unit tests for the logic, and a GitHub Action that runs tests and the build.

## Definition of done

The project is finished when every line below is true.

- [ ] A live address works on desktop, and is usable on a phone.
- [ ] Adding a job from a link or the bookmarklet takes under 10 seconds, timed with a real example.
- [ ] A CV file can be uploaded, linked to an application, and opened again from its row after a reload.
- [ ] All eleven version 1 features work.
- [ ] Export, clear all data, then import restores all application data exactly. (CV files are not in the backup until the full backup pass; until then the app tells the user to keep the original PDFs.)
- [ ] Full backup pass done: export, clear all data, then import restores everything, including the CV files.
- [ ] A CV entry and its file can be deleted, with a confirmation, before release.
- [ ] Unit tests pass for reminders, statistics per CV, file validation, and the import and export round trip, and the GitHub Action is green.
- [ ] Swedish and English are both complete, with no missing text.
- [ ] The Network tab shows no data leaving the browser.
- [ ] It works with the keyboard alone and has visible focus states.
- [ ] I used it for one real week of applications and fixed the three biggest annoyances.
- [ ] The README has a one-paragraph pitch, screenshots, the privacy stance, known limits and how to run it.

## Time box and what gets cut first

About four weeks of part-time work, from 2026-10-07. The decision date is the end of week four. If anything is unfinished then, cut in this order and ship the rest:

1. CSV export
2. Message templates
3. Statistics per CV
4. The structured-data part of the bookmarklet (keep link and title)

Never cut: link-first quick add, CV files, the application record, the lists and statuses, backup including files, and the live address.

## Open questions

- [ ] What name does the app get?
- [x] Lists or columns? Decided: status tabs (Pass 6a, from the approved mockup).
- [ ] Size limit for CV files in total. (Per file is decided: 5 MB.)
- [ ] How are the CV files backed up: base64 inside the one JSON file (preferred), or something else? What happens to the 2 MB import limit?
- [ ] Does Arbetsförmedlingen or an a-kassa require a specific format for reporting job-search activity?
