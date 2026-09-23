# Bill Audit

A browser-based rebuild of the NativeAudit Windows desktop app for the Office of the Divisional Accountant. You enter contractor bills, see deductions and net payable as you type, and print the official forms: Audit Notes, AES Register, Payment Register, Deduction Schedules, and the Note to Finance Officer.

It is a static web app, so GitHub Pages can host it for free with no server.

## Where the data lives

- Bills, contractors and budget heads are stored in the browser's own database (IndexedDB) on the computer where they are entered.
- **Nothing is uploaded.** GitHub serves only the app's code; it never sees any bill.
- Each browser profile has its own data. To move data or keep a safe copy, use **Backup & data → Download backup**, then **Restore** on the other computer.
- The Overview page reminds you when no backup has been made in the last 7 days.

### Moving from the desktop app

In NativeAudit, click **Backup JSON**. Then in this app, go to **Backup & data → Restore** and choose that file. Bills, contractors, budgets, extra items, excess quantities and audit notes are all imported. Amounts are recalculated from the imported inputs.

## Features

- Bill editor in seven sections, with a live computation panel: GST, income tax, WWC (cess and collection charge), retention, electricity, completion-delay and agreement-delay fines, total deductions, net payable, and the amount in words.
- Unsaved-changes warning, and Ctrl+S to save.
- Excess quantities, extra items and audit notes are saved together with the bill. You don't need to save the bill first.
- Bill list with search, status filter (Draft / Audited / Paid) and totals.
- Contractor and budget master data. Each bill keeps a copy of those details, so later edits don't change old printed forms.
- Print preview for all five forms, using the same A4 templates as the desktop app. **Print / Save PDF** opens the browser's print dialog.
- Light and dark themes, and layouts for desktop, tablet and phone.

## Calculation rules

`src/domain/calculator.ts` is a line-for-line port of the desktop `AuditCalculator`. It uses decimal arithmetic, so rounding matches C# `decimal` exactly. `src/domain/__fixtures__/golden.json` was produced by running test inputs through the desktop app's compiled `NativeAudit.Shared.dll`. The test suite checks that this app gives the same result on every field.

The port keeps two desktop rules as they are. Please check them with the office:

- A part-week late fine (1% of PAC) is charged even on **part** bills.
- When the completion fine goes over 10% of PAC, it becomes a flat ₹1,00,000.

## Differences from the desktop printouts

These fix fields that the desktop app left blank or filled wrongly:

| Field | Desktop app | This app |
|---|---|---|
| Actual date of completion (AES and Payment registers) | Always blank | Filled from the bill |
| Contractor name and address | Taken from the Master Data entry boxes, not the chosen contractor | Taken from the chosen contractor |
| GST no. and PAN no. on the deduction schedules | Always blank | Filled from the contractor |
| Year in register titles | Fixed at 2026-2027 | Fiscal year of the bill date |

## Development

Requires Node.js 22.12 or newer (CI uses Node 24).

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (calculator parity, backup import, reports)
npm run build      # production build in dist/
npm run preview    # serve the production build
```

## Deploying to GitHub Pages

The code lives at https://github.com/bazjhwfk/MG-UNIVERSITY-AUDIT.

1. On GitHub, open **Settings → Pages** and set **Source** to **GitHub Actions** (one-time setup).
2. Every push to `main` runs the **Test and deploy to GitHub Pages** workflow. It runs the tests, builds, and publishes to https://bazjhwfk.github.io/MG-UNIVERSITY-AUDIT/.

The build uses relative paths, so it works under any repository name.

> **Note:** On a free GitHub plan, a Pages site is public, and so is its repository. Nothing in the code is sensitive, and bill data never leaves each user's browser. Anyone with the link can open the app, but they'll only see an empty app with their own data.

## Project layout

```
src/
  domain/     calculator, amount-in-words, dates, bill model (no UI)
  data/       IndexedDB store and backup import/export (incl. desktop format)
  reports/    A4 print templates and the code that fills them
  state/      React context for data and UI (navigation, toasts, print)
  ui/         pages and components
```
