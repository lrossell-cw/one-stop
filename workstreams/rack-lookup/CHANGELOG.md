# Changelog: rack-lookup

Feature-level changes for this workstream only. Structural/repo-wide changes belong in the root `CHANGELOG.md`. Newest entries on top — never edit or remove a past entry; if something was wrong, add a new entry that corrects it.

---

## 2026-09-10 (correction)
- Correction: STATUS.md previously said "scoping only, no code scaffolded" — this was wrong. Real POC code already existed (React/Vite frontend, Node/Express backend), validated end-to-end against real CoreWeave Jira data, per the workstream's own `README.md`. STATUS.md rewritten to reflect actual state: validated POC, two open items blocking further deployment (Asset Management migration risk, hosting/token-location decision).
- Accepted: split batch-scan/walkthrough/Slack-post/Jira-ticket-creation functionality out of this workstream into a new **walkthrough** workstream that depends on rack-lookup's lookup capability, rather than expanding rack-lookup's own scope. rack-lookup stays single-lookup, read-only.

## 2026-09-10
- Accepted: initial scope captured — QR/barcode scan → Jira lookup via Labels-type custom fields (Asset Rack Location, serial, asset tag), backend-proxied token, "current" ticket = newest on SDA/DO project.
- Next: scope full implementation (stack details, UI flow, error handling) before starting code.
