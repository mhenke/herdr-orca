// Agent session transcript extraction, ANSI sanitization, and continuation/fork prompt synthesis.
// Ported directly from Orca:
//   - src/renderer/src/lib/agent-session-fork-context.ts:1-160
//   - src/renderer/src/lib/agent-session-continuation.ts:57-140

const MAX_FORK_CONTEXT_CHARS = 36000;
const MAX_FORK_CAPTURE_SANITIZE_CHARS = MAX_FORK_CONTEXT_CHARS * 4;
const ESCAPE_CODE = 27;
const BELL_CODE = 7;

function tailBoundForkCapture(value) {
  if (value.length <= MAX_FORK_CAPTURE_SANITIZE_CHARS) return value;
  return value.slice(-MAX_FORK_CAPTURE_SANITIZE_CHARS);
}

function findOscSequenceEnd(value, index) {
  for (let cursor = index; cursor < value.length; cursor++) {
    const code = value.charCodeAt(cursor);
    if (code === BELL_CODE) return cursor;
    if (code === ESCAPE_CODE && value[cursor + 1] === "\\") return cursor + 1;
  }
  return null;
}

function findCsiSequenceEnd(value, index) {
  let cursor = index;
  while (cursor < value.length) {
    const code = value.charCodeAt(cursor);
    if (code < 48 || code > 63) break;
    cursor++;
  }
  while (cursor < value.length) {
    const code = value.charCodeAt(cursor);
    if (code < 32 || code > 47) break;
    cursor++;
  }
  return cursor < value.length && value.charCodeAt(cursor) >= 64 && value.charCodeAt(cursor) <= 126
    ? cursor
    : null;
}

function findTerminalEscapeEnd(value, escapeIndex) {
  const nextCode = value.charCodeAt(escapeIndex + 1);
  if (nextCode === 93) {
    return findOscSequenceEnd(value, escapeIndex + 2) ?? escapeIndex + 1;
  }
  if (nextCode === 91) {
    return findCsiSequenceEnd(value, escapeIndex + 2);
  }
  if ((nextCode >= 64 && nextCode <= 90) || (nextCode >= 92 && nextCode <= 95) || nextCode === 99) {
    return escapeIndex + 1;
  }
  if ("()*+-./".includes(value[escapeIndex + 1] ?? "") && escapeIndex + 2 < value.length) {
    return escapeIndex + 2;
  }
  return null;
}

function isUnsupportedTranscriptControl(code) {
  return code <= 8 || code === 11 || code === 12 || (code >= 14 && code <= 31) || code === 127;
}

// Strip terminal escape sequences, ANSI colors, CSI/OSC directives, and control codes.
// Orca: src/renderer/src/lib/agent-session-fork-context.ts:35-66
export function cleanAgentSessionForkTranscript(value) {
  if (!value || typeof value !== "string") return "";
  let result = "";
  let newlineRun = 0;

  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    if (code === ESCAPE_CODE) {
      const skippedIndex = findTerminalEscapeEnd(value, index);
      if (skippedIndex !== null) {
        index = skippedIndex;
        continue;
      }
    }
    if (code === 13 || code === 10) {
      if (code === 13 && value.charCodeAt(index + 1) === 10) {
        index++;
      }
      if (newlineRun < 3) {
        result += "\n";
      }
      newlineRun++;
      continue;
    }
    if (isUnsupportedTranscriptControl(code)) {
      continue;
    }
    result += value[index];
    newlineRun = 0;
  }

  return result.trim();
}

// Bounded plain-text transcript suitable for context copying or prompt embedding.
// Orca: src/renderer/src/lib/agent-session-fork-context.ts:123-128
export function buildBoundedSessionTranscript(capturedText) {
  if (!capturedText) return null;
  const cleaned = cleanAgentSessionForkTranscript(tailBoundForkCapture(capturedText));
  if (!cleaned) return null;
  return cleaned.length <= MAX_FORK_CONTEXT_CHARS ? cleaned : cleaned.slice(-MAX_FORK_CONTEXT_CHARS);
}

// Markdown fence helper to avoid collision with backticks in captured transcripts.
// Orca: src/renderer/src/lib/agent-session-fork-context.ts:13-25
function getMarkdownFence(value) {
  let longestFence = 0;
  let currentFence = 0;
  for (let index = 0; index < value.length; index++) {
    if (value[index] === "`") {
      currentFence++;
      longestFence = Math.max(longestFence, currentFence);
    } else {
      currentFence = 0;
    }
  }
  return "`".repeat(Math.max(3, longestFence + 1));
}

// Synthesizes the prompt for a forked agent session.
// Orca: src/renderer/src/lib/agent-session-fork-context.ts:130-160
export function buildAgentSessionForkPrompt({ capturedText, sourceLabel, agentLabel }) {
  const transcript = buildBoundedSessionTranscript(capturedText);
  if (!transcript) return null;
  const fence = getMarkdownFence(transcript);

  const header = [
    "This is a fork of an existing Orca agent session.",
    "",
    "Use the captured transcript as background context for this new, independent session. Keep file edits and decisions independent from the original terminal unless I explicitly ask you to coordinate with it.",
    "",
    sourceLabel ? `Source: ${sourceLabel}` : null,
    agentLabel ? `Original agent: ${agentLabel}` : null,
    "",
    "Captured terminal transcript:",
    `${fence}text`
  ].filter(Boolean);

  return [
    ...header,
    transcript,
    fence,
    "",
    "Acknowledge that you have the forked context, then wait for my next instruction."
  ].join("\n");
}

// Synthesizes the prompt for a hand-off / continuation session in another agent.
// Orca: src/renderer/src/lib/agent-session-continuation.ts:57-140
export function buildAgentSessionContinuationPrompt({ sourceAgent, sourceWorkingDirectory, capturedText }) {
  const transcript = buildBoundedSessionTranscript(capturedText);
  if (!transcript) return null;
  const fence = getMarkdownFence(transcript);

  const sourceLines = [
    sourceAgent ? `Original agent: ${sourceAgent}` : null,
    sourceWorkingDirectory ? `Original working directory: ${sourceWorkingDirectory}` : null,
  ].filter(Boolean);

  return [
    "Continue work from the prior Orca session using the context below.",
    "The prior provider session is read-only context; do not resume or modify it.",
    "",
    ...sourceLines,
    ...(sourceLines.length > 0 ? [""] : []),
    "Captured transcript:",
    `${fence}text`,
    transcript,
    fence,
    "",
    "Acknowledge that you have the context and tell me what the next step is."
  ].join("\n");
}
