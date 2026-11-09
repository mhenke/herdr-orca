# 0014 — Mod-Side Provider Quota Probing

- **Status**: accepted
- **Date**: 2026-11-09

## Context

In Orca, the status bar renders a usage cluster (`StatusBarUsageCluster.tsx:136`) displaying live quota chips for active AI providers (e.g. Antigravity, Claude, Codex, Cursor), showing the tightest rate limit consumption percentage and reset window (e.g. `60% Gemini wk`), or an error chip (e.g. `⚠ Refresh failed`). Orca backs this with an internal desktop service layer (`src/main/rate-limit/*`, `src/main/usage/*`, `src/main/services/quota-sync-service.ts`) that communicates directly with provider endpoints and maintains persistent token caches.

Herdr App has no native subsystem, data model, or API for LLM accounts, token usage, or provider rate limits. Its Rust backend (`model.rs`) models only workspaces, spaces, tabs, terminals, and git checkout state.

A future maintainer inspecting `mods/orca-status/usage.js` will wonder why a UI status bar mod is executing child processes (`cx.spawn`) and probing local CLI tools rather than subscribing to a native Herdr event or reading an application-level store.

## Decision

Implement provider quota probing directly within `mods/orca-status` using non-blocking asynchronous child processes (`cx.spawn`) targeting installed local provider CLI utilities (`agy`, `claude`, etc.) and inspecting local credential stores on disk. 

Cache resolved quota states in module memory, automatically refreshing on a 120-second cadence via `cx.timer.every` and immediately on manual trigger when clicking the `refresh-cw` button. Parse and reduce multi-bucket provider limits to the tightest window using Orca's canonical rules, and map probe failures to Orca's standard warning chips without throwing UI render errors.

## Alternatives considered

- **Patch or wait for native provider quota APIs in Herdr App core.** Rejected: Herdr App is an upstream dependency. Modifying its Rust core would prevent `herdr-orca` from running as a clean, declarative mod package across stock Herdr installations.
- **Ship an external background daemon or local HTTP proxy.** Rejected: Violates package shape parity (no `bin/`, no background services, no daemons). It introduces external service management, start-up ordering issues, and installation fragility across user machines.
- **Direct HTTP API calls from mod JavaScript using user-entered API keys.** Rejected: Requires users to duplicate credentials already configured in their CLIs, and introduces security risk storing raw API tokens in mod configuration files. CLI probing leverages credentials and sessions already established on the local machine.
- **Render a static gap or placeholder.** Rejected: Rate limit visibility is an active operational control in Orca. Displaying invented or static quota numbers violates Rule 1 and ETHOS.md (user report is ground truth).

## Consequences

- `mods/orca-status` remains 100% self-contained, requiring no external system daemons or core Herdr App modifications.
- Probing runs asynchronously off the UI thread via `cx.spawn`, keeping GPUI rendering responsive.
- Provider assets (`antigravity.png`, `claude.svg`, `codex.svg`, `cursor.png`, `triangle-alert.svg`) are bundled directly within `mods/orca-status/` in accordance with Rule 9.
- Provider quota errors are explicitly separated from Herdr's space, tab, and agent status vocabulary (`working | blocked | done | idle`).
- `GLOSSARY.md` standardizes the terms **Usage cluster**, **Usage chip**, **Unit label**, **Quota pool**, **Tightest window**, **Provider quota error**, and **Usage refresh trigger**.
