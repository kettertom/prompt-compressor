import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const bin = fileURLToPath(new URL('../bin.js', import.meta.url));
const SAMPLE = `Please note that you should basically   always respond to the user {{name}} in a helpful way.
Please note that you should basically   always respond to the user {{name}} in a helpful way.
It is important to note that, in order to provide the best answer, you might perhaps want to think step by step.`;

async function connect(t) {
  const client = new Client({ name: 'test', version: '0.0.0' });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [bin], stderr: 'ignore' }));
  t.after(() => client.close());
  return client;
}

test('lists tools', async (t) => {
  const c = await connect(t);
  const { tools } = await c.listTools();
  assert.deepEqual(tools.map((t) => t.name).sort(), ['compare_levels', 'compress_file', 'compress_prompt', 'estimate_tokens']);
});

test('compress_prompt shrinks text and keeps template vars', async (t) => {
  const c = await connect(t);
  const r = await c.callTool({ name: 'compress_prompt', arguments: { text: SAMPLE } });
  const { output, stats, level } = r.structuredContent;
  assert.equal(level, 'low');
  assert.ok(stats.tokensAfter < stats.tokensBefore, JSON.stringify(stats));
  assert.ok(output.includes('{{name}}'));
});

test('compress_file reads a file; missing file returns isError', async (t) => {
  const c = await connect(t);
  const dir = await mkdtemp(join(tmpdir(), 'pc-'));
  const f = join(dir, 'p.txt');
  await writeFile(f, SAMPLE);
  const ok = await c.callTool({ name: 'compress_file', arguments: { path: f, level: 'very-low' } });
  assert.ok(ok.structuredContent.stats.saved > 0);
  const bad = await c.callTool({ name: 'compress_file', arguments: { path: join(dir, 'nope.txt') } });
  assert.equal(bad.isError, true);
});

test('compare_levels returns all four levels; estimate_tokens works; resource readable', async (t) => {
  const c = await connect(t);
  const cmp = await c.callTool({ name: 'compare_levels', arguments: { text: SAMPLE } });
  assert.deepEqual(cmp.structuredContent.levels.map((l) => l.level), ['none', 'very-low', 'low', 'medium']);
  const est = await c.callTool({ name: 'estimate_tokens', arguments: { text: SAMPLE } });
  assert.ok(est.structuredContent.tokens > 10);
  const res = await c.readResource({ uri: 'prompt-compressor://levels' });
  assert.ok(JSON.parse(res.contents[0].text).low.includes('hedging'));
});
