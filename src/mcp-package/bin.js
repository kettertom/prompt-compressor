#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './index.js';

const server = createServer();
await server.connect(new StdioServerTransport());
console.error('prompt-compressor MCP server running on stdio');
