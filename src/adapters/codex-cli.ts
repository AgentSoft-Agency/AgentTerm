import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import type { AgentAdapter, HookInput, HookMode, HookResult } from './adapter.js';
import { listSessionNames, getSessionStatus, getSessionCommand } from '../tmux.js';
import { fromSessionName } from '../naming.js';
import { loadPatterns } from '../config.js';

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
  hookMode: HookMode = 'context';

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

  formatHookOutput(_result: HookResult): string {
    // Context-mode adapters don't use formatHookOutput.
    // Output is handled by generateContext().
    return '';
  }

  generateContext(): string {
    const sections: string[] = [];

    sections.push('## Shared Terminals (agent-term)');
    sections.push('');
    sections.push('`agent-term` is installed on this machine. Use it for long-running commands (dev servers, watchers, docker compose, builds that run continuously).');
    sections.push('');

    // List active terminals
    try {
      const sessions = listSessionNames();
      if (sessions.length > 0) {
        sections.push('### Active terminals');
        sections.push('');
        for (const sn of sessions) {
          const name = fromSessionName(sn);
          const { dead } = getSessionStatus(sn);
          const command = getSessionCommand(sn);
          const status = dead ? 'exited' : 'running';
          sections.push(`- **${name}** (${status}): \`${command}\``);
        }
        sections.push('');
      } else {
        sections.push('No active shared terminals.');
        sections.push('');
      }
    } catch {
      sections.push('No active shared terminals.');
      sections.push('');
    }

    // List configured patterns so the model knows what commands to route
    const patterns = loadPatterns();
    if (patterns.length > 0) {
      sections.push('### Commands to route through agent-term');
      sections.push('');
      sections.push('These command patterns should use agent-term instead of running directly:');
      for (const p of patterns) {
        sections.push(`- \`${p}\``);
      }
      sections.push('');
    }

    sections.push('### Usage');
    sections.push('');
    sections.push('```bash');
    sections.push('# Start a long-running command in a shared terminal');
    sections.push('agent-term start --name <name> -- <command>');
    sections.push('');
    sections.push('# Read output from a shared terminal');
    sections.push('agent-term logs <name> --lines 50');
    sections.push('');
    sections.push('# Send input to a shared terminal');
    sections.push('agent-term send <name> "<input>"');
    sections.push('');
    sections.push('# Check terminal status');
    sections.push('agent-term status <name>');
    sections.push('');
    sections.push('# List all shared terminals');
    sections.push('agent-term list');
    sections.push('');
    sections.push('# Kill a shared terminal');
    sections.push('agent-term kill <name>');
    sections.push('```');
    sections.push('');
    sections.push('Do NOT run long-running commands directly — use `agent-term start` so other agent sessions can access them.');

    return sections.join('\n');
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
