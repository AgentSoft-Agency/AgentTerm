import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import type { AgentAdapter, HookInput, HookResult } from './adapter.js';

const CLAUDE_DIR = join(homedir(), '.claude');
const SETTINGS_PATH = join(CLAUDE_DIR, 'settings.json');

export class ClaudeCodeAdapter implements AgentAdapter {
  name = 'claude-code';
  displayName = 'Claude Code';
  configPath = SETTINGS_PATH;

  detect(): boolean {
    return existsSync(CLAUDE_DIR);
  }

  register(): void {
    const settings = this.readSettings();
    if (!settings.hooks) settings.hooks = {};
    if (!settings.hooks.PreToolUse) settings.hooks.PreToolUse = [];

    const existing = settings.hooks.PreToolUse as any[];
    const alreadyRegistered = existing.some((entry: any) =>
      entry.hooks?.some((h: any) => typeof h.command === 'string' && h.command.includes('agent-term')),
    );

    if (!alreadyRegistered) {
      existing.push({
        matcher: 'Bash',
        hooks: [{
          type: 'command',
          command: 'agent-term hook --agent claude-code',
          timeout: 15,
        }],
      });
    }

    this.writeSettings(settings);
  }

  unregister(): void {
    const settings = this.readSettings();
    if (!settings.hooks?.PreToolUse) return;

    settings.hooks.PreToolUse = (settings.hooks.PreToolUse as any[]).filter(
      (entry: any) => !entry.hooks?.some((h: any) =>
        typeof h.command === 'string' && h.command.includes('agent-term'),
      ),
    );

    this.writeSettings(settings);
  }

  parseHookInput(stdin: string): HookInput {
    const data = JSON.parse(stdin);
    return {
      command: data.tool_input?.command ?? '',
      sessionId: data.session_id,
    };
  }

  formatHookOutput(result: HookResult): string {
    if (result.action === 'passthrough') return '';

    return JSON.stringify({
      hookSpecificOutput: {
        permissionDecision: 'allow',
        updatedInput: {
          command: result.rewrittenCommand,
        },
      },
      systemMessage: result.systemMessage ?? '',
    });
  }

  private readSettings(): any {
    if (!existsSync(SETTINGS_PATH)) return {};
    try {
      return JSON.parse(readFileSync(SETTINGS_PATH, 'utf-8'));
    } catch {
      return {};
    }
  }

  private writeSettings(settings: any): void {
    mkdirSync(dirname(SETTINGS_PATH), { recursive: true });
    writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2) + '\n', 'utf-8');
  }
}
