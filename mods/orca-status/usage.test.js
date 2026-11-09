// Test suite for mods/orca-status/usage.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseAntigravityOutput,
  getTightestUsageBucket,
  shortenGroup,
  formatWindowLabel,
  formatPoolShortLabel,
  clampUsedPercent,
  parseOmpUsage,
  formatBucketChipLabel,
  probeAntigravity,
  probeOmp,
  probeAllProviders
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
  assert.equal(parsed.buckets.length, 3); // flat: each pool's buckets carry their group

  const tightest = getTightestUsageBucket(parsed.buckets);
  assert.ok(tightest);
  assert.equal(tightest.group, 'Gemini Models');
  assert.equal(tightest.id, 'gemini-weekly');
  assert.equal(tightest.usedPercent, 66); // (1 - 0.34) * 100 = 65.97 => 66
  assert.equal(formatBucketChipLabel(tightest), 'Gemini wk');
});

test('parseAntigravityOutput returns null on malformed JSON or empty output', () => {
  assert.equal(parseAntigravityOutput(''), null);
  assert.equal(parseAntigravityOutput('not json'), null);
  assert.equal(parseAntigravityOutput('{}'), null);
});

test('probeAntigravity returns ok with the parsed groups on valid exec output', async () => {
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
  assert.equal(res.provider, 'antigravity');
  assert.equal(res.status, 'ok');
  assert.equal(getTightestUsageBucket(res.buckets).usedPercent, 60);
});

test('probeAntigravity returns the Refresh failed chip when exec fails', async () => {
  const mockFailingExec = async () => {
    throw new Error('Command not found: agy');
  };

  const res = await probeAntigravity(mockFailingExec);
  assert.equal(res.status, 'error');
  assert.equal(res.label, 'Refresh failed');
});

test('parseOmpUsage turns reports into one reading per provider', () => {
  const stdout = JSON.stringify({
    generatedAt: 1794245655793,
    reports: [
      {
        provider: 'commandcode',
        limits: [
          {
            id: 'commandcode:5h',
            label: '5-hour limit',
            window: { id: '5h', label: '5-hour', durationMs: 18000000 },
            amount: { usedFraction: 0.0290486574, unit: 'credits' }
          },
          {
            id: 'commandcode:7d',
            label: 'Weekly limit',
            window: { id: '7d', label: 'Weekly', durationMs: 604800000 },
            amount: { usedFraction: 0.5, unit: 'credits' }
          },
          // A balance row has no window and no fraction; it must not become a window.
          { id: 'commandcode:balance', amount: { remaining: 53.5, unit: 'credits' } }
        ]
      },
      {
        provider: 'github-copilot',
        limits: [
          {
            id: 'copilot:premium',
            window: { id: 'monthly', label: 'Monthly' },
            amount: { usedFraction: 0.4785, unit: 'requests' }
          }
        ]
      }
    ]
  });

  const readings = parseOmpUsage(stdout);
  assert.equal(readings.length, 2);

  const commandCode = readings[0];
  assert.equal(commandCode.provider, 'commandcode');
  assert.equal(commandCode.status, 'ok');
  assert.equal(commandCode.buckets.length, 2); // the balance row is dropped
  assert.equal(commandCode.buckets[0].windowMinutes, 300);
  assert.equal(commandCode.buckets[1].windowMinutes, 10080);
  assert.equal(commandCode.buckets[1].usedPercent, 50);
  // One provider is one pool: no group, so the chip reads "5h" beside the provider's own mark.
  assert.equal(formatBucketChipLabel(commandCode.buckets[1]), 'wk');

  const copilot = readings[1];
  assert.equal(copilot.provider, 'github-copilot');
  // No durationMs: windowMinutes stays 0 so the chip names the window "Monthly",
  // where formatWindowLabel(0) would invent "0m".
  assert.equal(copilot.buckets[0].windowMinutes, 0);
  assert.equal(copilot.buckets[0].name, 'Monthly');
  assert.equal(formatBucketChipLabel(copilot.buckets[0]), 'Monthly');
});

test('parseOmpUsage reads the envelope past an update notice and rejects nonsense', () => {
  const payload = JSON.stringify({
    reports: [{ provider: 'commandcode', limits: [{ window: { durationMs: 18000000 }, amount: { usedFraction: 0.1 } }] }]
  });
  const withNotice = `Update available: 18.19.0\n${payload}`;
  assert.equal(parseOmpUsage(withNotice).length, 1);

  assert.equal(parseOmpUsage(''), null);
  assert.equal(parseOmpUsage('not json'), null);
  assert.equal(parseOmpUsage('{"reports": []}'), null);
});

test('probeOmp reports nothing rather than a fake provider when the CLI is missing', async () => {
  const missing = async () => {
    throw new Error('Command not found: omp');
  };
  assert.deepEqual(await probeOmp(missing, null), []);

  const ok = async (cmd, args) => {
    assert.equal(cmd, 'omp');
    assert.deepEqual(args, ['usage', '--json']);
    return {
      code: 0,
      stdout: JSON.stringify({
        reports: [{ provider: 'commandcode', limits: [{ window: { durationMs: 18000000 }, amount: { usedFraction: 0.25 } }] }]
      })
    };
  };
  const readings = await probeOmp(ok, null);
  assert.equal(readings.length, 1);
  assert.equal(readings[0].buckets[0].usedPercent, 25);
});

test('probes fall back to the install folders a desktop launch misses', async () => {
  // The app's PATH has no ~/.bun/bin, where omp lives: only the absolute path starts.
  const tried = [];
  const exec = async (cmd) => {
    tried.push(cmd);
    if (cmd !== '/home/person/.bun/bin/omp') {
      throw new Error(`Command not found: ${cmd}`);
    }
    return { code: 0, stdout: JSON.stringify({ reports: [] }) };
  };
  await probeOmp(exec, '/home/person');
  assert.equal(tried[0], 'omp');
  assert.ok(tried.includes('/home/person/.bun/bin/omp'));

  // A working bare name stops the search there.
  const direct = [];
  await probeOmp(async (cmd) => {
    direct.push(cmd);
    return { code: 0, stdout: JSON.stringify({ reports: [] }) };
  }, '/home/person');
  assert.deepEqual(direct, ['omp']);
});

test('probeAllProviders returns one flat reading list, antigravity first', async () => {
  const exec = async (cmd) => {
    if (cmd === 'agy') {
      return {
        code: 0,
        stdout: JSON.stringify({
          command: { data: { groups: [{ name: 'Gemini Models', buckets: [{ id: 'g', window: 'weekly', remaining_fraction: 0.4 }] }] } }
        })
      };
    }
    return { code: 0, stdout: JSON.stringify({ reports: [] }) };
  };

  const all = await probeAllProviders({ exec, home: null });
  assert.equal(all.providers.length, 1);
  assert.equal(all.providers[0].provider, 'antigravity');

  const failing = await probeAllProviders({ exec: async () => { throw new Error('no'); }, home: null });
  assert.equal(failing.providers.length, 1);
  assert.equal(failing.providers[0].status, 'error');
});
