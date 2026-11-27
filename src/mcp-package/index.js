/**
 * prompt-compressor-mcp
 *
 * MCP server for prompt-compressor: rule-based prompt compression.
 * No model, no API, nothing leaves your machine.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { z } from 'zod';
import { compress, estimateTokens, LEVELS } from 'prompt-compressor';

const require = createRequire(import.meta.url);
const { version } = require('./package.json');

const LEVEL_NAMES = ['none', 'very-low', 'low', 'medium'];
const levelSchema = z
  .enum(LEVEL_NAMES)
  .default('low')
  .describe(
    "Risk level. 'none' = whitespace/unicode only; 'very-low' = + filler, phrases, JSON/SQL minify; " +
      "'low' = + hedging, comments, dedup (recommended); 'medium' = + extractive summarization (may drop sentences)."
  );

const statsLine = (s) =>
  `Tokens: ${s.tokensBefore} → ${s.tokensAfter} (saved ${s.saved}, ${s.reductionPct}%)`;

export function createServer() {
  const server = new McpServer({ name: 'prompt-compressor', version });

  server.registerTool(
    'compress_prompt',
    {
      title: 'Compress prompt',
      description:
        'Compress a prompt, system prompt, or context block to use fewer tokens, using deterministic rule-based ' +
        'algorithms (no LLM call). Template variables like {{name}} and {var} are preserved. ' +
        'Returns the compressed text and token stats.',
      inputSchema: {
        text: z.string().min(1).describe('The text to compress.'),
        level: levelSchema,
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ text, level }) => {
      const { output, stats } = compress(text, level);
      return {
        content: [{ type: 'text', text: output }, { type: 'text', text: statsLine(stats) }],
        structuredContent: { output, stats, level },
      };
    }
  );

  server.registerTool(
    'compress_file',
    {
      title: 'Compress file',
      description:
        'Read a local text file (prompt, docs, logs, JSON, code) and return a compressed version with token stats. ' +
        'Does not modify the file.',
      inputSchema: {
        path: z.string().min(1).describe('Absolute path to a local text file.'),
        level: levelSchema,
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ path, level }) => {
      let text;
      try {
        text = await readFile(path, 'utf8');
      } catch (err) {
        return { isError: true, content: [{ type: 'text', text: `Could not read ${path}: ${err.message}` }] };
      }
      const { output, stats } = compress(text, level);
      return {
        content: [{ type: 'text', text: output }, { type: 'text', text: statsLine(stats) }],
        structuredContent: { output, stats, level, path },
      };
    }
  );

  server.registerTool(
    'compare_levels',
    {
      title: 'Compare compression levels',
      description:
        'Run every risk level on the same text and report token savings for each, so you can pick the right trade-off.',
      inputSchema: { text: z.string().min(1).describe('The text to analyze.') },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ text }) => {
      const rows = LEVEL_NAMES.map((level) => ({ level, ...compress(text, level).stats }));
      const table = [
        '| Level | Tokens before | Tokens after | Saved | Reduction |',
        '|---|---|---|---|---|',
        ...rows.map((r) => `| ${r.level} | ${r.tokensBefore} | ${r.tokensAfter} | ${r.saved} | ${r.reductionPct}% |`),
      ].join('\n');
      return { content: [{ type: 'text', text: table }], structuredContent: { levels: rows } };
    }
  );

  server.registerTool(
    'estimate_tokens',
    {
      title: 'Estimate tokens',
      description: 'Estimate the token count of a text (fast heuristic, no tokenizer download).',
      inputSchema: { text: z.string().describe('The text to measure.') },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ text }) => {
      const tokens = estimateTokens(text);
      return { content: [{ type: 'text', text: `~${tokens} tokens` }], structuredContent: { tokens } };
    }
  );

  server.registerResource(
    'levels',
    'prompt-compressor://levels',
    { title: 'Compression levels', description: 'Which algorithms run at each risk level', mimeType: 'application/json' },
    async (uri) => ({ contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(LEVELS, null, 2) }] })
  );

  return server;
}
