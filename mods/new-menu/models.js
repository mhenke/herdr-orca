// Orca's per-agent models and the CLI flag each one takes.
// Ids are the CLI's own family aliases, chosen over pinned version names so they stay right
// across versions (`agent-session-option-catalog-claude-codex.ts:115`). Labels are Orca's.
// Portions derived from Orca's agent-session option catalogs:
//   claude, codex — agent-session-option-catalog-claude-codex.ts:116-183,222-268
//   gemini        — agent-session-option-catalog-gemini-cursor.ts:7-31
//   grok          — agent-session-option-catalog-grok.ts:54-83
//
// `models` is a seed; `probe` asks the agent itself, which is Orca's split too: an agent whose
// model list is scoped to the account (omp, antigravity) seeds none and discovers at launch
// (`agent-session-option-catalog-omp.ts:33`, `agent-session-option-catalog-antigravity.ts:33`).
//
// Named omissions, all deliberate:
//  - cursor: Orca launches it with a model value composed from thinking/effort/fast flags
//    (`agent-session-option-catalog-gemini-cursor.ts:105-119`), so a bare id is not what its CLI receives.
//  - opencode, muse, codebuddy: Orca seeds no models and lists none without a live agent
//    session (`agent-session-option-catalog-opencode.ts:5`, `agent-session-option-catalog-muse.ts:41`, `agent-session-option-catalog-codebuddy.ts:37`). They start with their own
//    default.
//  - Effort, fast mode, service tier and permission rows (`AgentLaunchSetupPanel.tsx:283-399`)
//    are not ported: they need a session to apply them mid-run and a draft store to remember
//    the pick. A launch choice here is the model alone.
import { exec } from "herdr";

// `omp models --json` (`OMP_MODEL_LIST_ARGS`, omp-model-list-probe.ts:5): the provider/id
// selector is exactly what `--model` takes, and a bare id collides across providers.
async function ompModels() {
  const { stdout } = await exec("omp", ["models", "--json"], { timeout: 60000 });
  // Update notices may print before the outermost JSON object (omp-model-list-probe.ts:7-27).
  const start = stdout.indexOf("{");
  const end = stdout.lastIndexOf("}");
  if (start === -1 || end <= start) return [];
  const rows = JSON.parse(stdout.slice(start, end + 1)).models;
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((m) => {
    const id = m?.selector || (m?.provider && m?.id ? `${m.provider}/${m.id}` : "");
    // "default" means omp's own configured provider, not a selectable model
    // (agent-model-probe-spec.ts:50-61).
    return !id || id === "default" ? [] : [{ id, label: m.name || m.id || id }];
  });
}

// `agy models` prints "<slug>\t<label>" after a fetching notice; the slug is what
// `agy --model` takes (`agent-session-option-catalog-antigravity.ts:33`).
async function agyModels() {
  const { stdout } = await exec("agy", ["models"], { timeout: 60000 });
  return stdout.split("\n").flatMap((line) => {
    const [id, label] = line.split("\t");
    return id && label?.trim() ? [{ id: id.trim(), label: label.trim() }] : [];
  });
}

export const MODELS = {
  claude: {
    flag: "--model",
    models: [
      { id: "fable", label: "Fable" },
      { id: "opus", label: "Opus" },
      { id: "sonnet", label: "Sonnet" },
      { id: "haiku", label: "Haiku" }
    ]
  },
  codex: {
    flag: "-m",
    models: [
      { id: "gpt-5.6-sol", label: "GPT-5.6 Sol" },
      { id: "gpt-5.6-terra", label: "GPT-5.6 Terra" },
      { id: "gpt-5.6-luna", label: "GPT-5.6 Luna" },
      { id: "gpt-5.5", label: "GPT-5.5" },
      { id: "gpt-5.2-codex", label: "GPT-5.2 Codex" }
    ]
  },
  gemini: {
    flag: "-m",
    models: [
      { id: "gemini-3-pro-preview", label: "Gemini 3 Pro Preview" },
      { id: "gemini-3-flash-preview", label: "Gemini 3 Flash Preview" },
      { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
      { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" }
    ]
  },
  grok: {
    flag: "-m",
    models: [
      { id: "grok-4.7", label: "Grok 4.7" },
      { id: "grok-4.6", label: "Grok 4.6" },
      { id: "grok-4.5", label: "Grok 4.5" }
    ]
  },
  antigravity: { flag: "--model", probe: agyModels },
  omp: { flag: "--model", probe: ompModels }
};
