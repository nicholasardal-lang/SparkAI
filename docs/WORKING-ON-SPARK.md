# Working on Spark from either computer

Spark's designated GitHub source repository is https://github.com/nicholasardal-lang/SparkAI.

Use this repository for all future Spark source changes. The local publishing checkout at `work/publish-source` uses this repository as `origin`. Do not push changes to VincentO-creator/Spark. Preserve repository history; do not force-push over it.

1. On each computer, clone that repository using GitHub Desktop or Git.
2. Install Node.js 22.13 or later. In the project folder, run `npm ci` once.
3. Follow the one-time database setup under “Run on your computer” in the README. Then run `npm run dev` and open the local address it prints.
4. Before editing, pull the latest changes. When finished, commit and push your changes so the other computer can pick them up.

Local accounts and projects stay in that computer's local development database. Published accounts and projects live separately on the hosted website.

Keep API keys in local environment files or the hosting secret settings. Never upload those files to GitHub. Use `.env.example` as the list of supported settings. AI credits and a hosted OpenAI key are still needed to enable real AI replies.

Pushing to GitHub saves the source; it does not automatically update the published Sites website. Publishing requires building and deploying through Sites.

Before publishing changes, run `node --experimental-strip-types tests/core.test.mjs` and `npm run build`. Test signup, creating a project, and sending a message in the browser.

The signup gallery uses official Roblox thumbnail URLs, verified September 13, 2026, for BedWars (Easy.gg), Blade Ball (Wiggity.), DOORS (LSPLASH), and Fisch (Fisching). These are inspiration examples, not Spark-created games. Roblox CDN links may expire and should be refreshed from the Roblox thumbnails API when needed.
