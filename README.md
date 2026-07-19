# QA Foundry

A self-contained QA & Test Engineer workspace — documentation, code history, a task board, a bug tracker, a bug-report generator, an API tester, and an offline AI toolkit. No build step, no server required.

## Getting started

Unzip the folder and open `index.html` in a browser (Chrome, Edge, or Firefox recommended). That's it — everything runs client-side.

> Some browsers restrict certain features (like IndexedDB) when opening files directly via `file://`. If folders, uploads, or tasks don't seem to save, either:
> - Use a browser that allows it (Chrome generally does), or
> - Serve the folder locally, e.g. `python3 -m http.server` from inside `qa-foundry/`, then visit `http://localhost:8000`.

## Pages

| File | Feature |
|---|---|
| `index.html` | Dashboard — quick stats and shortcuts |
| `documentation.html` | Colored folders + PDF/DOC/DOCX upload, or create a document directly in the app |
| `code-repository.html` | Automation scripts organized into colored folders, with full version history and diffing |
| `test-runner.html` | Write and run **unit** and **integration** test suites, Jest-style (`describe`/`it`/`expect`) — paste code, upload a file, or import straight from the Code Repository |
| `todo-board.html` | Jira-style kanban (To Do / In Progress / Retest / Open / Done / Closed) with comments, screenshot/video attachments, parent tasks, sprint, and environment |
| `timesheet.html` | Manual time entries (date, day, time in/out, hours-based lunch break, report/task, notes) with paid/sick leave tracked in the same sheet, an auto clock-in/out timer, an employee/pay-period header, and Excel/PDF/Word export |
| `bug-tracker.html` | Editable, Excel-style bug spreadsheet |
| `bug-generator.html` | Upload a spreadsheet of bugs → auto-generate formatted bug reports |
| `api-tester.html` | Postman-style request builder with history |
| `ai-assistant.html` | Offline QA toolkit (test case generator, test data generator, regex tester, selector helper, **AI test automation generator**) + optional bring-your-own-key AI chat |

## Where your data lives

Everything — documents, code versions, tasks, bugs, API history — is stored in this browser's **IndexedDB**, scoped to this page's origin. Nothing is uploaded anywhere. That also means:

- Data is per-browser, per-device. It won't sync across computers.
- Clearing your browser's site data will erase it. Use Documentation's downloads and Bug Tracker's CSV export to keep backups of anything important.
- Private/incognito windows usually wipe storage when closed.

## The Word template

`assets/docs/QA-Ticket-Documentation-Template.docx` is a ready-to-use ticket documentation template (ticket metadata, steps to reproduce, expected/actual results, environment, root cause, resolution, sign-off). Download it from the Documentation page, fill it in, and upload the finished `.docx` back into a folder — or skip the template entirely and hit **"Create document"** to write directly in the app. Created docs save as a Word-compatible `.doc`, show up in the file list alongside uploads, and have an Edit (pencil) action so you can reopen and revise them later. Body text supports bulleted lists — press Enter to continue the list.

## Timesheet

Log hours the way you like:

- **Manual rows**: click "Add entry" and fill in date, time in, lunch break, time out, report/task, and notes directly in the sheet. The Lunch Break field starts empty with a placeholder, just like the time fields, rather than showing a default `0`.
- **Lunch break, in hours**: type a decimal value up to 1 hour — `1` for a full hour, `0.5` for 30 minutes, `0.25` for 15 minutes, and so on. This is the only thing deducted from worked hours: Hours = (Time Out − Time In) − Lunch Break. Go over 1 hour and it's clamped automatically with a heads-up toast.
- The Day column (M/T/W/TH/F/S/Su) fills in on its own from the date.
- **Automation**: the "Clock in" button starts a live timer, auto-creates a row with today's date and the current time, and keeps ticking (persists even if you reload the page or close the tab and come back). "Clock out" fills the end time and computes the hours for you.
- **Employee & pay period header**: name, position, and pay period start/end are saved on this device and included automatically in every export.
- Every column header is centered, and Date, Day, Time In, Lunch Break, Time Out, and Hours are centered both horizontally and vertically for their values too — so if a row grows tall because of a long bulleted Report/Task or Notes entry, those fields stay centered in the middle of the row instead of getting stuck at the top. Report/Task and Notes keep their header centered but their own text stays left-aligned, since centering a growing bulleted list tends to make it harder to read — let me know if you'd rather have those fully centered too.
- Report/Task and Notes cells grow automatically as you type and support bulleted lists — press Enter to continue a list, and long entries wrap instead of overflowing.
- Task suggestions are pulled from your Task Board titles and past timesheet entries, so repeat entries autocomplete.
- **Leave tracking, right in the same sheet**: click "Add leave" for a row with a Leave Type dropdown (Paid Leave or Sick Leave) and a directly-editable Hours field (defaults to 8, for a standard full day). Time In/Out and Lunch Break aren't applicable to leave rows and show as disabled. Leave hours count toward the total but are also broken out in their own summary tile and export total, so you don't need a separate sheet for time off.
- Filter by date range (or use "This week") and see live totals: hours (including leave), leave hours, Lunch Break Total, entries, days logged, average per day, and today's hours.
- **Export** the currently filtered range as — every centered column stays centered both horizontally and vertically in all three, not just on screen (verified against the actual generated files, not just eyeballed), and leave rows show up clearly labeled (e.g. "LEAVE — Sick Leave") with their hours:
  - **Excel (.xlsx)** — a proper spreadsheet, via ExcelJS, with the employee/pay-period header and totals included.
  - **PDF** — a formatted table with a header, date range, and totals, via jsPDF.
  - **Word (.doc)** — a styled table (bulleted Report/Task and Notes rendered as real lists) that opens directly in Microsoft Word; this one needs no internet connection to generate, since it doesn't rely on an external library.

## Test Runner (unit & integration testing)

The Test Runner page ships a small Jest-style framework — `describe`, `it`, `xit` (skip), `beforeEach`/`afterEach`, and an `expect()` with matchers like `toBe`, `toEqual`, `toBeTruthy`, `toContain`, `toThrow`, `toHaveLength`, `toMatch`, and `.not`. It supports `async`/`await` test bodies, so integration suites can make real `fetch()` calls, chain multiple functions together, or exercise a full flow — the same CORS rule from the API Tester applies (the target API must allow browser requests).

- **Unit suites**: paste the function(s) you're testing plus your `describe`/`it` blocks into one editor and hit Run. A starter template is preloaded — use "Load template" any time to reset to it.
- **Integration suites**: same editor, but the starter template calls a real public API so you can see pass/fail and real error output end to end. Point it at your own endpoints.
- **Getting code into the editor**: paste directly (Ctrl/Cmd+V works anywhere in the textarea), click "Import from Code Repository" to pull in the latest version of any saved file, or "Upload file" to load a `.js`/`.ts`/`.py`/etc. file from disk.
- Every suite is saved (name, type, code, last run summary) so you can come back and re-run it later. The suite list shows a green/red/gray dot for last pass/fail/never-run status.
- Results show total/passed/failed/skipped counts, per-test timing, and the exact assertion error for failures.

## AI test automation

On the AI Assistant page, the **AI test automation** tool turns a plain description (and optionally pasted source code) into a runnable test suite. If you've connected your own API key on the AI chat tool, it uses that to generate the suite; otherwise it falls back to a built-in generator that recognizes common patterns (email/password validation, discounts, sorting, login/search/upload endpoints) and produces real `describe`/`it` code either way. Hit **"Send to Test Runner"** and it saves the suite and opens it directly in the Test Runner, ready to run.

## Code Repository folders

Automation scripts can now be organized into colored folders, the same way Documentation works: click "New folder," pick a color, and assign files to it from the "New file" dialog or by opening the folder first. The breadcrumb at the top of the file list lets you jump back to "All Files."

## About the AI Assistant

This project doesn't ship with a hosted AI model — there's no way to bundle a free hosted LLM into a static site without a backend and an API key that costs money per request. Instead, the AI Assistant page ships two things:

1. **Fully offline tools** (test case generator, test data generator, regex tester, selector helper) — genuinely free forever, no key, no internet required.
2. **An optional chat** where you can paste your own Anthropic or OpenAI API key (stored only in `localStorage` on your machine). Some providers block direct browser calls (CORS), so this may not always connect — if it doesn't, the offline tools still cover most day-to-day QA needs.

## API Tester and CORS

Browsers block cross-origin requests unless the target API explicitly allows them. Public/internal APIs that allow CORS will work fine; others will show a failed request in the response panel. This is a browser security limitation, not a bug in the tool.

## Customizing

- **Logo/favicon**: replace `assets/icons/logo.svg` and `assets/icons/favicon.svg` with your own artwork (keep the same file names, or update the `<link>`/`<img>` tags across the HTML files).
- **Colors**: all theme colors live in `css/variables.css`.
- **Folder structure**: `css/` for styles, `js/` for logic, `assets/` for icons and the Word template — each page is a standalone HTML file.
