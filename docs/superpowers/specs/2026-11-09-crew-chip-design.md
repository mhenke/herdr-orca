# Crew chip — design

Date: 2026-11-09
Status: proposed
Mod: `mods/orca-pane`

## Problem

Orca's terminal pane carries an orchestration pill in its corner: stacked agent
marks and a count of the agents the pane's agent manages
(`src/renderer/src/components/orchestration-crew/OrchestrationCrewPanel.tsx:344-380`).
Nothing in herdr-orca draws it. This spec ports the collapsed pill and the list it
expands into.

## What Orca does

| Piece | Orca | Herdr |
|---|---|---|
| Visible only with a crew | `visible = snapshot.status === 'ok' && parties.length > 0` (`OrchestrationCrewPanel.tsx:220,243-245`) | Same gate, derived from `terminals()` |
| Count | `managing.length` | Children with a status |
| Agent marks | `CrewAgentStack` — up to 3 overlapping 16px circles, 13px mark, `-ml-1.5`, `+N` (`CrewAgentIcons.tsx:186-215`) | Same, marks from the program table |
| Status per group | `StatusIndicator` + stack, groups `needsYou / working / idle / failed` | `blocked / working / done / idle` (Herdr's four words) |
| Expanded card | 312px card, sections `Managed by` / `Managing` / `Talking with` with counts and rows (`OrchestrationCrewPanel.tsx:284-330`) | Popup, two sections; rows are lean |
| Button skin | `variant="orchestration-tab"`: `border-(--crew-border) bg-(--crew-surface) shadow-floating` (`button.tsx:19`) | `border t.border`, `bg t.raised`, no shadow |

Dropped, with the reason:

- `PanelRight` glyph and its divider — they read "open the right panel"; this opens a popup.
- `shadow-floating` — the theme has no shadow token.
- `Talking with` — Herdr has no peer or message relation.
- The card's collapse button and per-row menus — closing the popup is the collapse;
  focus is the only row action Herdr can perform.
- Rows' preview and "Waiting for you" lines — no task or question text in `AgentInfo`.

## Design

### Where it lives

`mods/orca-pane` draws the pane header. The chip is the **first child of the right
action cluster**, ahead of the `▷ Command` pill
(`mods/orca-pane/main.js:288-344`). Appending it after the close button would shift
that button whenever a crew appears; here split and close keep their positions and
only the draggable middle gives way.

It renders only when the pane is in a crew, so ordinary panes are unchanged.

### Chip

22px tall, `rounded 4`, `border_1 t.border`, `bg t.raised`, hover `bg t.hover`, gap 4.
Contents, in Orca's order:

1. `workflow.svg` 12px.
2. The managing count, 11px.
3. One cluster per non-empty status group: the group's `statusMark` 12px, then up to
   3 circles 16px wide holding the 13px agent mark of an agent **in that group**,
   each after the first pulled left 6px (`-6px` = Orca's `-ml-1.5`), then `+N` for
   the rest of that group.

Tooltip and accessible name: `Orchestration: 1 needs you, 2 working`, groups joined
with `, `.

### Data

```js
const pane = panes().find((p) => p.pane === props().pane);
const address = pane?.terminal;                       // null for mod panes
const all = terminals();                              // any[]; `parent`, `status`, `report.app`, `program`
const managing = all.filter((t) => t.parent === address && t.status);
const parentAddr = all.find((t) => t.address === address)?.parent ?? null;
const managedBy = parentAddr ? all.find((t) => t.address === parentAddr && t.status) : null;
```

- `terminals()` is documented at `gpui-kit.d.ts:22404-22407`; its fixture
  (`herdr-app/src/mods/render_tests.rs:99`) confirms `parent` is an address and
  `status` is the plain word.
- The agent's app key is `t.report?.app` here, not `t.app` — `agents()` has `app`,
  `terminals()` does not.
- Group order: `blocked`, `working`, `done`, `idle` — `Model::rollup`
  (`herdr-app/src/model.rs:554`). Orca's `needsYou` is Herdr's `blocked`, and its
  `failed` folds into `blocked` too, because `Model::status` maps `blocked | error`
  to "blocked" before a mod sees it; `working` and `idle` are the same word on both
  sides. `done` is Herdr's fourth word, so it gets its own group (AGENTS.md rule 4).
- Count = `managing.length` (Orca's `managing.length`). The stacks cover
  `managing` **and** `managedBy` (Orca's `looks` spans every party).
- Order inside a group: `terminals()` order (space, tab, pane), so marks do not
  shuffle on repaint.

### Repaint

`terminals()` is live but does not notify a mod — the reason `orca-float` runs a
timer (`mods/orca-float/main.js:98-106`). The header keeps a 1s timer, builds the
signature `address:status:parent` for every crew member, and repaints only when it
changes.

### Popup

The chip's `on_click`: `cx.stop_propagation()` (as every other header button does),
then

```js
openOverlay({ mod: "orca-pane", kind: "popup", width: 300, props: { pane, crew: true } });
```

`kind: "popup"` opens at the pointer and closes on a click beside it; Esc closes it
(`gpui-kit.d.ts:22527-22544`). No dismissal code of ours. The popup instance is the
same mod: `render` checks `props().crew` first and draws the card instead of the
header, the pattern `new-menu` uses for its overlay copy.

Card:

- 300px wide, content height.
- Header: `Orchestration`, 12px medium, 36px, `border_b`, `px(12)`.
- Sections, only when non-empty: `MANAGING 2` / `MANAGED BY 1` — 10px uppercase
  muted with the count, `uppercase tracking-wider` (`OrchestrationCrewPanel.tsx:305-313`),
  `px(12) pt(12) pb(6)`.
- Rows: 24px, `pl(12) pr(6) gap(4)`, `statusMark` 12px, agent mark 13px, name 12px
  truncated, hover `#4040402e`. Click runs `agent.focus { terminal }` then
  `closeOverlay(props().overlay)`.

### Edge cases

| Case | Behaviour |
|---|---|
| No children and no parent, or neither has a status | No chip (the visibility gate) |
| Parent terminal already ended | It is absent from `terminals()`, so `MANAGED BY` is not drawn |
| Child without a status (plain shell, `--no-parent` helper) | Not an agent, excluded — the rule `agents()` uses |
| Unknown `app`, or no program icon | That circle is skipped; the group's status mark and the count still draw |
| Mod pane (`pane.terminal === null`) | No chip |
| Crew changes while the popup is open | The popup re-renders from the same timer; a row whose agent vanished is dropped. It stays open until dismissed (click beside it, Esc, or a row click) |

If the popup comes up with the wrong height, pass one explicitly:
`36 + sections × 34 + rows × 24 + 12`.

## Assets (AGENTS.md rule 9)

Copied into `mods/orca-pane/`: `workflow.svg`, `agent-working-spinner.svg`,
`message-circle-question.svg`, and `agent-icons/{omp,droid,kilo,aider}.svg` plus
`agent-icons/{gemini,cursor,grok,qoder,hermes,dsh}.png` — the same 10 marks
`orca-spaces`, `orca-tabs` and `orca-float` each carry.

`done` and `idle` need no asset: `statusMark` draws emerald and neutral dots.

## Docs and provenance

- `NOTICE` gains the `mods/orca-pane/agent-icons/*` paths under Orca-derived assets.
- `README.md` (`orca-pane` bullet) and `RECIPE.md` (status/pane sections and the mod
  list) name the chip.
- The code comment names each dropped piece and its Orca source, per rule 1.

## Verification

1. `node --check mods/orca-pane/main.js`.
2. `python3 scripts/verify.py` — citations resolve, syntax, every mod loads, assets resolve.
3. `bash scripts/sync.sh`.
4. Live, both directions:
   - `hc run --parent <agent-terminal> --bg omp` — the chip must appear in that
     pane's header and the popup must list one `MANAGING` row; clicking the row must
     focus the child; `hc kill <child>` must remove the chip within 1s.
   - The child's own pane must show the parent under `MANAGED BY`.
5. `herdr-app shot` for the visual record; no error bar and `herdr-app status` shows
   `errors: []`.

## Out of scope

- `Talking with` (no data).
- Task state, pending question, preview and mention per row (no data).
- Any crew surface outside a terminal pane.
- Maximising the popup or pinning it open.
