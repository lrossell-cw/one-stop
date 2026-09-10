# One-Stop-Shop — PHX01 Site Tools

## What this is
An umbrella project bringing together internal PHX01 (US-WEST-02, Phoenix) site tools as separate **workstreams** in one repo. Each workstream is a self-contained tool that can be worked on, run, and reasoned about independently. Periodically, "combine" workstreams merge specific tools together into a unified experience — combining happens deliberately, one at a time, never all workstreams at once.

Owner: Leo Rossell (Lead DCT, dct-ops team).

This project follows the project-workflow-template process (step loop + review loop, edited-vs-append-only doc discipline). This file explains how that process applies here, in a repo with multiple independent workstreams rather than one linear project.

## Where things live
- **`CLAUDE.md`** (this file) — identity, repo structure, and how the template's process applies here. Rarely changes.
- **`OUTLINE.md`** (root) — the living plan: goal, workstream list and status, backlog, ground rules, review triggers. **Read this first every session.** Edited in place — describes the present.
- **`CHANGELOG.md`** (root) — cross-workstream events only: a workstream marked done, a merge into `main/`, a review outcome, a goal revision. Append-only, newest entry on top. Not a log of every step from every workstream — that would stop being readable as a project-level narrative.
- **`REVIEWS.md`** (root) — full history of review checkpoints. Append-only, newest entry on top.
- **`workstreams/<name>/STATUS.md`** — that workstream's current state, scope, and open questions. A snapshot of "now" — edited in place, overwritten each session, not appended to.
- **`workstreams/<name>/CHANGELOG.md`** — that workstream's accepted/rejected step history. Append-only, newest entry on top — a history of "how we got here."
- **`workstreams/<name>/README.md`** — human-facing summary (what it does, how to run it) for anyone opening that folder without full project context. Not a process doc — doesn't get the step-loop treatment.
- **`main/`** — the accepted, current state of each workstream, once genuinely happy with the result. Named "main" (not "combined") because it describes its role — the accepted baseline everything else is proposed against — not its contents.

## Repo structure

```
CLAUDE.md               <- this file
OUTLINE.md               <- living plan: goal, workstreams, backlog, ground rules, review triggers
CHANGELOG.md             <- root-level, cross-workstream events only, append-only
REVIEWS.md               <- review checkpoint history, append-only
/workstreams
  /fiber-tracker
    STATUS.md             <- current state snapshot, edited in place
    CHANGELOG.md          <- step history, append-only
    README.md             <- human-facing how-to-run
    data/ server/ shared/ web/ scripts/ ...
  /<other-workstream>/
    STATUS.md
    CHANGELOG.md
    README.md
    ...
/combine
  /<combine-name>/        <- a specific, named combination of workstreams (see Combine workstreams below)
/main
  /<workstream-name>/     <- that workstream's accepted, current state, once merged
```

- Each workstream folder is self-contained: its own `package.json`, its own frontend/backend if it needs one, its own `STATUS.md`, `CHANGELOG.md`, and `README.md`.
- Workstreams do **not** assume they'll be combined — build each to work standalone first.
- A workstream gets its docs (STATUS.md, CHANGELOG.md, README.md, folder) **only once work on it actually begins** — don't pre-scaffold docs for backlog ideas. The full list of anticipated workstreams lives in `OUTLINE.md`'s backlog section, as names only, until then.
- **Merging to `main/` is per-workstream, not project-wide.** A workstream merges whenever its owner is genuinely happy with the result — never gated on other workstreams' progress. There is no single "the project is done" moment; `main/` fills in one workstream at a time.

## Combine workstreams
- A "combine" is a specific, named, scoped merge of two or more existing workstreams — e.g. `combine/fiber-and-rack-lookup/` — not a single all-in-one app.
- No combines are planned in advance. They surface naturally once workstreams exist and an overlap becomes concrete (shared data, shared users, one workstream feeding another) — see `OUTLINE.md`'s "Combine backlog" for how a candidate gets noted and discussed before being built.
- Combines happen one at a time, deliberately, once the workstreams being merged are each independently stable (i.e., already in `main/`). Never combine everything in one go.
- Each combine gets its own folder under `/combine`, its own README describing which workstreams it merges and why, and its own line in `OUTLINE.md`.

## How the step loop and review loop apply across workstreams
- Each session works on **one workstream at a time** (or root-level docs). State which one at the start of the session.
- Within that workstream: propose → show → accept/reject → commit, one change per step, exactly as the template describes. Never chain a second decision onto an accepted one without a checkpoint.
- Review triggers are evaluated **per workstream** for most cases (a workstream's STATUS.md marked done, before that workstream merges to `main/`) but the review itself is logged in the root `REVIEWS.md`, since reviews are a project-level concern — see `OUTLINE.md`'s Review triggers and Review log.
- A review does not re-litigate every accepted step — it asks whether the workstream (or the project as a whole, for project-level triggers) is still on track against `OUTLINE.md`'s goal.

## Working agreement (applies to all workstreams)
- Never fabricate content not present in a source file — flag gaps instead of filling them.
- Ask clarifying questions before scaffolding anything ambiguous.
- One change per step; show it before attempting the next change.
- Every accepted step = one commit, with a message describing the decision.
- Prefer swappable data layers (clean interface between "where data comes from" and "how it's rendered/used") since sources of truth are expected to evolve — e.g. CSV/PDF-derived data now, live Google Sheets or Jira/NetBox APIs later.
- This is a Claude Project without direct filesystem/git access: Claude produces file contents in chat; Leo copies them into the real repo and runs git himself. Any instruction to "update," "commit," or "restructure" means: draft the exact file contents and/or exact git commands for Leo to run — never assume the change has already landed in the real repo.

## Session checklist (start of every chat)
1. Read root `OUTLINE.md`.
2. Read the `STATUS.md` for the workstream this session is about.
3. Skim that workstream's `CHANGELOG.md` if `STATUS.md`'s open questions need more context on how something got to its current state.
4. State the single goal for this session before starting work.
5. Work in single-change steps: propose → show → accept/reject → commit.
6. End the session by: updating that workstream's `STATUS.md` (overwrite, don't append); appending an entry to that workstream's `CHANGELOG.md`; appending to root `CHANGELOG.md` only if something crossed a project-level boundary (workstream done, merge to `main/`, review outcome, goal revision); drafting git commit command(s) for Leo to run.
