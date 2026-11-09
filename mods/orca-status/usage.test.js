// Test suite for mods/orca-status/usage.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseAntigravityOutput,
  getTightestUsageBucket,
  shortenGroup,
  formatWindowLabel,
  formatPoolShortLabel,
  clampUsedPercent
} from './usage.js';

test('clampUsedPercent clamps within 0 to 100 and rounds', () => {
  assert.equal(clampUsedPercent(-5), 0);
  assert.equal(clampUsedPercent(105), 100);
  assert.equal(clampUsedPercent(65.8), 66);
});

test('shortenGroup strips "models" and replaces "and" with "/"', () => {
  assert.equal(shortenGroup('Gemini Models'), 'Gemini');
  assert.equal(shortenGroup('Claude and GPT models'), 'Claude/GPT');
  assert.equal(shortenGroup('Custom Pool'), 'Custom Pool');
});

test('formatWindowLabel maps standard minutes to Orca labels', () => {
  assert.equal(formatWindowLabel(10080), 'wk');
  assert.equal(formatWindowLabel(300), '5h');
  assert.equal(formatWindowLabel(60), '1h');
  assert.equal(formatWindowLabel(30), '30m');
});

test('formatPoolShortLabel combines shortened group and window', () => {
  const bucket = { windowMinutes: 10080, name: 'Weekly Limit Remaining' };
  assert.equal(formatPoolShortLabel('Gemini Models', bucket), 'Gemini wk');

  const fiveHourBucket = { windowMinutes: 300, name: 'Five Hour Limit Remaining' };
  assert.equal(formatPoolShortLabel('Gemini Models', fiveHourBucket), 'Gemini 5h');
});

test('parseAntigravityOutput parses realistic agy usage JSON', () => {
  const sampleAgyStdout = JSON.stringify({
    status: 'SUCCESS',
    command: {
      name: 'usage',
      data: {
        groups: [
          {
            name: 'Gemini Models',
            buckets: [
              {
                id: 'gemini-weekly',
                name: 'Weekly Limit Remaining',
                window: 'weekly',
                remaining_fraction: 0.3402799367904663,
                reset_time: '2026-11-14T20:26:58Z'
              },
              {
                id: 'gemini-5h',
                name: 'Five Hour Limit Remaining',
                window: '5h',
                remaining_fraction: 0.6637582182884216,
                reset_time: '2026-11-09T20:29:38Z'
              }
            ]
          },
          {
            name: 'Claude and GPT models',
            buckets: [
              {
                id: '3p-weekly',
                name: 'Weekly Limit Remaining',
                window: 'weekly',
                remaining_fraction: 1,
                reset_time: '2026-11-16T16:14:53Z'
              }
            ]
          }
        ]
      }
    }
  });

  const parsed = parseAntigravityOutput(sampleAgyStdout);
  assert.ok(parsed);
  assert.equal(parsed.groups.length, 2);

  const tightest = getTightestUsageBucket(parsed.groups);
  assert.ok(tightest);
  assert.equal(tightest.groupName, 'Gemini Models');
  assert.equal(tightest.bucket.id, 'gemini-weekly');
  assert.equal(tightest.bucket.usedPercent, 66); // (1 - 0.34) * 100 = 65.97 => 66
  assert.equal(formatPoolShortLabel(tightest.groupName, tightest.bucket), 'Gemini wk');
});

test('parseAntigravityOutput returns null on malformed JSON or empty output', () => {
  assert.equal(parseAntigravityOutput(''), null);
  assert.equal(parseAntigravityOutput('not json'), null);
  assert.equal(parseAntigravityOutput('{}'), null);
});

test('probeAntigravity returns ok with tightest bucket on valid exec output', async () => {
  const { probeAntigravity } = await import('./usage.js');
  const mockExec = async (cmd, args) => {
    assert.equal(cmd, 'agy');
    assert.deepEqual(args, ['-p', '/usage', '--output-format', 'json', '--print-timeout', '20s']);
    return {
      code: 0,
      stdout: JSON.stringify({
        status: 'SUCCESS',
        command: {
          data: {
            groups: [
              {
                name: 'Gemini Models',
                buckets: [
                  {
                    id: 'gemini-wk',
                    window: 'weekly',
                    remaining_fraction: 0.40,
                    name: 'Weekly Limit Remaining'
                  }
                ]
              }
            ]
          }
        }
      })
    };
  };

  const res = await probeAntigravity(mockExec);
  assert.equal(res.status, 'ok');
  assert.equal(res.usedPercent, 60);
  assert.equal(res.label, 'Gemini wk');
});

test('probeAntigravity returns error when exec fails', async () => {
  const { probeAntigravity } = await import('./usage.js');
  const mockFailingExec = async () => {
    throw new Error('Command not found: agy');
  };

  const res = await probeAntigravity(mockFailingExec);
  assert.equal(res.status, 'error');
  assert.equal(res.label, 'Refresh failed');
});

test('probeClaude returns error with "Refresh failed" when unauthenticated', async () => {
  const { probeClaude } = await import('./usage.js');
  const mockReadTextFile = async () => null; // File missing
  const res = await probeClaude(mockReadTextFile);
  assert.equal(res.status, 'error');
  assert.equal(res.label, 'Refresh failed');
});

test('probeCodex and probeCursor return unavailable when auth files are missing', async () => {
  const { probeCodex, probeCursor, probeAllProviders } = await import('./usage.js');
  const mockReadTextFile = async () => null;
  assert.equal((await probeCodex(mockReadTextFile)).status, 'unavailable');
  assert.equal((await probeCursor(mockReadTextFile)).status, 'unavailable');

  const all = await probeAllProviders({
    exec: async () => ({ code: 1, stdout: '' }),
    readTextFile: mockReadTextFile
  });
  assert.equal(all.antigravity.status, 'error');
  assert.equal(all.claude.status, 'error');
  assert.equal(all.codex.status, 'unavailable');
  assert.equal(all.cursor.status, 'unavailable');
});
