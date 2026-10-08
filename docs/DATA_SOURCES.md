# Data sources

The app itself makes no network requests. The only outside data comes from the bookmarklet, and only on Platsbanken.

## Arbetsförmedlingen's open JobTech API (JobSearch)

- **Request:** `GET https://jobsearch.api.jobtechdev.se/ad/<id>`, made by the bookmarklet from the Platsbanken ad page the user is on (`arbetsformedlingen.se/platsbanken/annonser/<digits>`), one request per click. No cookies, no referrer, no API key, no custom headers, 2.5 second time limit. The ad id is the only thing sent besides what a browser always sends (IP address).
- **Fields read:** `employer.name` and `occupation.label`. Nothing else in the answer is used: not the headline (the ad's title), not the deadline, not whether the ad is removed. Each text is cut at 300 characters in the bookmarklet and cleaned and cut at 200 in the tracker.
- **What the tracker does with it:** the company fills the company field and the occupation fills the role field of the quick-add card. If the ad has no occupation the role stays empty; the headline is never used instead. Nothing goes into the notes. A removed ad is treated like any other as long as the API still returns it. Nothing is saved until the user presses save.
- **If it fails** (timeout, network error, HTTP error, unreadable or unusable answer) the bookmarklet sends the link and page title only.
- **Code:** `src/domain/bookmarkletSource.ts` (the Platsbanken adapter) and `src/domain/addPayload.ts` (what the tracker accepts).

## Terms of use: to be verified before release

The licence and terms of use of the JobTech API and of the ad data have **not** been checked against JobTech's own pages. Third-party descriptions say the data is openly licensed, but that is not a source to rely on.

**Before promoting the app publicly:** read JobTech's current terms of use (jobtechdev.se) for JobSearch and for the ad data, confirm whether attribution, rate limits or other conditions apply, and update this file and the README to match. Until then, treat the licence as unknown.
