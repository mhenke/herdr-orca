# 0014 — Mod-Side Provider Quota Probing

- **Status**: accepted
- **Date**: 2026-11-09

## Context

In Orca, the status bar renders a usage cluster (`StatusBarUsageCluster.tsx:136`) displaying live quota chips for active AI providers (e.g. Antigravity, Claude, Codex, Cursor), showing the tightest rate limit consumption percentage and reset window (e.g. `60% Gemini wk`), or an error chip (e.g. `⚠ Refresh failed`). Orca backs this with an internal desktop service layer (`src/main/rate-limit/*`, `src/main/usage/*`, `src/main/services/quota-sync-service.ts`) that communicates directly with provider endpoints and maintains persistent token caches.

Herdr App has no native subsystem, data model, or API for LLM accounts, token usage, or provider rate limits. Its Rust backend (`model.rs`) models only workspaces, spaces, tabs, terminals, and git checkout state.

A future maintainer inspecting `mods/orca-status/usage.js` will wonder why a UI status bar mod is executing child processes (`cx.spawn`) and probing local CLI tools rather than subscribing to a native Herdr event or reading an application-level store.

## Decision

Implement provider quota probing directly within `mods/orca-status` using non-blocking asynchronous child processes (`cx.spawn`) targeting the provider CLIs already signed in on the machine. Two sources exist, and both report numbers: `agy -p /usage --output-format json` (Antigravity, ported from `antigravity-usage-command.ts`) and `omp usage --json` (whichever providers OMP holds accounts for, e.g. Command Code, GitHub Copilot).

A source that cannot produce a percentage produces **no chip**. Presence of a credential file is not a reading: the earlier version of this mod tested `~/.claude.json` for `oauthToken` and drew a Claude chip off that, and probed `~/.codex/auth.json` / `~/.cursor/auth.json` to draw chips with empty labels. None of the three could ever show a number, because Orca's real fetchers are signed HTTP calls this package does not have: `api.anthropic.com/api/oauth/usage` with an OAuth bearer (`claude-oauth-usage-request.ts:19,49-56`), `chatgpt.com/backend-api/wham/usage` with stored bearer headers (`codex-backend-usage-client.ts:69`), and Cursor's dashboard behind a session JWT. Shipping a chip whose number is permanently absent is the static-placeholder failure below, wearing an icon.

`omp usage --json` is the honest path to those same providers: it uses OMP's own stored sessions, needs no headers from us, and returns `usedFraction` per metered window.

Readings cache in module state, refresh on Orca's 120-second cadence (`cx.timer.every`) and immediately on the `refresh-cw` button. Each source is reduced to its tightest window using Orca's rules, and a probe that fails maps to Orca's warning chip without throwing on the render path.

Chips draw from one flat list of `{ provider, status, label, buckets }`, not from a field per provider. Orca's cluster is the same shape (`ProviderRateLimits`, `status-bar-usage-sections.ts`), and the fixed-field version is what made adding a provider a edit in three places. Antigravity's buckets carry a `group` (its model pools are separate quotas under one provider); an OMP provider's do not, because OMP meters the provider as a whole — so `formatBucketChipLabel` names the group only when there is one, and an OMP chip reads `5% 5h` beside the provider's own mark rather than repeating the provider's name.

## Alternatives considered

- **Patch or wait for native provider quota APIs in Herdr App core.** Rejected: Herdr App is an upstream dependency. Modifying its Rust core would prevent `herdr-orca` from running as a clean, declarative mod package across stock Herdr installations.
- **Ship an external background daemon or local HTTP proxy.** Rejected: Violates package shape parity (no `bin/`, no background services, no daemons). It introduces external service management, start-up ordering issues, and installation fragility across user machines.
- **Direct HTTP API calls from mod JavaScript using user-entered API keys.** Rejected: Requires users to duplicate credentials already configured in their CLIs, and introduces security risk storing raw API tokens in mod configuration files. CLI probing leverages credentials and sessions already established on the local machine.
- **Re-implement Orca's signed fetchers against on-disk OAuth credentials.** Rejected: the credentials are not ours to spend (a token refresh would rotate the user's login under their other tools), and every one of them can expire, be keychain-scoped, or be keyed differently per platform. Three unverifiable paths whose only visible failure mode is a chip that is silently wrong forever. `omp usage` covers the same accounts with a maintained client.
- **Render a static gap or placeholder.** Rejected: Rate limit visibility is an active operational control in Orca. Displaying invented or static quota numbers violates Rule 1 and ETHOS.md (user report is ground truth).

## Consequences

- `mods/orca-status` remains 100% self-contained, requiring no external system daemons or core Herdr App modifications.
- Probing runs asynchronously off the UI thread via `cx.spawn`, keeping GPUI rendering responsive.
- Provider assets (`antigravity.png`, `command-code.svg`, `copilot.svg`, `claude.svg`, `codex.svg`, `cursor.png`, `triangle-alert.svg`) are bundled directly within `mods/orca-status/` in accordance with Rule 9. A provider this mod ships no mark for takes Orca's per-provider letter instead (`StatusBarProviderSegment.tsx:184-212`), so a new `omp usage` provider appears with a readable chip before anyone draws its icon.
- Probes resolve a CLI through PATH first, then Herdr's install folders (`~/.bun/bin` and friends), because a desktop launch's PATH is not the login shell's — `omp` lives in `~/.bun/bin` and a bare `exec("omp", …)` fails, which is what left the bar with one chip. Orca does the same (`node-cli-command-resolution.ts:123-140`).
- No reading is drawn per tab or per pane. Orca's usage cluster follows the account owner of the focused *workspace*, never the focused tab or agent (`use-owner-usage-rate-limits.ts:55-58`); its only per-session usage is the composer ring over a structured agent-session journal (`NativeChatContextUsageRing.tsx`), which a terminal-backed chat does not have. A per-tab chip here would be invented behavior, and Herdr exposes no per-tab quota to invent it from.
- Provider quota errors are explicitly separated from Herdr's space, tab, and agent status vocabulary (`working | blocked | done | idle`).
- `GLOSSARY.md` standardizes the terms **Usage cluster**, **Usage chip**, **Unit label**, **Quota pool**, **Tightest window**, **Provider quota error**, and **Usage refresh trigger**.
