# Orca Status Bar Provider Quota & Usage for Herdr App — Design Doc

Date: 2026-11-09  
Status: Proposed (Approach 1 selected)  
Author: Antigravity  

## Intent & The Why

In Orca, the bottom status bar surface ([`StatusBarSurface.tsx:120-301`](file:///home/mhenke/Projects/orca/src/renderer/src/components/status-bar/StatusBarSurface.tsx#L120-L301)) includes an interactive usage and quota cluster on the left side of the bar:
- A "Used" / "Remaining" unit label ([`UsageUnitLabel.tsx`](file:///home/mhenke/Projects/orca/src/renderer/src/components/status-bar/usage-unit-label.tsx))
- Provider rate-limit chips ([`StatusBarProviderSegment.tsx:266-350`](file:///home/mhenke/Projects/orca/src/renderer/src/components/status-bar/StatusBarProviderSegment.tsx#L266-L350)) displaying active usage percentages for tightest consumption pools (e.g. `60% Gemini wk` or `34% Gemini wk` for Antigravity)
- Error chips for unavailable/failing providers (e.g. Claude with `⚠ Refresh failed`)
- A refresh button ([`StatusBarSurface.tsx:280-298`](file:///home/mhenke/Projects/orca/src/renderer/src/components/status-bar/StatusBarSurface.tsx#L280-L298)) with `refresh-cw` icon

In `herdr-orca`, [`mods/orca-status/main.js:52`](file:///home/mhenke/Projects/herdr-orca/mods/orca-status/main.js#L52) currently leaves this left group as an empty `div().flex_1()`, noting that *"with no provider usage it stays empty. Herdr cannot back most of it, and nothing is faked."*

The goal is to port this behavior and visual layout into `herdr-orca`'s `orca-status` mod for four initial providers: **Antigravity**, **Claude**, **Codex**, and **Cursor**, using Herdr primitives ([`exec`](file:///home/mhenke/Projects/herdr-app/defaults/herdr.d.ts#L14), [`readTextFile`](file:///home/mhenke/Projects/herdr-app/defaults/herdr.d.ts#L26), and [`gpui-kit`](file:///home/mhenke/Projects/herdr-orca/mods/orca-status/gpui-kit.d.ts)).

---

## Goals, Non-Goals, Anti-Goals

### Goals
- **Self-contained mod ([AGENTS.md Rule 9](file:///home/mhenke/Projects/herdr-orca/AGENTS.md#L9))**:
  - All icons and code reside inside `mods/orca-status/`.
  - Assets added: `antigravity.png` (from Orca assets), `claude.svg` (`#D97757`), `codex.svg` / `cursor.svg` (or icon images), `triangle-alert.svg`, alongside existing `refresh-cw.svg`.
- **Accurate Orca Layout & Geometry**:
  - "Used" label in 11px `t.muted` (`#8e8e8e`).
  - Active provider chip: 13px provider mark + tabular percentage text + shortened group and window labels (`34% Gemini wk` / `60% Gemini wk`) formatted via Orca's algorithms ([`usage-pool-label.ts:28-66`](file:///home/mhenke/Projects/orca/src/renderer/src/components/status-bar/usage-pool-label.ts#L28-L66)).
  - Error chip: 13px provider icon + 11px warning triangle + `Refresh failed` in 11px `t.muted` ([`StatusBarProviderSegment.tsx:297-305`](file:///home/mhenke/Projects/orca/src/renderer/src/components/status-bar/StatusBarProviderSegment.tsx#L297-L305)).
  - Refresh button: 11px `refresh-cw.svg`, hover highlight, spins during refresh via `.spin(1000)`.
- **Ported Behavior ([AGENTS.md Rule 1](file:///home/mhenke/Projects/herdr-orca/AGENTS.md#L1))**:
  - **Antigravity**: Spawns `agy -p /usage --output-format json --print-timeout 20s` via `exec("agy", ...)`. Parses output using ported logic from [`antigravity-usage-response.ts`](file:///home/mhenke/Projects/orca/src/main/rate-limits/antigravity-usage-response.ts). Computes highest-consumed bucket via [`UsageRosterPanel.tsx:61-73`](file:///home/mhenke/Projects/orca/src/renderer/src/components/status-bar/UsageRosterPanel.tsx#L61-L73). Formats label (`shortenGroup(group) + " " + formatPoolWindow(bucket)`) via [`usage-pool-label.ts`](file:///home/mhenke/Projects/orca/src/renderer/src/components/status-bar/usage-pool-label.ts).
  - **Claude**: Inspects local Claude configuration / credentials (`~/.claude/` / `~/.claude.json`). If unauthenticated or token is expired/unrefreshable, classifies as error and displays `⚠ Refresh failed` ([`usage-error-copy.ts:131`](file:///home/mhenke/Projects/orca/src/renderer/src/components/status-bar/usage-error-copy.ts#L131)).
  - **Codex**: Inspects `~/.codex/auth.json` (or CLI presence). When configured with active session, maps primary and secondary windows; when missing/unconfigured, remains hidden or reports state.
  - **Cursor**: Inspects `~/.cursor/auth.json` or CLI presence. When configured, parses quota; when unconfigured, remains hidden or reports status.
- **Lifecycle & Notification ([AGENTS.md Rules 10 & 13](file:///home/mhenke/Projects/herdr-orca/AGENTS.md#L10))**:
  - Background probe launched on `init(_props, cx)` via `cx.spawn(...)`.
  - Periodic polling every 120s via `cx.timer.every(120000, cx => this.refresh(cx))`.
  - Interactive re-fetch on clicking the refresh icon.
  - Updates triggered via `cx.notify()`.

### Non-Goals
- Full Radix dropdown modal menus or account management dialogs (not part of the status bar feel/layout).
- Native OS keychain scraping for Claude/Cursor tokens; filesystem and CLI outputs are used.

### Anti-Goals
- Do not hardcode literal percentages or strings (`AGENTS.md Rule 1 & Rule 3`).
- Do not reference files outside `mods/orca-status/` (`AGENTS.md Rule 9`).
- Do not store `cx` on `this` (`AGENTS.md Rule 13`).

---

## Approaches

### Approach 1: Dedicated In-Mod Prober (`mods/orca-status/usage.js` + `mods/orca-status/main.js`) — *Selected*
- Build `mods/orca-status/usage.js` porting the calculation functions directly from Orca:
  - Antigravity JSON parsing and bucket extraction ([`antigravity-usage-response.ts`](file:///home/mhenke/Projects/orca/src/main/rate-limits/antigravity-usage-response.ts))
  - Tightest bucket selection ([`UsageRosterPanel.tsx`](file:///home/mhenke/Projects/orca/src/renderer/src/components/status-bar/UsageRosterPanel.tsx))
  - Window & group label formatting ([`usage-pool-label.ts`](file:///home/mhenke/Projects/orca/src/renderer/src/components/status-bar/usage-pool-label.ts), [`rate-limit-window-label.ts`](file:///home/mhenke/Projects/orca/src/shared/rate-limit-window-label.ts))
  - Error label classification ([`usage-error-copy.ts`](file:///home/mhenke/Projects/orca/src/renderer/src/components/status-bar/usage-error-copy.ts))
- Probes four providers (Antigravity, Claude, Codex, Cursor) using `exec` and `readTextFile`.
- Renders the exact Orca status bar usage cluster in `mods/orca-status/main.js`.
- *Trade-off*: Perfectly balanced between real functionality, isolation, and exact visual parity.

### Approach 2: Monolithic Backend Daemon
- Run an external Node background daemon to query all cloud endpoints via OAuth and sync to a local JSON file.
- *Trade-off*: Violates Herdr App mod package shape, adds external process overhead, and exceeds what is required.

---

## What's Decided
1. Providers: **Antigravity**, **Claude**, **Codex**, **Cursor**.
2. Mod location: `mods/orca-status/`.
3. Architecture: `mods/orca-status/usage.js` handles probing & parsing; `mods/orca-status/main.js` renders and wires the lifecycle (`init`, `refresh`, `timer`).
4. Assets: `antigravity.png`, `claude.svg`, `codex.svg`, `cursor.svg`, `triangle-alert.svg`, `refresh-cw.svg`.
