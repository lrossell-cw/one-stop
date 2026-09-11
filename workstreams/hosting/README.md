# Hosting

**Workstream status:** scoping — verification not yet started. Blocks/precedes [[mobile-integration]] (queued right behind this in the backlog).

## What this is

Evaluate and set up a company-approved platform to host one-stop-shop workstreams, replacing the "Vercel/Netlify/internal server, TBD" placeholder that's been sitting in each workstream's stack notes. This is infrastructure the other workstreams depend on, not a floor tool itself — nothing else in the project can move past "runs on my laptop" until this resolves.

## Leading candidate: Canvas

CoreWeave's internal app-hosting platform. Listed `Available now` in the AI Tools catalog. Recommended fit:
- Built for exactly this stack: React/Next.js + Express.js + CoreWeave-managed Postgres — matches fiber-tracker's and rack-lookup's shape directly.
- Handles auth, secrets, and networking — directly relevant to rack-lookup's Jira token (currently a local `.env` file, one of its two open POC blockers) and fiber-tracker's need for shared persistent backend state.
- Ships an AI-scaffolding skills library for Claude Code/Codex/Cursor, compatible with the workflow already in use on this project.

**Not yet confirmed as the answer.** Canvas is young (production launch this year, ~12 apps live, concentrated in Tax/RevOps/Marketing/IT/CX — not yet DC Ops floor tools as far as known). Before treating it as settled:
- Verify via Glean and `go/app-hosting-advisor` that Canvas fits DC-floor-specific requirements: network reach to the actual data hall floor, and any offline/local-network needs for scanner-gun workflows (rack-lookup and walkthrough both depend on this).
- Confirm with the Data Infrastructure platform-owner team (Canvas's apparent owner) directly, since existing adopters are office-based teams, not floor operations.
- Any platform outside an approved list needs a security exception (`go/security-exception`) before real use — check whether Canvas already clears this or still needs it for a DC-floor use case.

## Why this matters for mobile

Real HTTPS mobile access (see the Mobile integration workstream, queued next) depends directly on where this deploys. Rack-lookup's own README already documented the concrete problem: the camera-scan fallback (`BarcodeDetector`) requires HTTPS or `localhost`, and silently fails over a plain `http://` LAN address during local dev. A real hosting decision resolves this properly instead of continuing to work around it with LAN-IP dev tricks.

## Scope boundaries
- This workstream is the *decision and setup* of a hosting platform — it does not include migrating every existing workstream onto it. Each workstream migrates on its own timeline once this resolves and once that workstream's owner is ready (consistent with the project's per-workstream merge-to-`main/` policy).
- Not deciding theming, CI/CD pipeline design, or other infrastructure concerns unless they turn out to be inseparable from the hosting choice itself.
