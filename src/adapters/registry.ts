import type { AgentAdapter } from './adapter.js';
import { ClaudeCodeAdapter } from './claude-code.js';
import { GeminiCliAdapter } from './gemini-cli.js';
import { CodexCliAdapter } from './codex-cli.js';

const adapters: AgentAdapter[] = [
  new ClaudeCodeAdapter(),
  new GeminiCliAdapter(),
  new CodexCliAdapter(),
];

export function getAdapter(name: string): AgentAdapter | undefined {
  return adapters.find((a) => a.name === name);
}

export function getAllAdapters(): AgentAdapter[] {
  return adapters;
}

export function detectInstalledAgents(): AgentAdapter[] {
  return adapters.filter((a) => a.detect());
}
