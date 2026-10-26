# Security & Bug-Fix Update — October 2026

This file explains every change made in the `security-updates-2026` branch, why it was
made, and how to check it. If something breaks later, start here.

> TL;DR: the old packages had known security holes, anyone could edit or delete any
> review, and one API route crashed every time. All fixed. Run `npm install` to pick
> up the new packages.

---

## 1. Outdated packages with known vulnerabilities (the likely source of GitHub's alerts)

| Package | Was | Now | Why |
|---|---|---|---|
| `express` | ^4.16.3 | ^5.1.0 | Old 4.x releases had open-redirect and XSS bugs (CVE-2024-29041, CVE-2024-43796) plus a regex denial-of-service in `path-to-regexp` (CVE-2024-45296, CVE-2024-52798). Express 5 also passes errors from `async` routes to the error handler automatically. |
| `mongoose` | ^5.0.12 | ^8.9.5 | Mongoose 5 is end-of-life. It had a prototype-pollution bug (CVE-2023-3696) and a search-injection bug fixed in 8.9.5 (CVE-2025-23061). |
| `mongodb` | ^3.0.5 | **removed** | Mongoose ships its own compatible driver. Listing an old one separately could pull in a second, vulnerable copy. |
| `body-parser` | ^1.18.2 | **removed** | Built into Express (`express.json()`). Old versions had a denial-of-service bug (CVE-2024-45590). |
| `nodemon` | ^1.17.2 (in `dependencies`) | ^3.1.9 (in `devDependencies`) | Nodemon 1.x pulled in many vulnerable sub-packages. It's a development tool, so it no longer installs on a production server. |
| `helmet` | — | ^8.1.0 (**new**) | Adds standard security headers (see §3). |
| `express-rate-limit` | — | ^7.5.0 (**new**) | Stops one visitor or bot from spamming the API (100 requests / 15 min per IP). |

**`package-lock.json` was deleted on purpose.** It pinned the old vulnerable versions, and the
build environment used for this update couldn't reach npm to create a fresh one. Running
`npm install` once creates a new lock file with the patched versions; commit that file afterward.

Browser libraries (loaded from a CDN in the HTML):

| Library | Was | Now | Why |
|---|---|---|---|
| jQuery | 3.3.1 | 3.7.1 | XSS bugs CVE-2019-11358, CVE-2020-11022, CVE-2020-11023 |
| Bootstrap | 4.0.0 | 4.6.2 | XSS bugs CVE-2018-14040/14041/14042, CVE-2019-8331. Stayed on v4 so the existing page layout doesn't break. |
| Popper.js | 1.12.9 | 1.16.1 | The version Bootstrap 4.6.2 requires |
| Handlebars | 4.0.8 | **removed** | Prototype-pollution / remote-code-execution bugs (CVE-2019-19919, CVE-2021-23369, CVE-2021-23383). Replaced with a few lines of plain JavaScript. |

Every CDN `<script>`/`<link>` has an `integrity="sha384-…"` hash. These were computed from the
official releases on GitHub, so the browser refuses a file if the CDN ever serves a tampered copy.

## 2. Anyone could edit or delete any review

**Before:** `PUT /api/file/:id` and `DELETE /api/file/:id` had no protection. Every visitor saw
Edit/Del buttons and could wipe out every review.

**Now:** those routes require an `X-Admin-Token` header that matches the `ADMIN_TOKEN`
environment variable (compared in constant time). If `ADMIN_TOKEN` isn't set, editing and
deleting are turned off for everyone. Visitors can still read and post reviews.

When an admin clicks Edit/Del, the page asks for the token once and remembers it until the tab
closes.

```bash
ADMIN_TOKEN="choose-a-long-random-phrase" npm start
```

## 3. Cross-site scripting (XSS) protections

- Reviews are drawn with jQuery `.text()` instead of building an HTML string, so a review
  containing `<script>` shows up as plain text.
- `helmet` sends a **Content-Security-Policy** that allows scripts only from this site and
  `cdn.jsdelivr.net`, and blocks all inline JavaScript. To make that possible:
  - the smooth-scroll code moved from `index.html` into `public/js/nav.js`
  - the review page's inline script and `onclick="…"` attributes moved into `public/js/app.js`
- Links that open a new tab (`target="_blank"`) got `rel="noopener noreferrer"` so the opened
  site can't take over the original tab ("reverse tabnabbing").
- The `X-Powered-By: Express` header is off.

## 4. API hardening (`src/routes/index.js`)

- Each field must be plain text. Objects like `{"$gt": ""}` (a NoSQL-injection trick) get a `400`.
- The schema has max lengths (title/location/who 120 characters, description 2000) and trims spaces.
- Request bodies are capped at 10 KB.
- Raw database errors are no longer sent to the browser. They're logged on the server, and the
  visitor gets a friendly message.
- Invalid ids (e.g. `/api/file/banana`) get a `400` instead of crashing with a 500.
- Configuration now reads `PORT`, `MONGODB_URI`, and `ADMIN_TOKEN` from environment variables,
  so passwords never need to be committed to the repo.

## 5. Removed files

- **`public/php.ini`**: a PHP image-upload script saved under a `.ini` name inside the public
  folder. Node never ran it, but Express served it to anyone who requested it, and the script
  itself was unsafe (it trusted the uploaded file name). Nothing used it.
- **`package-lock.json`**: see §1.

## 6. Bugs fixed

| Bug | Fix |
|---|---|
| `GET /api/file/:id` crashed every time: `ReferenceError: FILES is not defined` | Looks the review up in MongoDB |
| Database seeding used `File.count()` and callbacks, both removed in newer Mongoose, and a seeding error crashed the server | Rewritten as `seedIfEmpty()`, which runs after the database connects |
| Server started even when MongoDB wasn't running, then every request hung | Waits for the connection and exits with a clear message if it fails |
| Review form used `panel hidden`, which aren't Bootstrap 4 classes, so show/hide did nothing | Bootstrap 4 card + `d-none` |
| After editing a review, the hidden id stuck around, so the **next new review overwrote the edited one** | Form fully resets after every save |
| `DELETE` ignored save errors | Errors are handled |
| Two navbar links shared the id `eventPicturesbutton` | Second link is now `reviewbutton` |
| The "Event Pictures" scroll handler was attached to the page heading, not the link | Attached to the link |
| `index.html` had duplicate `</body></html>` tags and both pages lacked `<!DOCTYPE html>` | Fixed |
| `npm start` ran nodemon (a dev tool) | `npm start` runs `node`; use `npm run dev` for auto-reload |

## 7. How to run and verify

```bash
npm install                 # creates a fresh package-lock.json with patched versions
npm audit --omit=dev        # should report 0 vulnerabilities
mongod                      # in another terminal
ADMIN_TOKEN=test123 npm run dev
```

Then open http://localhost:3030 and check that:

1. The home page navbar scrolls smoothly to each section.
2. The Review Us page lists the three seed reviews.
3. Posting a review works with no token.
4. Edit/Del ask for the token; `test123` works, anything else shows an error.
5. Posting a review titled `<b>hi</b>` shows the literal text, not bold text.
6. The browser's developer console shows no Content-Security-Policy errors.

## 8. Not changed / worth knowing

- The **"Upload photos from past events"** form on the home page posts to `upload.php`, which
  never existed in this Node app, so it has never worked. It was left in place with an
  explanatory comment. Building real uploads safely means checking file type and size on the
  server, renaming files, and storing them outside `public/`. Something like the `multer` package
  plus those checks would be the starting point.
- `public/dog.pug` is an unused older copy of the home page (there's no Pug engine set up), so
  it was left alone. It's safe to delete.
- The external links to `pzpentertainment.com` and `louisvilleweddingshows.net` still use
  `http://`. Switch them to `https://` if those sites support it.
- This update couldn't be run end to end because the build environment had no npm access. Every
  JavaScript file passes a Node syntax check, and the checklist above covers what to test after
  `npm install`.
