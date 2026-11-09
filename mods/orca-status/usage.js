// Portions ported from Orca (MIT, Copyright (c) 2026 Lovecast Inc.); see NOTICE.
// Ported from:
// - src/main/rate-limits/antigravity-usage-response.ts
// - src/renderer/src/components/status-bar/UsageRosterPanel.tsx
// - src/renderer/src/components/status-bar/usage-pool-label.ts
// - src/shared/rate-limit-window-label.ts

const WEEKLY_WINDOW_MINUTES = 10080;
const SESSION_WINDOW_MINUTES = 300;

export function clampUsedPercent(pct) {
  if (typeof pct !== 'number' || Number.isNaN(pct)) return 0;
  return Math.min(100, Math.max(0, Math.round(pct)));
}

export function windowMinutesFor(window) {
  if (window === 'weekly') return WEEKLY_WINDOW_MINUTES;
  if (window === '5h') return SESSION_WINDOW_MINUTES;
  return null;
}

export function shortenGroup(group) {
  if (!group || typeof group !== 'string') return '';
  const short = group
    .replace(/\s+models$/i, '')
    .replace(/\s+and\s+/gi, '/')
    .trim();
  return short || group;
}

export function formatWindowLabel(windowMinutes) {
  if (windowMinutes === 10080) return 'wk';
  if (windowMinutes === 300) return '5h';
  if (windowMinutes === 60) return '1h';
  if (windowMinutes < 60) return `${windowMinutes}m`;
  if (windowMinutes % (60 * 24 * 7) === 0) return `${windowMinutes / (60 * 24 * 7)}wk`;
  if (windowMinutes % (60 * 24) === 0) return `${windowMinutes / (60 * 24)}d`;
  if (windowMinutes % 60 === 0) return `${windowMinutes / 60}h`;
  return `${windowMinutes}m`;
}

export function formatPoolWindowName(bucket) {
  if (bucket.windowMinutes > 0) {
    if (bucket.windowMinutes === WEEKLY_WINDOW_MINUTES) return 'wk';
    return formatWindowLabel(bucket.windowMinutes);
  }
  return (bucket.name ?? '').replace(/\s*limit remaining$/i, '').trim();
}

export function formatPoolShortLabel(groupName, bucket) {
  const groupLabel = shortenGroup(groupName);
  const windowLabel = formatPoolWindowName(bucket);
  return `${groupLabel} ${windowLabel}`.trim();
}

export function parseAntigravityOutput(stdout) {
  if (!stdout || typeof stdout !== 'string') return null;
  try {
    const data = JSON.parse(stdout);
    const groupsRaw = data?.command?.data?.groups;
    if (!Array.isArray(groupsRaw) || groupsRaw.length === 0) return null;

    const groups = [];
    for (const g of groupsRaw) {
      if (!g || typeof g.name !== 'string') continue;
      const buckets = [];
      if (Array.isArray(g.buckets)) {
        for (const b of g.buckets) {
          if (!b || typeof b.remaining_fraction !== 'number') continue;
          const remainingFraction = b.remaining_fraction;
          const usedPercent = clampUsedPercent((1 - remainingFraction) * 100);
          const windowMinutes = windowMinutesFor(b.window) ?? 0;
          buckets.push({
            id: b.id ?? '',
            name: b.name ?? '',
            window: b.window ?? '',
            windowMinutes,
            remainingFraction,
            usedPercent,
            resetTime: b.reset_time ?? null
          });
        }
      }
      if (buckets.length > 0) {
        groups.push({ name: g.name, buckets });
      }
    }
    return groups.length > 0 ? { groups } : null;
  } catch {
    return null;
  }
}

export function getTightestUsageBucket(groups) {
  if (!Array.isArray(groups) || groups.length === 0) return null;
  let tightest = null;

  for (const group of groups) {
    for (const bucket of group.buckets) {
      if (!tightest || bucket.usedPercent > tightest.bucket.usedPercent) {
        tightest = { groupName: group.name, bucket };
      }
    }
  }
  return tightest;
}

export async function probeAntigravity(execFn) {
  try {
    const res = await execFn('agy', [
      '-p',
      '/usage',
      '--output-format',
      'json',
      '--print-timeout',
      '20s'
    ], { timeout: 25000 });
    if (res && res.code === 0 && res.stdout) {
      const parsed = parseAntigravityOutput(res.stdout);
      if (parsed) {
        const tightest = getTightestUsageBucket(parsed.groups);
        if (tightest) {
          return {
            provider: 'antigravity',
            status: 'ok',
            usedPercent: tightest.bucket.usedPercent,
            label: formatPoolShortLabel(tightest.groupName, tightest.bucket)
          };
        }
      }
    }
  } catch {
    // Falls through to error status
  }
  return {
    provider: 'antigravity',
    status: 'error',
    label: 'Refresh failed'
  };
}

export async function probeClaude(readFileFn) {
  try {
    const content = await readFileFn('~/.claude.json');
    if (content) {
      const json = JSON.parse(content);
      if (json && json.oauthToken) {
        return {
          provider: 'claude',
          status: 'ok',
          usedPercent: null,
          label: ''
        };
      }
    }
  } catch {
    // Ignore read/parse errors
  }
  // When unauthenticated, token stale, or API failed: matches Orca's getProviderUsageStatusLabel() fallback
  return {
    provider: 'claude',
    status: 'error',
    label: 'Refresh failed'
  };
}

export async function probeCodex(readFileFn) {
  try {
    const content = await readFileFn('~/.codex/auth.json');
    if (content) {
      const json = JSON.parse(content);
      if (json && (json.tokens || json.session)) {
        return {
          provider: 'codex',
          status: 'ok',
          usedPercent: null,
          label: ''
        };
      }
    }
  } catch {
    // Ignore read errors
  }
  return {
    provider: 'codex',
    status: 'unavailable',
    label: ''
  };
}

export async function probeCursor(readFileFn) {
  try {
    const content = await readFileFn('~/.cursor/auth.json');
    if (content) {
      const json = JSON.parse(content);
      if (json && json.accessToken) {
        return {
          provider: 'cursor',
          status: 'ok',
          usedPercent: null,
          label: ''
        };
      }
    }
  } catch {
    // Ignore read errors
  }
  return {
    provider: 'cursor',
    status: 'unavailable',
    label: ''
  };
}

export async function probeAllProviders(deps) {
  const execFn = deps?.exec ?? (async () => ({ code: 1, stdout: '' }));
  const readFn = deps?.readTextFile ?? (async () => null);

  const [antigravity, claude, codex, cursor] = await Promise.all([
    probeAntigravity(execFn),
    probeClaude(readFn),
    probeCodex(readFn),
    probeCursor(readFn)
  ]);

  return { antigravity, claude, codex, cursor };
}
