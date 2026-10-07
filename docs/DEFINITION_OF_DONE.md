# Job Application Tracker: Definition of Done

Working title. Date: 2026-10-07.

A free browser app that makes applying for jobs faster, and keeps track of what happened, with all data kept on the user's own device.

## Design rules

1. **It must save time, not cost it.** Adding an application takes under 10 seconds. If a feature adds typing, it is cut.
2. **No accounts, no server, no API keys.** Data never leaves the browser.
3. **Respect the user.** Neutral wording, no red "rejected" counters, counts of what the user did this week.

## Version 1: what is in

1. **Quick add.** Job link, company and role. The date fills itself and the last CV used is remembered.
2. **To-apply list.** Paste several links at once, then mark each one "Applied" with one click.
3. **Status list.** To apply, Applied, Interview, Offer, Closed (reason: no reply, declined, withdrawn).
4. **Reminders that compute themselves.** "No reply after 14 days" appears on its own. The number of days is a setting.
5. **CV tagging.** Each application records which CV was used. A small table shows replies and interviews per CV, with the counts shown.
6. **Message templates.** A cover message with {company} and {role} filled in automatically and a copy button.
7. **One-click capture.** A bookmarklet that sends the page title and link from any job page to the tracker.
8. **Backup.** Export and import as a JSON file, plus CSV export, and a reminder to back up.
9. **Swedish and English** interface, responsive, keyboard accessible.

## Out of scope for version 1

- Accounts, login, sync between devices
- Any server, database or paid service
- Email or calendar integration
- A browser extension (the bookmarklet covers capture)
- AI features
- Scraping or searching for jobs
- Push notifications and a mobile app
- Sharing with other people

## Data and tech choices

- **Storage:** the browser (IndexedDB or localStorage). Nothing is sent anywhere, and a "delete all my data" button exists.
- **Stack:** React, Vite and TypeScript, deployed as a static site on Cloudflare. No backend.
- **Language files:** Swedish and English in two content files with the same keys, checked at build time.
- **Logic kept in plain functions** (reminder dates, reply rates per CV, import and export), so it can be tested without a browser.
- **Tests and CI:** unit tests for those functions, and a GitHub Action that runs tests and the build.

## Definition of done

The project is finished when every line below is true.

- [ ] A live address works on desktop and on a phone.
- [ ] Adding an application takes under 10 seconds, timed with a real example.
- [ ] All nine version 1 features work.
- [ ] Export, clear all data, then import restores everything exactly.
- [ ] Unit tests pass for reminders, reply rates per CV, and the import and export round trip, and the GitHub Action is green.
- [ ] Swedish and English are both complete, with no missing text.
- [ ] The Network tab shows no data leaving the browser.
- [ ] It works with the keyboard alone and has visible focus states.
- [ ] I used it for one real week of applications and fixed the three biggest annoyances.
- [ ] The README has a one-paragraph pitch, screenshots, the privacy stance, known limits and how to run it.

## Time box and what gets cut first

About two weeks of part-time work. If it runs late, cut in this order and ship the rest:

1. CSV export
2. The bookmarklet
3. Reply rates per CV (keep the CV tag itself)
4. Installable offline mode, if it was added at all

Quick add, the status list, reminders, templates, backup and the live address are never cut.

## Open questions

- [ ] What name does the app get?
- [ ] Is a plain list enough for statuses, or does the pipeline need columns?
- [ ] Does Arbetsförmedlingen or an a-kassa require a specific format for reporting job-search activity?
- [ ] Which two or three CV versions will be tagged first?
- [ ] How many days should the default reminder wait: 7, 14 or 21?
