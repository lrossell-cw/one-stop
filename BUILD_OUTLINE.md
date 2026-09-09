# Build Outline

The living plan: what each workstream is, its current scope, its status, and what's left. Update this whenever a workstream's scope changes, a new one starts, or one's status moves forward. See `CLAUDE.md` for repo structure and the working agreement.

**Status legend:** `backlog` (named, not started) · `scoping` (being defined) · `in progress` · `stable` (usable, may still evolve) · `combined` (folded into a combine workstream)

---

## Active workstreams

### fiber-tracker — `in progress`
Interactive PHX01 site map + inter-hall fiber run tracker (MMR ↔ DH151 ↔ DH120 ↔ DH160). Full scope detail: `workstreams/fiber-tracker/README.md`.

### rack-lookup — `scoping`
QR/barcode scan of a rack's Jira "Asset Rack Location" to look up matching tickets, serial, and asset tag. Full scope detail: `workstreams/rack-lookup/README.md` (once started).

---

## Backlog

Named, not yet scoped or started. Listed here so they're not lost — no folder, README, or CHANGELOG exists yet for these. Move a line into "Active workstreams" (with its own section + folder + docs) when work actually begins.

- **MMR fiber cascade manager** — likely related to / may extend fiber-tracker's MMR hop logic; needs scoping to determine if it's a feature of fiber-tracker or a standalone workstream.
- **Walkthrough tool**
- **Escort** — likely relates to the existing Escort ticket request-type work in Jira/JSM; needs scoping to determine overlap.
- **Consumables**
- **Owl tester**
- **Key holder manager**
- **SOP collection**
- **To-do list** — one workstream. Distinguishes by **request direction**, not by separate DCT/DCM tools:
  - **DCT → DCM**: tasks only a DCM can complete (e.g. site/DCAT access requests, on-site facilities portal requests).
  - **DCT → DCT** / **DCM → DCT**: tasks routed to or between DCTs.
  Data model should carry requester role, target role (or "any DCT"), and task type — needs scoping to confirm whether direction implies different permissions/visibility, not just a label.
- **Hosting** — evaluate and set up a company-approved platform to host one-stop-shop workstreams on the floor, replacing the "Vercel/Netlify/internal server, TBD" placeholder in each workstream's stack notes.
  - **Leading candidate: Canvas** — CoreWeave's internal app-hosting platform (live, `Available now` per the AI Tools catalog). Recommended fit: built for exactly this stack (React/Next.js + Express.js + CoreWeave-managed Postgres), handles auth/secrets/networking so workstreams don't hand-roll them (relevant to rack-lookup's Jira token and fiber-tracker's persistent state store), and ships an AI-scaffolding skills library compatible with the Claude Code workflow already in use here.
  - **Before committing**: verify via Glean and `go/app-hosting-advisor` that Canvas fits DC-floor-specific requirements (network reach to the data hall floor, any offline/local-network needs for scanner-gun workflows) — Canvas is young (production launch this year) and its current adopters are office-based teams (Tax, RevOps, Marketing, IT, CX), not yet DC Ops floor tools. Confirm with the Data Infrastructure platform-owner team before treating this as settled.
  - Not started — verification step above needs to happen first.

## Combine backlog

No planned combines. Rather than architecting combinations in advance, combine ideas surface naturally once workstreams exist and their overlaps become concrete (e.g. shared data, shared users, or one workstream's output feeding another). When that happens:

1. Note the observed overlap here as a candidate, with which workstreams and why.
2. Discuss before committing — a combine only gets built once the workstreams involved are each `stable`.
3. Promote to an actual `/combine/<name>/` folder + section only once scoped.

*(no candidates yet)*

---

## End of session

At the end of a substantial working session, Claude asks: **"Want me to run the end-of-session wrap-up?"** If yes:

1. **Update this file** — move workstreams between sections if status changed, update scope notes, add anything new to the backlog.
2. **Update the relevant CHANGELOG(s)**:
   - Root `CHANGELOG.md` for structural/cross-cutting changes (new workstream folder created, repo restructure, combine event, shared tooling change).
   - `workstreams/<name>/CHANGELOG.md` for feature-level work within a single workstream.
3. **Hand back full file contents** for every doc touched — Leo pastes these over the current project knowledge files (this Project has no direct filesystem access, so nothing is saved until he does this).
4. **Draft git commands** for Leo to run locally, e.g.:
   ```
   git add -A
   git commit -m "<summary of session's changes>"
   git push
   ```
   Use a commit message that reflects the actual session (feature name, workstream, or "docs: update BUILD_OUTLINE and CHANGELOG" if it's a docs-only session).
