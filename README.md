# BACR Patient Triage System

Frontend web app for **Bodija Advanced Centre for Rehabilitation**: staff complete a short structured intake at patient check-in and the app instantly computes a **complexity level**, a **risk level**, and a recommended **care pathway**.

Built with **React + Vite** (frontend only). Based on the project PRD + TRD for the BACR Triage System MVP.

## Features

- **Triage intake form** — patient name / DOB / file reference, functional domains, risk flags, and a red-flag Yes/No question
- **Instant scoring** — complexity, risk, and pathway computed in the browser, first-match-wins logic
- **Result screen** — clear, printable output with the recommended next step and a breakdown of how the result was reached
- **Admin rules screen** — edit thresholds, pathway mapping, and next-step text in-app; changes apply to new submissions immediately (no redeploy). Includes live preview, change history, and JSON export/import

## Run locally

Requires **Node.js 18+** and npm.

```sh
npm install
npm run dev      # start dev server (http://localhost:5173)
npm test         # run the unit tests for the scoring engine
npm run build    # production build into dist/
npm run preview  # preview the production build
```

## Demo auth

This MVP is frontend-only, so "sign in" is a demo role toggle (Staff vs Administrator):

- Pick **Staff** → intake form
- Pick **Administrator** → also gets the **Rules** screen

Real Supabase auth, a database, and server-side scoring were deliberately kept out of scope for this build — see the TRD for the intended production architecture.

## Scoring logic (from PRD §6.2)

```
Complexity: 1 domain → Simple · 2 → Moderate · 3+ → Complex
Risk:       0 flags → Low · 1–2 → Moderate · 3+ → High
```

Pathway — evaluated **top to bottom, first match wins**:

| Condition | Pathway |
|---|---|
| Red flag = Yes | REFER OUT |
| 1 domain AND 0 risk flags | SINGLE DOMAIN PATHWAY |
| 2 domains OR 1–2 risk flags | MODERATE / DUAL PATHWAY |
| 3+ domains OR 3+ risk flags | MDT + RISK SCREENING |

All thresholds and pathway rules live in `src/lib/defaultRules.json` and can be edited by an administrator from the **Rules** screen with no code release.

## Project structure

```
src/
├─ App.jsx                    # routes + auth gate
├─ lib/
│  ├─ scoring.js              # pure scoring engine (unit-tested)
│  ├─ defaultRules.json       # editable thresholds / pathway rules / next-step text
│  └─ storage.js              # localStorage persistence (rules, history, session)
├─ features/
│  ├─ login/                  # demo sign-in (Staff / Admin)
│  ├─ triage/                 # intake form
│  ├─ result/                 # result screen + print
│  └─ admin/                  # rules editor, preview, history, import/export
├─ components/Header.jsx      # app header
└─ styles/global.css          # plain CSS (no framework)
tests/scoring.test.js         # Vitest tests for the scoring engine
```

## Deployment

Static build — the `dist/` output can be hosted anywhere (Cloudflare Pages, Netlify, GitHub Pages). Per the PRD this app is staff-operated on a tablet/desktop at a single clinic site.

## License / status

Client prototype build — internal use. See `CONTRIBUTING.md` to set up the team's git workflow.