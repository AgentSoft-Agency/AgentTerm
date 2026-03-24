import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import type { AgentAdapter, HookInput, HookResult } from './adapter.js';

const GEMINI_DIR = join(homedir(), '.gemini');
const SETTINGS_PATH = join(GEMINI_DIR, 'settings.json');

export class GeminiCliAdapter implements AgentAdapter {
  name = 'gemini-cli';
  displayName = 'Gemini CLI';
  configPath = SETTINGS_PATH;

  detect(): boolean {
    return existsSync(GEMINI_DIR);
  }

  register(): void {
    const settings = this.readSettings();
    if (!settings.hooks) settings.hooks = {};
    if (!settings.hooks.BeforeTool) settings.hooks.BeforeTool = [];

    const existing = settings.hooks.BeforeTool as any[];
    const alreadyRegistered = existing.some((entry: any) =>
      entry.hooks?.some((h: any) =>
        h.name === 'agent-term' ||
        (typeof h.command === 'string' && h.command.includes('agent-term')),
      ),
    );

    if (!alreadyRegistered) {
      existing.push({
        matcher: 'run_shell_command',
        hooks: [{
          name: 'agent-term',
          type: 'command',
          command: 'agent-term hook --agent gemini-cli',
          timeout: 15000,
        }],
      });
    }

    this.writeSettings(settings);
  }

  unregister(): void {
    const settings = this.readSettings();
    if (!settings.hooks?.BeforeTool) return;

    settings.hooks.BeforeTool = (settings.hooks.BeforeTool as any[]).filter(
      (entry: any) => !entry.hooks?.some((h: any) =>
        h.name === 'agent-term' ||
        (typeof h.command === 'string' && h.command.includes('agent-term')),
      ),
    );

    if ((settings.hooks.BeforeTool as any[]).length === 0) {
      delete settings.hooks.BeforeTool;
    }

    this.writeSettings(settings);
  }

  parseHookInput(stdin: string): HookInput {
    try {
      const data = JSON.parse(stdin);
      return {
        command: data.tool_input?.command ?? '',
        sessionId: data.session_id,
      };
    } catch {
      return { command: '' };
    }
  }

  formatHookOutput(result: HookResult): string {
    if (result.action === 'passthrough') return '';

    return JSON.stringify({
      decision: 'allow',
      hookSpecificOutput: {
        tool_input: {
          command: result.rewrittenCommand ?? '',
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
