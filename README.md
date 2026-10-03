# Diamond Nine

A single-player baseball quiz: twenty questions generated at runtime from all 30 MLB teams, scoring, answer explanations, a final recap, and replay. The purple quiz screen uses four colored answer tiles with shape icons. Each question has a 30-second countdown; choose Pause timer to play without time pressure. The website is plain HTML, CSS, and JavaScript. No account, backend, or dependency installation is required. The ready-to-use browser bundle is included.

## Question types

Every new round contains 20 questions: one guaranteed question of each of four types, plus 16 randomly selected types. The complete round and answer choices are shuffled. The start page accepts an optional text seed. The same seed recreates the same questions, distractors, and order. Blank input generates a new seed, which is shown during play and on the results screen. Play again replays that seed; Change seed returns to the start page. Seeds are case-sensitive, ignore leading/trailing spaces, and support up to 80 characters. Reproducibility applies to the current generation rules and team data.

1. **League and division:** Given a team name or logo, select its division such as NL East or AL West. Every team prompt displays its logo; rounds with multiple league/division questions include both named and logo-led question wording.
2. **City or region:** Given a nickname and logo such as Yankees or Twins, identify the city or region in the team's name. The caption uses only the nickname so it does not give away the answer. The Athletics are excluded from this type because their current name has no city or region prefix. All 30 teams remain available for other types.
3. **Odd team out:** Given a division, pick the one team outside it. Answer labels and captions use nicknames only, without city names. All four team logos appear in a 2×2 grid matching the colored answer tiles. Three choices are members and exactly one is outside.

Data and local SVG logos come from MLB's [2026 team data](https://statsapi.mlb.com/api/v1/teams?sportId=1&season=2026) and [team directory](https://www.mlb.com/team), collected October 2, 2026. Logos are embedded as SVG data URLs, so they need no separate file or network request. They load before the question timer starts; if a logo fails, its team name remains available. No live data request is needed to generate a round, so the quiz works locally and on GitHub Pages.

4. **City in the division:** Given a division, select the one named city or region represented there. A 2×2 grid shows a representative team logo for each answer location; the correct location uses a team in the target division. Distractors exclude every location represented in the target division, including shared cities such as New York and Chicago.

## Share your result

After the final question, Share score copies your points, correct-answer count, a one-sentence challenge, and a link inferred from the current browser URL. The link includes the seed and prefills it on the start page, so friends can play the same questions. If clipboard access fails, a selectable copy of the message is shown.

## Scoring

For a correct answer, `points = round(1000 × remaining milliseconds / 30000)`. Examples: 30 seconds remaining → 1,000 points; 15 seconds → 500 points; 3 seconds → 100 points. Wrong answers and timeouts earn zero. Only the final point value is rounded, to the nearest integer.

Timing uses the monotonic `performance.now()` clock and an absolute deadline. The browser's input timestamp is used when valid, so dispatch delay does not reduce points. Answer acceptance and scoring use the same time snapshot. Display updates do not drive scoring; delayed countdown callbacks cannot extend a question. The countdown shows whole seconds rounded upward, while scoring uses unrounded milliseconds.

Pausing preserves the exact milliseconds remaining. The running total and points earned appear after every answer or timeout. The final maximum is 20,000 points, alongside a separate correct-answer count.

Run `npm test` for deterministic scoring and timing checks.

## Run locally

With Node.js installed, run:

```sh
cd /Users/lindayao/Vibe/baseball-quiz
npm start
```

Open http://127.0.0.1:8000. Stop the server with Ctrl+C. To use another port, run `PORT=8001 npm start`.

You can also open `dist/index.html` directly in your browser. Fonts load from Google Fonts when connected; local fallback fonts work offline.

## Deploy on GitHub Pages

1. Create a GitHub repository and push the contents of `baseball-quiz/` to its default branch (`main` or `master`), including the `.github` folder. `package.json`, `dist/`, and `.github/` must be at the repository root.
2. In the repository, go to **Settings → Pages → Build and deployment → Source** and select **GitHub Actions**.
3. Under **Actions**, select **Deploy to GitHub Pages** and choose **Run workflow** on the default branch, or push a new commit to that branch.
4. When the workflow completes, find the website URL in **Settings → Pages** or the workflow's deployment result.

The included workflow uses Node.js 22, runs `npm test`, rebuilds the browser bundle, and publishes only `dist/` after the checks pass. It runs on pushes to `main` or `master`, and deploys only from the repository's default branch. No dependency installation is needed. Relative asset paths work both at a root domain and at a GitHub Pages repository URL, such as `https://YOUR_USERNAME.github.io/YOUR_REPOSITORY/`. Shared quiz links preserve that repository path.

Use **GitHub Actions** as the Pages source: selecting the repository root with **Deploy from a branch** will not publish the `dist/index.html` entry point at the site root.

See [GitHub's custom workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## Edit the quiz

- `dist/teams.js`: team names, nicknames, city/region, league, division, and logo paths.
- `dist/questions.js`: runtime question generation and answer choices.
- `dist/game.js`: game behavior and precise timing.
- `dist/logos/`: all 30 local SVG team logos.
- `dist/style.css`: layout, colors, and typography.
- `dist/index.html`: page structure and metadata.

Local hosting serves the same `dist/` files that GitHub Pages publishes. Run `npm run build` after editing JavaScript to refresh the single browser bundle, then reload the page. `npm start` and the GitHub Pages workflow rebuild it automatically.
