import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir, tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import type { AgentAdapter, HookInput, HookResult } from './adapter.js';
import { buildContextText } from './context.js';

const CLAUDE_DIR = join(homedir(), '.claude');
const SETTINGS_PATH = join(CLAUDE_DIR, 'settings.json');

export class ClaudeCodeAdapter implements AgentAdapter {
  name = 'claude-code';
  displayName = 'Claude Code';
  configPath = SETTINGS_PATH;
  detect(): boolean {
    return existsSync(CLAUDE_DIR);
  }

  isSessionStart(stdin: string): boolean {
    try {
      const data = JSON.parse(stdin);
      return data.event === 'SessionStart';
    } catch {
      return false;
    }
  }

  generateContext(): string {
    return buildContextText();
  }

  register(): void {
    const settings = this.readSettings();
    if (!settings.hooks) settings.hooks = {};

    // SessionStart hook
    if (!settings.hooks.SessionStart) settings.hooks.SessionStart = [];
    const sessionStartHooks = settings.hooks.SessionStart as any[];
    const sessionStartRegistered = sessionStartHooks.some((entry: any) =>
      entry.hooks?.some((h: any) => typeof h.command === 'string' && h.command.includes('agent-term')),
    );
    if (!sessionStartRegistered) {
      sessionStartHooks.push({
        hooks: [{
          type: 'command',
          command: 'agent-term hook --agent claude-code',
        }],
      });
    }

    // PreToolUse hook
    if (!settings.hooks.PreToolUse) settings.hooks.PreToolUse = [];
    const preToolHooks = settings.hooks.PreToolUse as any[];
    const preToolRegistered = preToolHooks.some((entry: any) =>
      entry.hooks?.some((h: any) => typeof h.command === 'string' && h.command.includes('agent-term')),
    );
    if (!preToolRegistered) {
      preToolHooks.push({
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

    const filterAgentTerm = (entries: any[]) =>
      entries.filter((entry: any) => !entry.hooks?.some((h: any) =>
        typeof h.command === 'string' && h.command.includes('agent-term'),
      ));

    if (settings.hooks?.PreToolUse) {
      settings.hooks.PreToolUse = filterAgentTerm(settings.hooks.PreToolUse);
    }
    if (settings.hooks?.SessionStart) {
      settings.hooks.SessionStart = filterAgentTerm(settings.hooks.SessionStart);
    }

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

    if (result.action === 'output') {
      const tmpFile = join(tmpdir(), `agent-term-${randomBytes(4).toString('hex')}.out`);
      writeFileSync(tmpFile, result.stdout ?? '', 'utf-8');
      return JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'allow',
          permissionDecisionReason: result.systemMessage ?? 'Command completed via agent-term.',
          updatedInput: {
            command: `cat ${tmpFile}`,
          },
        },
      });
    }

    return JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'allow',
        permissionDecisionReason: result.systemMessage ?? 'Command routed via agent-term.',
        updatedInput: {
          command: result.rewrittenCommand,
        },
      },
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
