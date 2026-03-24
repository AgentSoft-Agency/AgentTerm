import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import type { AgentAdapter, HookInput, HookResult } from './adapter.js';
import { buildContextText } from './context.js';

const CODEX_DIR = join(homedir(), '.codex');
const CONFIG_PATH = join(CODEX_DIR, 'config.toml');

const HOOK_MARKER = '# agent-term hook';
const HOOK_BLOCK = `
${HOOK_MARKER}
[[hooks]]
event = "SessionStart"
command = "agent-term hook --agent codex-cli"
`;

export class CodexCliAdapter implements AgentAdapter {
  name = 'codex-cli';
  displayName = 'Codex CLI';
  configPath = CONFIG_PATH;
  detect(): boolean {
    return existsSync(CODEX_DIR);
  }

  register(): void {
    const content = this.readConfig();

    if (content.includes('agent-term')) return;

    this.writeConfig(content.trimEnd() + '\n' + HOOK_BLOCK);
  }

  unregister(): void {
    const content = this.readConfig();
    if (!content.includes('agent-term')) return;

    // Remove the agent-term hook block: from the marker comment through the next blank line or end
    const lines = content.split('\n');
    const filtered: string[] = [];
    let skipping = false;

    for (const line of lines) {
      if (line.trim() === HOOK_MARKER) {
        skipping = true;
        continue;
      }

      if (skipping) {
        // Skip [[hooks]], event=, command= lines that belong to this block
        if (line.startsWith('[[hooks]]') || line.startsWith('event ') || line.startsWith('event=') || line.startsWith('command ') || line.startsWith('command=')) {
          continue;
        }
        // Empty line ends the block
        if (line.trim() === '') {
          skipping = false;
          continue;
        }
        // Non-matching line means block ended, stop skipping
        skipping = false;
      }

      filtered.push(line);
    }

    this.writeConfig(filtered.join('\n'));
  }

  parseHookInput(stdin: string): HookInput {
    try {
      const data = JSON.parse(stdin);
      return {
        command: '',
        sessionId: data.session_id,
      };
    } catch {
      return { command: '' };
    }
  }

  isSessionStart(_stdin: string): boolean {
    return true;
  }

  formatHookOutput(_result: HookResult): string {
    // Context-mode adapters don't use formatHookOutput.
    // Output is handled by generateContext().
    return '';
  }

  generateContext(): string {
    return buildContextText();
  }

  private readConfig(): string {
    if (!existsSync(CONFIG_PATH)) return '';
    try {
      return readFileSync(CONFIG_PATH, 'utf-8');
    } catch {
      return '';
    }
  }

  private writeConfig(content: string): void {
    mkdirSync(dirname(CONFIG_PATH), { recursive: true });
    writeFileSync(CONFIG_PATH, content, 'utf-8');
  }
}
