# Contributing to BACR Triage

Thanks for helping build the BACR Patient Triage System. Everything lives in this one repository, so the workflow is simple.

## First-time setup

1. Install **git** (https://git-scm.com) and **Node.js 18+**.
2. Clone the repo:

   ```sh
   git clone https://github.com/wizdormer-collab/Bodija-Advanced-Centre-for-Rehabilitation.git
   cd Bodija-Advanced-Centre-for-Rehabilitation
   ```

3. Install dependencies:

   ```sh
   npm install
   ```

4. Start the app:

   ```sh
   npm run dev
   ```

   Open http://localhost:5173 in your browser.

## Playing edits safely

**Before you start**, pull the latest changes so you are not editing an old copy:

```sh
git pull
```

Create a branch with a short name describing what you are changing:

```sh
git checkout -b fix-result-print
```

Make your changes, then run the checks:

```sh
npm test        # scoring tests must pass
npm run build   # must complete without errors
```

Commit and push your branch:

```sh
git add .
git commit -m "Fix print layout on result screen"
git push -u origin fix-result-print
```

Open a **pull request** on GitHub (compare your branch → `main`) and ask someone from the team to review.

## Getting your own copy each time

If you do not have direct push access, use the **fork + PR** flow instead:

1. Click **Fork** on the repo page (your own copy).
2. Clone your fork, add the original as `upstream`:

   ```sh
   git clone https://github.com/<your-username>/Bodija-Advanced-Centre-for-Rehabilitation.git
   cd Bodija-Advanced-Centre-for-Rehabilitation
   git remote add upstream https://github.com/wizdormer-collab/Bodija-Advanced-Centre-for-Rehabilitation.git
   ```

3. Keep your fork in sync:

   ```sh
   git fetch upstream
   git checkout main
   git merge upstream/main
   git push origin main
   ```

4. Make edits on a branch, push to your fork, and open a PR against the main repo.

## Guidelines

- Keep it small: one focused change per branch/PR.
- Do not edit `dist/` or `node_modules` — they are generated/ignored.
- Leave comments only where they explain a non-obvious decision.
- If a change affects the scoring outcomes, update `tests/scoring.test.js` and the **Rules** defaults in `src/lib/defaultRules.json`.

## Bugs / ideas

Open an issue on the repo (Issues tab). Label it `bug` or `enhancement` so it is easy to sort.