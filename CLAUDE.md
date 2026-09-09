# One-Stop-Shop — PHX01 Site Tools

## What this is
An umbrella project bringing together internal PHX01 (US-WEST-02, Phoenix) site tools as separate **workstreams** in one repo. Each workstream is a self-contained tool that can be worked on, run, and reasoned about independently. Periodically, "combine" workstreams merge specific tools together into a unified experience — combining happens deliberately, one deliberate step at a time, never all workstreams at once.

Owner: Leo Rossell (Lead DCT, dct-ops team).

## Where things live
- **This file (`CLAUDE.md`)** — identity, repo structure, and working agreement. Rarely changes.
- **`BUILD_OUTLINE.md`** — the living plan: what each workstream is, its scope, its status, and what's left to build. This is the file to read to understand "what are we building and where does it stand." Updated as workstreams are scoped, started, or change.
- **`CHANGELOG.md`** (root) — structural/cross-cutting changes: repo restructures, new workstreams added, combine events, shared tooling changes.
- **`workstreams/<name>/CHANGELOG.md`** — feature-level changes within that specific workstream.
- **`workstreams/<name>/README.md`** — human-facing summary of that workstream (what it does, how to run it), for anyone opening that folder without full project context.

## Repo structure

```
CLAUDE.md              <- this file
BUILD_OUTLINE.md        <- living plan across all workstreams
CHANGELOG.md            <- root-level, structural/cross-cutting changes
/workstreams
  /fiber-tracker
    CHANGELOG.md         <- feature-level changes for this workstream
    README.md
    data/ server/ shared/ web/ scripts/ ...
  /<other-workstream>/
    CHANGELOG.md
    README.md
    ...
/combine
  /<combine-name>/       <- a specific, named combination of workstreams (see Combine workstreams below)
```

- Each workstream folder is self-contained: its own `package.json`, its own frontend/backend if it needs one, its own `README.md` and `CHANGELOG.md`.
- Workstreams do **not** assume they'll be combined — build each to work standalone first.
- A workstream gets its docs (README, CHANGELOG, section in BUILD_OUTLINE.md) **only once work on it actually begins** — don't pre-scaffold docs for ideas that haven't started. The full list of anticipated workstreams lives in BUILD_OUTLINE.md's backlog section, as names only, until then.

## Combine workstreams
- A "combine" is a specific, named, scoped merge of two or more existing workstreams — e.g. `combine/fiber-and-rack-lookup/` — not a single all-in-one app.
- No combines are planned in advance. They surface naturally once workstreams exist and an overlap becomes concrete (shared data, shared users, one workstream feeding another) — see `BUILD_OUTLINE.md`'s "Combine backlog" for how a candidate gets noted and discussed before being built.
- Combines happen one at a time, deliberately, once the workstreams being merged are each independently stable. Never combine everything in one go.
- Each combine gets its own folder under `/combine`, its own README describing which workstreams it merges and why, and its own section in BUILD_OUTLINE.md.

## Working agreement (applies to all workstreams)
- Ask clarifying questions before scaffolding anything ambiguous.
- Commit incrementally with clear messages as features land, rather than one large commit.
- Prefer swappable data layers (clean interface between "where data comes from" and "how it's rendered/used") since sources of truth are expected to evolve — e.g. CSV/PDF-derived data now, live Google Sheets or Jira/NetBox APIs later.
- This is a Claude Project without direct filesystem/git access: Claude produces file contents in chat; Leo copies them into the real repo and runs git himself. Any instruction to "update," "commit," or "restructure" means: draft the exact file contents and/or exact git commands for Leo to run — never assume the change has already landed in the real repo.

## End-of-session ritual
See `BUILD_OUTLINE.md`'s "End of session" section for the full checklist. Summary: at the end of a substantial session, Claude asks whether to run the wrap-up. If yes, Claude (1) updates BUILD_OUTLINE.md and the relevant CHANGELOG(s) with what happened, (2) hands back the full updated doc contents for Leo to paste over the current project knowledge files, and (3) drafts the git commit command(s) to run locally.
