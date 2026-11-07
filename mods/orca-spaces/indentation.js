// Port of orca src/renderer/src/components/sidebar/worktree-list/rows/indentation.ts.
// Every card inset in Orca is derived here, so the constants are the only place a width
// can change. Hard-coding the results per row is what let the lane, indent and title drift.

export const SIDEBAR_TREE_INDENT = 18;
const PROJECT_WORKTREE_CARD_EXTRA_INDENT = 2;
export const FLUSH_CARD_CONTENT_PULLBACK = 4;
export const NEW_CARD_STYLE_STATUS_LANE_EXTRA_PULLBACK = 8;
export const FLUSH_CARD_MIN_CONTENT_INSET = 2;
export const WORKTREE_CARD_SURFACE_MARGIN = 4;
export const LINEAGE_IMMEDIATE_PARENT_STEP = SIDEBAR_TREE_INDENT + PROJECT_WORKTREE_CARD_EXTRA_INDENT;
export const LINEAGE_CHILDREN_INLINE_OFFSET =
  LINEAGE_IMMEDIATE_PARENT_STEP - WORKTREE_CARD_SURFACE_MARGIN - FLUSH_CARD_MIN_CONTENT_INSET;
const GROUPED_CARD_TITLE_HEADER_LABEL_OFFSET = 3;
export const PROJECT_GROUP_HEADER_BASE_PADDING = 10;
const PROJECT_GROUP_HEADER_INDENT = 10;
const MAX_PROJECT_GROUP_HEADER_DEPTH = 6;

const clampDepth = (d) => Math.max(0, Math.floor(Number.isFinite(d) ? d : 0));

export function getProjectGroupHeaderPaddingLeft(depth) {
  return PROJECT_GROUP_HEADER_BASE_PADDING + Math.min(clampDepth(depth), MAX_PROJECT_GROUP_HEADER_DEPTH) * PROJECT_GROUP_HEADER_INDENT;
}

export function getWorktreeCardContentIndent({ isGrouped, groupDepth, lineageDepth }) {
  const lineageIndent = clampDepth(lineageDepth) * SIDEBAR_TREE_INDENT;
  return isGrouped
    ? getProjectGroupHeaderPaddingLeft(groupDepth) + GROUPED_CARD_TITLE_HEADER_LABEL_OFFSET + lineageIndent
    : lineageIndent;
}

// `applyNewCardStyleStatusLaneOffset`: the new card's lane is 8px wider than the legacy one,
// and the pullback keeps the title on the header's label.
export function getFlushWorktreeCardPaddingLeft(contentIndent, applyNewCardStyleStatusLaneOffset = false) {
  const pullback = FLUSH_CARD_CONTENT_PULLBACK + (applyNewCardStyleStatusLaneOffset ? NEW_CARD_STYLE_STATUS_LANE_EXTRA_PULLBACK : 0);
  return contentIndent > 0
    ? Math.max(FLUSH_CARD_MIN_CONTENT_INSET, contentIndent - pullback)
    : FLUSH_CARD_MIN_CONTENT_INSET;
}

export function getNewCardStyleParentContentMarginLeft(contentIndent) {
  if (contentIndent <= 0) return 0;
  const legacyInnerPadding = Math.max(FLUSH_CARD_MIN_CONTENT_INSET, contentIndent - FLUSH_CARD_CONTENT_PULLBACK);
  const newInnerPadding = Math.max(FLUSH_CARD_MIN_CONTENT_INSET, contentIndent - FLUSH_CARD_CONTENT_PULLBACK - NEW_CARD_STYLE_STATUS_LANE_EXTRA_PULLBACK);
  const paddingShift = legacyInnerPadding - newInnerPadding;
  const remainingShift = NEW_CARD_STYLE_STATUS_LANE_EXTRA_PULLBACK - paddingShift;
  if (remainingShift <= 0) return 0;
  // Shallow rows hit the padding floor; finish with margin but never pass the inner edge.
  return Math.max(-newInnerPadding, -remainingShift);
}
