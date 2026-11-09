# Status Bar Provider Quota & Usage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port Orca's status bar provider quota and usage cluster (Used label, provider chips for Antigravity, Claude, Codex, Cursor, and refresh trigger) into `herdr-orca`'s `orca-status` mod with accurate layout and live probing behavior.

**Architecture:** A standalone module `mods/orca-status/usage.js` ports Orca's bucket extraction, tightest window selection, label formatting, and error classification algorithms. In `mods/orca-status/main.js`, the mod runs background probes via `cx.spawn`, sets up a 120s timer via `cx.timer.every`, handles click-to-refresh with animated icon spinning, and renders exact Orca status bar geometry and hover styling using `gpui-kit`.

**Tech Stack:** JavaScript (ES modules / QuickJS compatible), `gpui-kit`, `herdr` (`exec`, `readTextFile`, `theme`), Node `node:test` for unit testing.

**Spec:** [`docs/superpowers/specs/2026-11-09-status-bar-provider-usage-design.md`](file:///home/mhenke/Projects/herdr-orca/docs/superpowers/specs/2026-11-09-status-bar-provider-usage-design.md)

## Global Constraints

- **AGENTS.md Rule 1:** Port behavior from Orca. Do not transcribe or invent it. Every geometry value, color, status, and grouping rule traces to an Orca file and line.
- **AGENTS.md Rule 3:** Copy the owning function, not its outputs. Port the math and string formatting functions from Orca's modules into `usage.js`.
- **AGENTS.md Rule 9:** A mod must work alone. All marks (`svg`, `image`) must reside inside `mods/orca-status/`.
- **AGENTS.md Rule 10:** Async state uses module memory with `cx.notify()`.
- **AGENTS.md Rule 13:** A mod's `cx` lives for one call. Always pass `cx` from callbacks to `cx.spawn` / `cx.timer.every`. Never store `this.cx = cx`.
- **Licensing:** Copied or ported Orca logic includes attribution comments and entries in `NOTICE`.

## Review Focus

1. **Missing or non-zero exit from `agy` CLI:** If `agy` is not installed or times out, Antigravity must fail gracefully without crashing the status bar or breaking sibling provider chips.
2. **Malformed or unexpected JSON from `agy`:** If `command.data.groups` is empty or missing, bucket selection must return null and keep the status bar stable.
3. **Empty or unconfigured provider credentials:** If Claude, Codex, or Cursor have no local auth files, they must render their accurate Orca fallback state (e.g. `Refresh failed` for Claude) or stay cleanly hidden rather than displaying undefined.
4. **Concurrent manual and interval refreshes:** Repeated rapid clicks on the refresh button must not spawn multiple conflicting probes; an `isRefreshing` guard must debounce in-flight probes.
5. **Clean isolated installation:** When synced into a fresh `HERDR_APP_HOME` via `scripts/sync.sh`, `orca-status` must resolve all SVGs and PNGs without referencing any other mod folder.

---

### Task 1: Self-Contained Assets Setup

**Files:**
- Create/Copy: `mods/orca-status/antigravity.png`
- Create/Copy: `mods/orca-status/claude.svg`
- Create/Copy: `mods/orca-status/codex.svg`
- Create/Copy: `mods/orca-status/cursor.svg`
- Create/Copy: `mods/orca-status/triangle-alert.svg`

**Interfaces:**
- Produces: Local icon assets inside `mods/orca-status/` loadable via `image("mods/orca-status/<name>.png")` and `svg("mods/orca-status/<name>.svg")`.

- [x] **Step 1: Copy `antigravity.png` from Orca shared icons**

Copy `~/Projects/orca/src/shared/agent-icons/antigravity.png` to `mods/orca-status/antigravity.png`.

- [x] **Step 2: Copy `claude.svg` from Orca status bar icons**

Extract the SVG path from `~/Projects/orca/src/renderer/src/components/status-bar/icons.tsx:327-339` into `mods/orca-status/claude.svg` with `viewBox="0 0 24 24"` and fill `#D97757`.

- [x] **Step 3: Copy `codex.svg` and `cursor.svg`**

Extract `OpenAIIcon` path from `~/Projects/orca/src/renderer/src/components/status-bar/icons.tsx` to `mods/orca-status/codex.svg`. Copy Cursor icon or SVG from Orca assets into `mods/orca-status/cursor.svg`.

- [x] **Step 4: Copy `triangle-alert.svg` from `mods/orca-changes`**

Copy `mods/orca-changes/triangle-alert.svg` to `mods/orca-status/triangle-alert.svg`.

- [x] **Step 5: Verify all assets exist**

Run: `ls -la mods/orca-status/antigravity.png mods/orca-status/claude.svg mods/orca-status/codex.svg mods/orca-status/cursor.svg mods/orca-status/triangle-alert.svg`
Expected: All 5 files exist.

- [x] **Step 6: Commit**

```bash
git add mods/orca-status/
git commit -m "feat(orca-status): add standalone provider icon assets"
```

---

### Task 2: Port Quota Parsing, Tightest Window Selection, and Label Formatting

**Files:**
- Create: `mods/orca-status/usage.js`
- Test: `mods/orca-status/usage.test.js`

**Interfaces:**
- Produces in `mods/orca-status/usage.js`:
  - `parseAntigravityOutput(stdout: string): { groups: Array<{ name: string, buckets: Array<Bucket> }> } | null`
  - `getTightestUsageBucket(groups: Array<{ name: string, buckets: Array<Bucket> }>): { bucket: Bucket, groupName: string } | null`
  - `shortenGroup(group: string): string`
  - `formatWindowLabel(windowMinutes: number): string`
  - `formatPoolShortLabel(groupName: string, bucket: Bucket): string`
  - `clampUsedPercent(pct: number): number`

- [x] **Step 1: Write unit tests in `mods/orca-status/usage.test.js`**

Write unit tests exercising:
1. `parseAntigravityOutput` on realistic `agy` JSON (including the live envelope captured from `agy -p /usage`).
2. `getTightestUsageBucket` finding the bucket with smallest `remaining_fraction` (highest used %).
3. `shortenGroup("Gemini Models")` -> `"Gemini"`.
4. `formatWindowLabel(10080)` -> `"wk"`, `formatWindowLabel(300)` -> `"5h"`.
5. `formatPoolShortLabel("Gemini Models", { windowMinutes: 10080, ... })` -> `"Gemini wk"`.
6. Malformed JSON handling (returns null instead of throwing).

- [x] **Step 2: Run test to verify it fails**

Run: `node --test mods/orca-status/usage.test.js`
Expected: FAIL with "Cannot find module './usage.js'"

- [x] **Step 3: Implement ported parsing and formatting functions in `mods/orca-status/usage.js`**

Port functions from Orca:
- `antigravity-usage-response.ts:22-118` (bucket extraction and parsing)
- `UsageRosterPanel.tsx:61-73` (tightest bucket reduction)
- `usage-pool-label.ts:28-66` (`shortenGroup`, `formatPoolWindowName`, `formatPoolShortLabel`)
- `rate-limit-window-label.ts:4-27` (`formatWindowLabel`)
Include file attribution comment citing ported Orca sources.

- [x] **Step 4: Run test to verify it passes**

Run: `node --test mods/orca-status/usage.test.js`
Expected: PASS (all tests pass).

- [x] **Step 5: Commit**

```bash
git add mods/orca-status/usage.js mods/orca-status/usage.test.js
git commit -m "feat(orca-status): port quota parsing, bucket selection, and pool label formatting"
```

---

### Task 3: Provider Probing Integration for Antigravity, Claude, Codex, Cursor

**Files:**
- Modify: `mods/orca-status/usage.js`
- Test: `mods/orca-status/usage.test.js`

**Interfaces:**
- Produces in `mods/orca-status/usage.js`:
  - `probeAntigravity(execFn): Promise<ProviderUsageState>`
  - `probeClaude(readFileFn): Promise<ProviderUsageState>`
  - `probeCodex(readFileFn): Promise<ProviderUsageState>`
  - `probeCursor(readFileFn): Promise<ProviderUsageState>`
  - `probeAllProviders({ exec, readTextFile }): Promise<Record<string, ProviderUsageState>>`

- [x] **Step 1: Add probe tests in `mods/orca-status/usage.test.js`**

Add tests for:
1. `probeAntigravity` invoking `exec("agy", ...)` and returning status `ok` with `percent` and `label: "Gemini wk"`.
2. `probeAntigravity` returning status `error` when `exec` rejects or exits non-zero.
3. `probeClaude` returning status `error` with label `"Refresh failed"` when credentials are absent or unverified.
4. `probeCodex` returning status `unavailable` when `~/.codex/auth.json` is missing.
5. `probeCursor` returning status `unavailable` when `~/.cursor/auth.json` is missing.

- [x] **Step 2: Run test to verify it fails**

Run: `node --test mods/orca-status/usage.test.js`
Expected: FAIL (probe functions not defined).

- [x] **Step 3: Implement probing functions in `mods/orca-status/usage.js`**

Implement:
- `probeAntigravity`: runs `exec("agy", ["-p", "/usage", "--output-format", "json", "--print-timeout", "20s"], { timeout: 25000 })`, parses output, computes tightest bucket.
- `probeClaude`: checks `readTextFile("~/.claude.json")` or `~/.claude/`; reports error `"Refresh failed"` when unauthenticated/stale (matching [`usage-error-copy.ts:131`](file:///home/mhenke/Projects/orca/src/renderer/src/components/status-bar/usage-error-copy.ts#L131)).
- `probeCodex`: checks `readTextFile("~/.codex/auth.json")`.
- `probeCursor`: checks `readTextFile("~/.cursor/auth.json")`.
- `probeAllProviders`: runs probes concurrently with `Promise.allSettled`.

- [x] **Step 4: Run test to verify it passes**

Run: `node --test mods/orca-status/usage.test.js`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add mods/orca-status/usage.js mods/orca-status/usage.test.js
git commit -m "feat(orca-status): add provider probing for antigravity, claude, codex, cursor"
```

---

### Task 4: Status Bar UI Integration & Lifecycle in `mods/orca-status/main.js`

**Files:**
- Modify: `mods/orca-status/main.js`

**Interfaces:**
- Consumes from `usage.js`: `probeAllProviders`
- Consumes from `herdr`: `exec`, `readTextFile`, `theme`
- Consumes from `gpui-kit`: `View`, `div`, `svg`, `image`
- Consumes from `gpui-base`: `h_flex`

- [x] **Step 1: Update `OrcaStatus` view with lifecycle and state**

In `mods/orca-status/main.js`:
1. Add `init(_props, cx)` method:
   - Initialize `this.usage = { antigravity: null, claude: null, codex: null, cursor: null }`.
   - Initialize `this.isRefreshing = false`.
   - Call `this.refreshUsage(cx)`.
   - Schedule periodic polling: `cx.timer.every(120000, cx => this.refreshUsage(cx))`.
2. Add `refreshUsage(cx)`:
   - If `this.isRefreshing`, return early.
   - Set `this.isRefreshing = true`, call `cx.notify()`.
   - Spawn background probe via `cx.spawn(async (cx) => { ... })`.
   - On completion, assign `this.usage = results`, `this.isRefreshing = false`, call `cx.notify()`.

- [x] **Step 2: Render Orca Status Bar Usage Cluster**

Replace line 52 (`.child(div().flex_1())`) with:
1. Container: `h_flex().flex_1().min_w(0).items_center().gap(12)`
2. Roster group:
   - "Used" label: 11px text in `t.muted`.
   - Active provider chip (Antigravity):
     - `image("mods/orca-status/antigravity.png").size(13).rounded(2)`
     - Tabular text `11px`: `${item.usedPercent}% ${item.label}` in `t.foreground`
   - Error provider chip (Claude):
     - `svg("mods/orca-status/claude.svg").size(13)`
     - `svg("mods/orca-status/triangle-alert.svg").size(11).text_color(t.muted)`
     - Text `11px`: `"Refresh failed"` in `t.muted`
   - Other providers (Codex, Cursor): rendered when status is `ok` or active error.
3. Refresh button:
   - Click handler triggers `this.refreshUsage(cx)`.
   - `svg("mods/orca-status/refresh-cw.svg").size(11).text_color(t.muted)`
   - Hover highlight: `hover(s => s.text_color(t.foreground).bg("#404040b3"))`
   - Animated spin while refreshing: `.when(this.isRefreshing, el => el.spin(1000))`

- [x] **Step 3: Syntax and GPUI type verification**

Run: `node --check mods/orca-status/main.js && herdr-app check mods/orca-status`
Expected: Syntax check passes and `check passed: mods/orca-status`.

- [x] **Step 4: Commit**

```bash
git add mods/orca-status/main.js
git commit -m "feat(orca-status): render orca status bar usage cluster with live refresh"
```

---

### Task 5: End-to-End Verification & Documentation Updates

**Files:**
- Modify: `NOTICE`
- Modify: `CHANGELOG.md`

- [x] **Step 1: Update `NOTICE` with ported Orca files**

Add citations to `NOTICE` for:
- `src/main/rate-limits/antigravity-usage-response.ts`
- `src/renderer/src/components/status-bar/UsageRosterPanel.tsx`
- `src/renderer/src/components/status-bar/usage-pool-label.ts`
- `src/renderer/src/components/status-bar/usage-error-copy.ts`
- `src/renderer/src/components/status-bar/StatusBarProviderSegment.tsx`
- `src/shared/rate-limit-window-label.ts`

- [x] **Step 2: Clean install test in an isolated environment**

Run clean sync test:
`HERDR_APP_HOME=/tmp/fresh-orca-status-verify bash scripts/sync.sh`
`herdr-app check /tmp/fresh-orca-status-verify/mods/orca-status`
Expected: Sync succeeds, check passes in the clean standalone directory.

- [x] **Step 3: Run all unit tests**

Run: `node --test mods/orca-status/usage.test.js`
Expected: All tests pass.

- [x] **Step 4: Commit**

```bash
git add NOTICE CHANGELOG.md
git commit -m "docs: record NOTICE provenance for ported status bar usage cluster"
```
